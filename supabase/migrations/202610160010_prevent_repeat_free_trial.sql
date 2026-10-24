-- =============================================================================
-- MIGRATION: Controle Ultraleve Anti-Reutilização dos 14 Dias de Teste Grátis
-- Data: 2026-10-17
-- Descrição:
-- Armazena apenas o hash SHA-256 (64 bytes) do e-mail normalizado na tabela
-- `public.spartan_used_trials`.
-- - Impacto no banco: ~80 bytes por registro (< 1 MB para 10.000 ex-clientes).
-- - LGPD Compliance: Nenhum dado pessoal em texto claro permanece após a exclusão.
-- - Anti-Alias: Remove sufixos `+alias` e pontos no Gmail antes de gerar o hash.
-- - Quando um usuário excluído cria uma nova conta com o mesmo e-mail, a conta
--   é criada sem direito aos 14 dias grátis (`status = 'overdue'`, `trial_ends_at = now()`),
--   ficando bloqueada até que o Admin ative após o pagamento.
-- =============================================================================

BEGIN;

-- 1. Função de normalização e hash SHA-256 do e-mail (bloqueia truques como +1 ou pontos no Gmail)
CREATE OR REPLACE FUNCTION public.spartan_normalize_email_hash(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_clean TEXT;
  v_local TEXT;
  v_domain TEXT;
BEGIN
  v_clean := lower(btrim(coalesce(p_email, '')));
  IF v_clean = '' OR position('@' in v_clean) = 0 THEN
    RETURN encode(sha256(convert_to(v_clean, 'UTF8')), 'hex');
  END IF;

  v_local := split_part(v_clean, '@', 1);
  v_domain := split_part(v_clean, '@', 2);

  -- Remove qualquer sufixo após '+' (ex: usuario+teste2@gmail.com -> usuario@gmail.com)
  v_local := split_part(v_local, '+', 1);

  -- Normaliza domínios do Google (ignora pontos na parte local)
  IF v_domain IN ('gmail.com', 'googlemail.com') THEN
    v_local := replace(v_local, '.', '');
    v_domain := 'gmail.com';
  END IF;

  RETURN encode(sha256(convert_to(v_local || '@' || v_domain, 'UTF8')), 'hex');
END;
$$;

-- 2. Tabela ultraleve de controle de testes já utilizados (~80 bytes por linha)
CREATE TABLE IF NOT EXISTS public.spartan_used_trials (
  email_hash TEXT PRIMARY KEY,
  first_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.spartan_used_trials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spartan_used_trials_admin_only" ON public.spartan_used_trials;
CREATE POLICY "spartan_used_trials_admin_only"
  ON public.spartan_used_trials
  FOR ALL
  USING (public.spartan_is_platform_admin())
  WITH CHECK (public.spartan_is_platform_admin());

-- Preenche com os hashes das contas de clientes já existentes
INSERT INTO public.spartan_used_trials (email_hash, first_used_at)
SELECT DISTINCT
  public.spartan_normalize_email_hash(p.email),
  COALESCE(p.created_at, now())
FROM public.spartan_profiles p
WHERE coalesce(btrim(p.email), '') <> ''
  AND p.role <> 'admin'
  AND lower(btrim(p.email)) NOT IN ('gsroboticmania@gmail.com', 'gleisson1984@hotmail.com', 'gleison@hotmail.com')
  AND NOT EXISTS (
    SELECT 1 FROM public.spartan_platform_access pa
    WHERE pa.user_id = p.id AND pa.access_role IN ('admin', 'developer')
  )
ON CONFLICT (email_hash) DO NOTHING;

-- 3. Atualiza o trigger de criação de usuário (spartan_handle_new_user)
-- Se o email_hash já estiver em spartan_used_trials, nasce bloqueado ('overdue') sem novos 14 dias!
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

-- 4. Atualiza spartan_admin_delete_user para garantir que o hash do e-mail excluído
-- fique gravado em spartan_used_trials antes de remover os dados do usuário
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
  v_target_email TEXT;
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

  SELECT lower(coalesce(email, '')) INTO v_target_email
  FROM public.spartan_profiles
  WHERE id = p_target_user_id;

  IF v_target_email = '' OR v_target_email IS NULL THEN
    SELECT lower(coalesce(email, '')) INTO v_target_email
    FROM auth.users
    WHERE id = p_target_user_id;
  END IF;

  IF v_target_email = 'gsroboticmania@gmail.com' OR EXISTS (
    SELECT 1 FROM public.spartan_platform_access
    WHERE user_id = p_target_user_id AND access_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Não é permitido excluir a conta principal de administrador da plataforma.';
  END IF;

  -- Registra o hash do e-mail em spartan_used_trials antes de excluir para impedir novos 14 dias grátis
  IF coalesce(btrim(v_target_email), '') <> '' THEN
    INSERT INTO public.spartan_used_trials (email_hash, first_used_at)
    VALUES (public.spartan_normalize_email_hash(v_target_email), now())
    ON CONFLICT (email_hash) DO NOTHING;
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

  -- 4. Limpa dinamicamente qualquer tabela em `public` que possua FK apontando para spartan_profiles ou auth.users
  v_step := 'cleanup_user_fks';
  FOR r_fk IN
    SELECT DISTINCT c.relname AS table_name, a.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(con.conkey)
    WHERE con.confrelid IN ('public.spartan_profiles'::regclass, 'auth.users'::regclass)
      AND n.nspname = 'public'
      AND c.relname NOT IN ('spartan_profiles', 'spartan_companies')
  LOOP
    EXECUTE format(
      'DELETE FROM public.%I WHERE %I = $1',
      r_fk.table_name,
      r_fk.column_name
    ) USING p_target_user_id;
  END LOOP;

  v_step := 'delete_profiles';
  DELETE FROM public.spartan_profiles
  WHERE id = p_target_user_id;

  -- 5. Se a company era exclusiva deste usuário, limpa todas as referências e apaga a company
  IF v_company_id IS NOT NULL AND v_company_is_exclusive THEN
    v_step := 'cleanup_exclusive_company_refs';
    FOR r_fk IN
      SELECT DISTINCT c.relname AS table_name, a.attname AS column_name
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

  -- 6. Remove exclusivamente as identidades e a conta do usuário alvo em auth.users
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

-- 5. Teste automatizado ponta a ponta:
--    1º cadastro -> recebe 'trialing' (14 dias)
--    Admin exclui o usuário -> dados apagados, hash mantido em spartan_used_trials
--    2º cadastro com mesmo e-mail -> nasce 'overdue' (bloqueado sem novos 14 dias!)
DO $$
DECLARE
  v_admin_id UUID;
  v_uid_1 UUID := gen_random_uuid();
  v_uid_2 UUID := gen_random_uuid();
  v_test_email TEXT := 'reincidente.' || replace(v_uid_1::text, '-', '') || '@gmail.com';
  v_status_1 TEXT;
  v_status_2 TEXT;
BEGIN
  SELECT id INTO v_admin_id
  FROM public.spartan_profiles
  WHERE role = 'admin'
     OR id IN (SELECT user_id FROM public.spartan_platform_access WHERE access_role = 'admin')
  LIMIT 1;

  IF v_admin_id IS NOT NULL THEN
    -- 1º Cadastro
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      v_uid_1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_test_email, 'encrypted', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Cliente Teste 1","company_name":"Farm 1"}'::jsonb,
      now(), now()
    );

    SELECT status INTO v_status_1 FROM public.spartan_profiles WHERE id = v_uid_1;
    IF v_status_1 <> 'trialing' THEN
      RAISE EXCEPTION 'Esperado status trialing no 1º cadastro, obteve %', v_status_1;
    END IF;

    -- Admin exclui o usuário
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.spartan_admin_delete_user(v_uid_1);
    EXECUTE 'SET LOCAL ROLE postgres';

    -- 2º Cadastro com o mesmo e-mail
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      v_uid_2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_test_email, 'encrypted', now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Cliente Teste 2","company_name":"Farm 2"}'::jsonb,
      now(), now()
    );

    SELECT status INTO v_status_2 FROM public.spartan_profiles WHERE id = v_uid_2;
    IF v_status_2 <> 'overdue' THEN
      RAISE EXCEPTION 'Esperado status overdue no 2º cadastro reincidente, obteve %', v_status_2;
    END IF;

    -- Limpa o 2º usuário de teste e seu hash temporário
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.spartan_admin_delete_user(v_uid_2);
    EXECUTE 'SET LOCAL ROLE postgres';
    DELETE FROM public.spartan_used_trials WHERE email_hash = public.spartan_normalize_email_hash(v_test_email);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
