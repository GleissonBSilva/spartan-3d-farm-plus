-- =============================================================================
-- MIGRATION: Desvinculação circular de FKs e limpeza automática de todas as
-- referências a auth.users / spartan_profiles / spartan_companies antes da exclusão
-- Data: 2026-10-17
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.spartan_admin_delete_user(p_target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_company_is_exclusive BOOLEAN := FALSE;
  v_caller_email TEXT;
  v_is_admin BOOLEAN := FALSE;
  v_tbl TEXT;
  v_step TEXT := 'init';
  r_fk RECORD;
BEGIN
  v_step := 'check_auth_uid';
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada. Faça login novamente.';
  END IF;

  v_step := 'select_caller_email';
  SELECT lower(coalesce(email, '')) INTO v_caller_email
  FROM auth.users
  WHERE id = auth.uid();

  v_step := 'check_is_admin';
  v_is_admin := public.spartan_is_platform_admin()
    OR v_caller_email IN ('gsroboticmania@gmail.com', 'gleisson1984@hotmail.com', 'gleison@hotmail.com');

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores da plataforma podem excluir usuários.';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'ID do usuário inválido.';
  END IF;

  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir sua própria conta de administrador.';
  END IF;

  v_step := 'check_target_admin';
  IF EXISTS (
    SELECT 1 FROM public.spartan_platform_access
    WHERE user_id = p_target_user_id AND access_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Não é permitido excluir outro administrador da plataforma.';
  END IF;

  v_step := 'select_company_id';
  SELECT company_id INTO v_company_id
  FROM public.spartan_profiles
  WHERE id = p_target_user_id;

  IF v_company_id IS NOT NULL THEN
    v_company_is_exclusive := NOT EXISTS (
      SELECT 1 FROM public.spartan_profiles p
      WHERE p.company_id = v_company_id
        AND p.id <> p_target_user_id
    );
  END IF;

  -- 1. Limpa objetos do Storage vinculados ao usuário alvo
  v_step := 'delete_storage';
  BEGIN
    PERFORM set_config('storage.allow_delete_query', 'true', true);

    DELETE FROM storage.objects
    WHERE owner = p_target_user_id
       OR owner_id = p_target_user_id::text
       OR name LIKE (p_target_user_id::text || '/%')
       OR (v_company_is_exclusive AND v_company_id IS NOT NULL AND name LIKE (v_company_id::text || '/%'));
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      UPDATE storage.objects
      SET owner = NULL, owner_id = NULL
      WHERE owner = p_target_user_id OR owner_id = p_target_user_id::text;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  -- 2. Quebra referências circulares entre spartan_printers e spartan_projects antes de deletar
  v_step := 'unlink_circular_fks';
  IF to_regclass('public.spartan_printers') IS NOT NULL THEN
    UPDATE public.spartan_printers
    SET current_project_id = NULL
    WHERE user_id = p_target_user_id
       OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);
  END IF;

  IF to_regclass('public.spartan_projects') IS NOT NULL THEN
    UPDATE public.spartan_projects
    SET printer_id = NULL
    WHERE user_id = p_target_user_id
       OR created_by = p_target_user_id
       OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);
  END IF;

  -- 3. Remove eventos filhos primeiro, depois projetos, impressoras, filamentos e faturas
  FOREACH v_tbl IN ARRAY ARRAY[
    'spartan_printer_events',
    'spartan_inventory_events',
    'spartan_projects',
    'spartan_printers',
    'spartan_filaments',
    'spartan_invoices',
    'spartan_subscriptions',
    'spartan_ai_usage_logs',
    'spartan_ai_logs',
    'spartan_ai_conversations',
    'spartan_notifications',
    'spartan_push_subscriptions'
  ]
  LOOP
    v_step := 'delete_' || v_tbl;
    IF to_regclass('public.' || v_tbl) IS NOT NULL THEN
      EXECUTE format(
        'DELETE FROM public.%I WHERE user_id = $1 OR (user_id IS NULL AND $2 AND company_id = $3)',
        v_tbl
      ) USING p_target_user_id, v_company_is_exclusive, v_company_id;
    END IF;
  END LOOP;

  v_step := 'delete_projects_created_by';
  IF to_regclass('public.spartan_projects') IS NOT NULL THEN
    DELETE FROM public.spartan_projects
    WHERE created_by = p_target_user_id;
  END IF;

  v_step := 'delete_user_settings';
  IF to_regclass('public.spartan_user_settings') IS NOT NULL THEN
    DELETE FROM public.spartan_user_settings
    WHERE user_id = p_target_user_id;
  END IF;

  v_step := 'delete_platform_access';
  IF to_regclass('public.spartan_platform_access') IS NOT NULL THEN
    DELETE FROM public.spartan_platform_access
    WHERE user_id = p_target_user_id;
  END IF;

  v_step := 'delete_company_memberships';
  IF to_regclass('public.spartan_company_memberships') IS NOT NULL THEN
    DELETE FROM public.spartan_company_memberships
    WHERE user_id = p_target_user_id
       OR (v_company_is_exclusive AND company_id = v_company_id);
  END IF;

  v_step := 'delete_profiles';
  DELETE FROM public.spartan_profiles
  WHERE id = p_target_user_id;

  -- 4. Antes de remover a company exclusiva, limpa quaisquer referências residuais a v_company_id em tabelas onde user_id era NULL
  IF v_company_id IS NOT NULL AND v_company_is_exclusive THEN
    v_step := 'cleanup_exclusive_company_refs';
    FOR r_fk IN
      SELECT c.relname AS table_name, a.attname AS column_name
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(con.conkey)
      WHERE con.confrelid = 'public.spartan_companies'::regclass
        AND n.nspname = 'public'
    LOOP
      EXECUTE format(
        'DELETE FROM public.%I WHERE %I = $1 AND NOT EXISTS (SELECT 1 FROM public.spartan_profiles p WHERE p.company_id = $1)',
        r_fk.table_name,
        r_fk.column_name
      ) USING v_company_id;
    END LOOP;

    v_step := 'delete_exclusive_company';
    DELETE FROM public.spartan_companies
    WHERE id = v_company_id
      AND NOT EXISTS (
        SELECT 1 FROM public.spartan_profiles p WHERE p.company_id = v_company_id
      );
  END IF;

  v_step := 'delete_user_companies';
  DELETE FROM public.spartan_companies
  WHERE user_id = p_target_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.spartan_profiles p WHERE p.company_id = public.spartan_companies.id
    );

  -- 5. Remove exclusivamente as identidades e a conta do usuário alvo em auth.users
  v_step := 'delete_auth_identities';
  DELETE FROM auth.identities WHERE user_id = p_target_user_id;

  v_step := 'delete_auth_users';
  DELETE FROM auth.users WHERE id = p_target_user_id;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erro ao excluir usuário (%) [passo=%]: % (SQLSTATE=%)', p_target_user_id, v_step, SQLERRM, SQLSTATE;
