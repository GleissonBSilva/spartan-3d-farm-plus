-- =============================================================================
-- MIGRATION: Blindagem de exclusão individual de cliente e isolamento 1:1 de company_id
-- Data: 2026-10-16
-- Garante que:
-- 1. Nenhum cliente compartilhe o mesmo company_id com outro cliente no banco.
-- 2. A função spartan_admin_delete_user(p_target_user_id) apague EXCLUSIVAMENTE
--    os registros cujo user_id seja igual a p_target_user_id, mantendo todos os
--    demais clientes 100% intactos sob qualquer circunstância.
-- =============================================================================

BEGIN;

-- 1. Se existir qualquer perfil compartilhando o mesmo company_id com outro usuário,
-- cria uma company exclusiva para cada usuário adicional para garantir isolamento 1:1.
ALTER TABLE public.spartan_profiles DISABLE TRIGGER USER;

DO $$
DECLARE
  r RECORD;
  v_new_company_id UUID;
BEGIN
  FOR r IN
    SELECT p.id AS profile_id, p.company_name, p.full_name, p.email, p.company_id
    FROM public.spartan_profiles p
    WHERE p.company_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.spartan_profiles p2
        WHERE p2.company_id = p.company_id
          AND p2.id <> p.id
          AND (p2.created_at < p.created_at OR (p2.created_at = p.created_at AND p2.id < p.id))
      )
  LOOP
    INSERT INTO public.spartan_companies (name, user_id)
    VALUES (
      COALESCE(NULLIF(BTRIM(r.company_name), ''), NULLIF(BTRIM(r.full_name), ''), split_part(COALESCE(r.email, 'Minha farm 3D'), '@', 1)),
      r.profile_id
    )
    RETURNING id INTO v_new_company_id;

    UPDATE public.spartan_profiles
    SET company_id = v_new_company_id
    WHERE id = r.profile_id;

    DELETE FROM public.spartan_company_memberships
    WHERE user_id = r.profile_id;

    INSERT INTO public.spartan_company_memberships (company_id, user_id, role)
    VALUES (v_new_company_id, r.profile_id, 'owner')
    ON CONFLICT DO NOTHING;

    -- Atualiza company_id nas tabelas de dados pertencentes estritamente a este user_id
    UPDATE public.spartan_projects SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_printers SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_filaments SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_printer_events SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_inventory_events SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_invoices SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_subscriptions SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_ai_usage_logs SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_ai_conversations SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_notifications SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_push_subscriptions SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_user_settings SET company_id = v_new_company_id WHERE user_id = r.profile_id;
  END LOOP;
END $$;

ALTER TABLE public.spartan_profiles ENABLE TRIGGER USER;

-- 2. Atualiza spartan_admin_delete_user para filtrar ESTRITAMENTE pelo p_target_user_id,
-- garantindo que nenhum dado de outro cliente seja jamais afetado.
CREATE OR REPLACE FUNCTION public.spartan_admin_delete_user(p_target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_company_id UUID;
  v_company_is_exclusive BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.spartan_is_platform_admin() THEN
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

  -- 1. Remove apenas arquivos do usuário alvo no Supabase Storage
  DELETE FROM storage.objects
  WHERE owner = p_target_user_id
     OR owner_id = p_target_user_id::text
     OR name LIKE (p_target_user_id::text || '/%')
     OR (v_company_is_exclusive AND v_company_id IS NOT NULL AND name LIKE (v_company_id::text || '/%'));

  -- 2. Remove exclusivamente os dados pertencentes ao p_target_user_id
  -- (Jamais toca em registros onde user_id pertence a outro usuário)
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

  -- 3. Remove exclusivamente as identidades e a conta do usuário alvo em auth.users
  DELETE FROM auth.identities WHERE user_id = p_target_user_id;
  DELETE FROM auth.users WHERE id = p_target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.spartan_admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spartan_admin_delete_user(UUID) TO authenticated;

COMMIT;
