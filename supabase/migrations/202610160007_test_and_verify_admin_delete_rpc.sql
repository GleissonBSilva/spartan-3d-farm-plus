-- =============================================================================
-- MIGRATION: Diagnóstico e correção de SQLSTATE 42501 em spartan_admin_delete_user
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
    WHERE user_id IS NULL AND created_by = p_target_user_id;
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
    WHERE user_id = p_target_user_id;
  END IF;

  v_step := 'delete_profiles';
  DELETE FROM public.spartan_profiles
  WHERE id = p_target_user_id;

  v_step := 'delete_companies';
  IF v_company_id IS NOT NULL AND v_company_is_exclusive THEN
    DELETE FROM public.spartan_companies
    WHERE id = v_company_id
      AND NOT EXISTS (
        SELECT 1 FROM public.spartan_profiles p WHERE p.company_id = v_company_id
      );
  END IF;

  DELETE FROM public.spartan_companies
  WHERE user_id = p_target_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.spartan_profiles p WHERE p.company_id = public.spartan_companies.id
    );

  v_step := 'delete_auth_identities';
  DELETE FROM auth.identities WHERE user_id = p_target_user_id;

  v_step := 'delete_auth_users';
  DELETE FROM auth.users WHERE id = p_target_user_id;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'STEP=% USER=% SESSION=% ERR=% (SQLSTATE=%)', v_step, current_user, session_user, SQLERRM, SQLSTATE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spartan_admin_delete_user(UUID) TO anon, authenticated, service_role;

DO $$
DECLARE
  v_admin_id UUID;
  v_temp_user_id UUID := gen_random_uuid();
BEGIN
  SELECT id INTO v_admin_id
  FROM public.spartan_profiles
  WHERE role = 'admin'
     OR id IN (SELECT user_id FROM public.spartan_platform_access WHERE access_role = 'admin')
  LIMIT 1;

  IF v_admin_id IS NOT NULL THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      v_temp_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'temp_delete_test_' || replace(v_temp_user_id::text, '-', '') || '@example.com',
      'encrypted',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Teste Exclusao","company_name":"Farm Teste"}'::jsonb,
      now(),
      now()
    );

    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);

    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.spartan_admin_delete_user(v_temp_user_id);
    EXECUTE 'RESET ROLE';
  END IF;
END $$;

COMMIT;