END;
$$;

ALTER FUNCTION public.spartan_admin_delete_user(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.spartan_admin_delete_user(UUID) TO anon, authenticated, service_role;

-- Simulação DRY-RUN (com rollback automático por subtransação) em TODOS os clientes reais
-- cadastrados no banco para validar que 100% deles podem ser excluídos sem nenhum erro!
DO $$
DECLARE
  v_admin_id UUID;
  r_client RECORD;
BEGIN
  SELECT id INTO v_admin_id
  FROM public.spartan_profiles
  WHERE role = 'admin'
     OR id IN (SELECT user_id FROM public.spartan_platform_access WHERE access_role = 'admin')
  LIMIT 1;

  IF v_admin_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);

    FOR r_client IN
      SELECT id, email
      FROM public.spartan_profiles
      WHERE id <> v_admin_id
        AND role <> 'admin'
        AND id NOT IN (SELECT user_id FROM public.spartan_platform_access WHERE access_role = 'admin')
    LOOP
      BEGIN
        EXECUTE 'SET LOCAL ROLE authenticated';
        PERFORM public.spartan_admin_delete_user(r_client.id);
        EXECUTE 'RESET ROLE';
        -- Força rollback desta subtransação para não apagar os clientes durante o teste!
        RAISE EXCEPTION '__DRY_RUN_ROLLBACK__';
      EXCEPTION
        WHEN OTHERS THEN
          EXECUTE 'RESET ROLE';
          IF SQLERRM <> '__DRY_RUN_ROLLBACK__' THEN
            RAISE EXCEPTION 'Falha na simulação de exclusão do cliente real % (%): %', r_client.email, r_client.id, SQLERRM;
          END IF;
      END;
    END LOOP;
  END IF;
END $$;

COMMIT;
