-- =============================================================================
-- MIGRATION: Exclusão completa de usuário pelo Admin (Banco, Auth e Storage)
-- Data: 2026-10-16
-- Permite que o Admin exclua 100% dos dados de um cliente no Supabase e libere
-- o e-mail em auth.users para que o cliente possa criar uma nova conta do zero.
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

  -- 1. Remove arquivos do usuário no Supabase Storage (fotos de perfil, modelos 3D, imagens de projetos)
  DELETE FROM storage.objects
  WHERE owner = p_target_user_id
     OR owner_id = p_target_user_id::text
     OR name LIKE (p_target_user_id::text || '/%')
     OR (v_company_id IS NOT NULL AND name LIKE (v_company_id::text || '/%'));

  -- 2. Remove todos os dados operacionais e financeiros vinculados ao usuário e à sua farm
  DELETE FROM public.spartan_printer_events
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_inventory_events
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_projects
  WHERE user_id = p_target_user_id OR created_by = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_printers
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_filaments
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_invoices
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_subscriptions
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_ai_usage_logs
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_ai_conversations
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_notifications
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_push_subscriptions
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_user_settings
  WHERE user_id = p_target_user_id;

  DELETE FROM public.spartan_company_memberships
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_profiles
  WHERE id = p_target_user_id OR user_id = p_target_user_id;

  IF v_company_id IS NOT NULL THEN
    DELETE FROM public.spartan_companies
    WHERE id = v_company_id
      AND NOT EXISTS (
        SELECT 1 FROM public.spartan_profiles p WHERE p.company_id = v_company_id
      );
  END IF;

  DELETE FROM public.spartan_companies
  WHERE user_id = p_target_user_id;

  -- 3. Remove identidades e conta de autenticação em auth.users
  -- Isso encerra todas as sessões e libera o e-mail para novo cadastro futuro do zero.
  DELETE FROM auth.identities WHERE user_id = p_target_user_id;
  DELETE FROM auth.users WHERE id = p_target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.spartan_admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spartan_admin_delete_user(UUID) TO authenticated;

COMMIT;
