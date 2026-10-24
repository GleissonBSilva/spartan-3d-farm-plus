-- =============================================================================
-- MIGRATION: Período de Teste de 14 Dias e Bloqueio Automático (Exceto Admins)
-- Data: 2026-10-16
-- =============================================================================

BEGIN;

-- 1. Adicionar coluna trial_ends_at em spartan_profiles (14 dias a partir do cadastro)
ALTER TABLE public.spartan_profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '14 days');

ALTER TABLE public.spartan_profiles
  ALTER COLUMN status SET DEFAULT 'trialing';

-- Preencher trial_ends_at para contas existentes com base em created_at + 14 dias
UPDATE public.spartan_profiles
SET trial_ends_at = created_at + interval '14 days'
WHERE trial_ends_at IS NULL;

-- Garantir que contas de administradores estejam sempre com status 'active'
ALTER TABLE public.spartan_profiles DISABLE TRIGGER USER;
UPDATE public.spartan_profiles p
SET status = 'active'
WHERE p.role = 'admin'
   OR EXISTS (
     SELECT 1 FROM public.spartan_platform_access pa
     WHERE pa.user_id = p.id AND pa.access_role IN ('admin', 'developer')
   );
ALTER TABLE public.spartan_profiles ENABLE TRIGGER USER;

-- 2. Atualizar spartan_handle_new_user() para iniciar novas contas de clientes em 'trialing' (14 dias)
CREATE OR REPLACE FUNCTION public.spartan_handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_company_id UUID;
  assigned_plan TEXT;
  assigned_credits INTEGER;
BEGIN
  INSERT INTO public.spartan_companies(name, user_id)
  VALUES (COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''), 'Minha farm 3D'), NEW.id)
  RETURNING id INTO new_company_id;

  assigned_plan := COALESCE(NEW.raw_user_meta_data->>'plan_id', 'plan_pro');
  SELECT ai_credits INTO assigned_credits FROM public.spartan_plans WHERE id = assigned_plan AND active;

  INSERT INTO public.spartan_profiles(
    id,
    user_id,
    email,
    full_name,
    company_name,
    company_id,
    role,
    status,
    trial_ends_at,
    plan_id,
    ai_credits_remaining
  )
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''), 'Minha farm 3D'),
    new_company_id,
    'client',
    'trialing',
    now() + interval '14 days',
    assigned_plan,
    COALESCE(assigned_credits, 25000)
  );

  INSERT INTO public.spartan_company_memberships(company_id, user_id, role)
  VALUES (new_company_id, NEW.id, 'owner');

  INSERT INTO public.spartan_user_settings(user_id, company_id, payment_settings, theme_settings)
  VALUES (NEW.id, new_company_id, '{}'::jsonb, '{}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Função que bloqueia automaticamente contas em período de teste ('trialing') após 14 dias
--    (com exceção absoluta das contas de administrador)
CREATE OR REPLACE FUNCTION public.spartan_sync_expired_trials()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE public.spartan_profiles p
  SET
    status = 'overdue',
    updated_at = now()
  WHERE p.status = 'trialing'
    AND p.role <> 'admin'
    AND NOT EXISTS (
      SELECT 1 FROM public.spartan_platform_access pa
      WHERE pa.user_id = p.id AND pa.access_role IN ('admin', 'developer')
    )
    AND COALESCE(p.trial_ends_at, p.created_at + interval '14 days') <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spartan_sync_expired_trials() TO authenticated;

-- Executa imediatamente na aplicação da migration
SELECT public.spartan_sync_expired_trials();

COMMIT;
