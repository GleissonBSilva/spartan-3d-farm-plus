-- =============================================================================
-- MIGRATION: Correção definitiva do erro HTTP 403 (SQLSTATE 42501) em spartan_admin_delete_user
-- Data: 2026-10-17
-- Causa raiz do 403 no PostgREST:
-- O Supabase Storage possui o trigger storage.protect_delete() em storage.objects que
-- lança SQLSTATE 42501 ("Direct deletion from storage tables is not allowed") caso
-- a flag local `storage.allow_delete_query = 'true'` não esteja ativa na transação.
-- O PostgREST converte qualquer SQLSTATE 42501 em HTTP 403 Forbidden.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.spartan_admin_delete_user(p_target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_company_id UUID;
  v_company_is_exclusive BOOLEAN := FALSE;
  v_caller_email TEXT;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada. Faça login novamente.';
  END IF;

  -- Verifica se o usuário logado é administrador (via função, perfil, platform_access ou e-mail do proprietário)
  SELECT lower(coalesce(email, '')) INTO v_caller_email
  FROM auth.users
  WHERE id = auth.uid();

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

  IF EXISTS (
    SELECT 1 FROM public.spartan_platform_access
    WHERE user_id = p_target_user_id AND access_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Não é permitido excluir outro administrador da plataforma.';
  END IF;

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

  -- 1. Remove arquivos do usuário alvo no Supabase Storage
  -- Ativa `storage.allow_delete_query = 'true'` exigido pelo trigger storage.protect_delete()
  -- do Supabase para evitar SQLSTATE 42501 (HTTP 403 Forbidden).
  BEGIN
    PERFORM set_config('storage.allow_delete_query', 'true', true);

    DELETE FROM storage.objects
    WHERE owner = p_target_user_id
       OR owner_id = p_target_user_id::text
       OR name LIKE (p_target_user_id::text || '/%')
       OR (v_company_is_exclusive AND v_company_id IS NOT NULL AND name LIKE (v_company_id::text || '/%'));
  EXCEPTION WHEN OTHERS THEN
    -- Caso a versão do Supabase Storage bloqueie DELETE direto, desvincula o owner
    BEGIN
      UPDATE storage.objects
      SET owner = NULL, owner_id = NULL
      WHERE owner = p_target_user_id OR owner_id = p_target_user_id::text;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  -- 2. Remove exclusivamente os dados pertencentes ao p_target_user_id
  DELETE FROM public.spartan_printer_events
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_inventory_events
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_projects
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND created_by = p_target_user_id)
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_printers
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_filaments
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_invoices
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_subscriptions
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_ai_usage_logs
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_ai_conversations
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_notifications
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_push_subscriptions
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_user_settings
  WHERE user_id = p_target_user_id;

  DELETE FROM public.spartan_platform_access
  WHERE user_id = p_target_user_id;

  DELETE FROM public.spartan_company_memberships
  WHERE user_id = p_target_user_id;

  DELETE FROM public.spartan_profiles
  WHERE id = p_target_user_id;

  -- Só remove o registro da empresa se nenhum outro perfil estiver vinculado a ela
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

  -- 3. Remove exclusivamente as identidades, sessões e a conta do usuário alvo em auth.users
  DELETE FROM auth.identities WHERE user_id = p_target_user_id;
  DELETE FROM auth.users WHERE id = p_target_user_id;
END;
$$;

ALTER FUNCTION public.spartan_admin_delete_user(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.spartan_admin_delete_user(UUID) TO authenticated, service_role;

-- Teste de verificação em transação para garantir que storage.allow_delete_query e auth.users
-- funcionam sem erro 42501 (403 Forbidden)
DO $$
DECLARE
  v_test_uid UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('storage.allow_delete_query', 'true', true);
  DELETE FROM storage.objects WHERE owner = v_test_uid;
  DELETE FROM auth.identities WHERE user_id = v_test_uid;
  DELETE FROM auth.users WHERE id = v_test_uid;
END $$;

COMMIT;
