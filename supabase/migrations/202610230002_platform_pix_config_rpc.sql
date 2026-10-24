-- =============================================================================
-- Permite que qualquer assinante/cliente autenticado obtenha a chave Pix oficial
-- da plataforma (definida pelo Administrador) para pagamento de faturas e assinaturas.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.spartan_get_platform_pix_config()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_admin_id UUID;
  v_settings JSONB;
BEGIN
  -- 1. Localiza o ID do administrador principal na tabela de acessos
  SELECT user_id INTO v_admin_id
  FROM public.spartan_platform_access
  WHERE access_role = 'admin'
  LIMIT 1;

  -- 2. Fallback por perfil com role = 'admin' ou email do proprietário
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id
    FROM public.spartan_profiles
    WHERE lower(btrim(email)) IN ('gsroboticmania@gmail.com', 'gleisson1984@hotmail.com', 'gleison@hotmail.com')
       OR role = 'admin'
    LIMIT 1;
  END IF;

  -- 3. Se encontrou o admin, busca suas configurações de pagamento em spartan_user_settings
  IF v_admin_id IS NOT NULL THEN
    SELECT payment_settings INTO v_settings
    FROM public.spartan_user_settings
    WHERE user_id = v_admin_id;

    IF v_settings IS NOT NULL THEN
      IF v_settings->'admin_pix' IS NOT NULL AND coalesce(v_settings->'admin_pix'->>'chave', '') <> '' THEN
        RETURN v_settings->'admin_pix';
      END IF;

      IF coalesce(v_settings->>'pixKey', '') <> '' THEN
        RETURN jsonb_build_object(
          'chave', v_settings->>'pixKey',
          'tipoChave', coalesce(v_settings->>'pixKeyType', 'email'),
          'nomeTitular', coalesce(v_settings->>'pixBeneficiary', 'SPARTAN 3D PRINT'),
          'cidade', coalesce(v_settings->>'pixCity', 'MANAUS')
        );
      END IF;
    END IF;
  END IF;

  -- 4. Fallback padrão com os dados reais do proprietário
  RETURN jsonb_build_object(
    'chave', 'gleisson1984@hotmail.com',
    'tipoChave', 'email',
    'nomeTitular', 'SPARTAN 3D PRINT',
    'cidade', 'MANAUS'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.spartan_get_platform_pix_config() TO authenticated, anon;
