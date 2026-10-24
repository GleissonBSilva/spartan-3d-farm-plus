-- MIGRATION: Persistir company_phone no perfil do usuário no momento do cadastro
-- Permite que novas contas já nasçam com o número de WhatsApp informado para disparos automáticos.

CREATE OR REPLACE FUNCTION public.spartan_handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
  assigned_plan TEXT;
  assigned_credits INTEGER;
  v_email_hash TEXT;
  v_is_owner_admin BOOLEAN := FALSE;
  v_initial_status TEXT := 'trialing';
  v_trial_ends TIMESTAMPTZ := now() + interval '14 days';
BEGIN
  v_is_owner_admin := lower(btrim(coalesce(NEW.email, ''))) IN (
    'gsroboticmania@gmail.com',
    'gleisson1984@hotmail.com',
    'gleison@hotmail.com'
  );

  IF v_is_owner_admin THEN
    v_initial_status := 'active';
    v_trial_ends := now() + interval '3650 days';
  ELSE
    v_email_hash := public.spartan_normalize_email_hash(NEW.email);

    IF EXISTS (SELECT 1 FROM public.spartan_used_trials WHERE email_hash = v_email_hash) THEN
      -- Cliente já utilizou o período de teste anteriormente: cria conta bloqueada aguardando ativação pelo Admin
      v_initial_status := 'overdue';
      v_trial_ends := now();
    ELSE
      -- Primeiro cadastro deste e-mail: registra o hash e concede os 14 dias de teste grátis
      INSERT INTO public.spartan_used_trials (email_hash, first_used_at)
      VALUES (v_email_hash, now())
      ON CONFLICT (email_hash) DO NOTHING;

      v_initial_status := 'trialing';
      v_trial_ends := now() + interval '14 days';
    END IF;
  END IF;

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
    company_phone,
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
    COALESCE(NEW.raw_user_meta_data->>'company_phone', ''),
    new_company_id,
    'client',
    v_initial_status,
    v_trial_ends,
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
