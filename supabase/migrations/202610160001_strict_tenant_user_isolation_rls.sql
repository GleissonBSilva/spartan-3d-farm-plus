-- =============================================================================
-- [CRÍTICO / SEGURANÇA] Isolamento Total Multi-Tenant (RLS Estrito por user_id)
-- Garante que nenhum usuário visualize, edite, liste ou receba dados de terceiros.
-- =============================================================================

BEGIN;

-- 1. Tabela dedicada de configurações isoladas por usuário/farm (Pagamentos, Chave Pix, Taxas e Aparência)
CREATE TABLE IF NOT EXISTS public.spartan_user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  company_id UUID REFERENCES public.spartan_companies(id) ON DELETE CASCADE,
  payment_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  theme_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Garantir coluna user_id em 100% das tabelas do sistema e colunas de ROI nas impressoras
ALTER TABLE public.spartan_companies
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

ALTER TABLE public.spartan_profiles
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

ALTER TABLE public.spartan_filaments
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

ALTER TABLE public.spartan_printers
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2) NOT NULL DEFAULT 5000 CHECK (purchase_price >= 0),
  ADD COLUMN IF NOT EXISTS lifespan_hours INTEGER NOT NULL DEFAULT 5000 CHECK (lifespan_hours > 0),
  ADD COLUMN IF NOT EXISTS hourly_depreciation NUMERIC(12,2) NOT NULL DEFAULT 1.00 CHECK (hourly_depreciation >= 0);

ALTER TABLE public.spartan_projects
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

ALTER TABLE public.spartan_inventory_events
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

ALTER TABLE public.spartan_printer_events
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

ALTER TABLE public.spartan_invoices
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.spartan_ai_conversations
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.spartan_notifications
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE public.spartan_push_subscriptions
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 3. Desfazer qualquer compartilhamento acidental de company_id entre usuários distintos
DO $$
DECLARE
  dup RECORD;
  new_comp_id UUID;
BEGIN
  FOR dup IN
    SELECT p.id AS profile_id, p.company_name, p.company_id
    FROM public.spartan_profiles p
    WHERE p.company_id IS NULL
       OR EXISTS (
         SELECT 1 FROM public.spartan_profiles p2
         WHERE p2.company_id = p.company_id
           AND p2.id <> p.id
           AND p2.created_at < p.created_at
       )
  LOOP
    INSERT INTO public.spartan_companies(name, user_id)
    VALUES (COALESCE(NULLIF(TRIM(dup.company_name), ''), 'Minha farm 3D'), dup.profile_id)
    RETURNING id INTO new_comp_id;

    -- Desabilita temporariamente trigger de proteção apenas durante migração administrativa
    ALTER TABLE public.spartan_profiles DISABLE TRIGGER USER;
    UPDATE public.spartan_profiles
    SET company_id = new_comp_id, user_id = dup.profile_id
    WHERE id = dup.profile_id;
    ALTER TABLE public.spartan_profiles ENABLE TRIGGER USER;

    DELETE FROM public.spartan_company_memberships WHERE user_id = dup.profile_id;
    INSERT INTO public.spartan_company_memberships(company_id, user_id, role)
    VALUES (new_comp_id, dup.profile_id, 'owner')
    ON CONFLICT (company_id, user_id) DO NOTHING;
  END LOOP;
END $$;

-- 4. Backfill de user_id para registros existentes garantindo posse estrita
ALTER TABLE public.spartan_profiles DISABLE TRIGGER USER;
UPDATE public.spartan_profiles SET user_id = id WHERE user_id IS NULL OR user_id <> id;
ALTER TABLE public.spartan_profiles ENABLE TRIGGER USER;

UPDATE public.spartan_companies c
SET user_id = p.id
FROM public.spartan_profiles p
WHERE p.company_id = c.id AND c.user_id IS NULL;

UPDATE public.spartan_projects pr
SET user_id = COALESCE(pr.created_by, p.id)
FROM public.spartan_profiles p
WHERE p.company_id = pr.company_id AND pr.user_id IS NULL;

UPDATE public.spartan_filaments f
SET user_id = p.id
FROM public.spartan_profiles p
WHERE p.company_id = f.company_id AND f.user_id IS NULL;

UPDATE public.spartan_printers prn
SET user_id = p.id
FROM public.spartan_profiles p
WHERE p.company_id = prn.company_id AND prn.user_id IS NULL;

UPDATE public.spartan_inventory_events ie
SET user_id = COALESCE(ie.created_by, p.id)
FROM public.spartan_profiles p
WHERE p.company_id = ie.company_id AND ie.user_id IS NULL;

UPDATE public.spartan_printer_events pe
SET user_id = prn.user_id
FROM public.spartan_printers prn
WHERE prn.id = pe.printer_id AND pe.user_id IS NULL AND prn.user_id IS NOT NULL;

UPDATE public.spartan_printer_events pe
SET user_id = p.id
FROM public.spartan_profiles p
WHERE p.company_id = pe.company_id AND pe.user_id IS NULL;

INSERT INTO public.spartan_user_settings (user_id, company_id)
SELECT p.id, p.company_id
FROM public.spartan_profiles p
ON CONFLICT (user_id) DO UPDATE SET company_id = EXCLUDED.company_id;

-- 5. Índices de performance por user_id
CREATE INDEX IF NOT EXISTS idx_spartan_companies_user_id ON public.spartan_companies(user_id);
CREATE INDEX IF NOT EXISTS idx_spartan_profiles_user_id ON public.spartan_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_spartan_filaments_user_id ON public.spartan_filaments(user_id);
CREATE INDEX IF NOT EXISTS idx_spartan_printers_user_id ON public.spartan_printers(user_id);
CREATE INDEX IF NOT EXISTS idx_spartan_projects_user_id ON public.spartan_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_spartan_inventory_events_user_id ON public.spartan_inventory_events(user_id);
CREATE INDEX IF NOT EXISTS idx_spartan_printer_events_user_id ON public.spartan_printer_events(user_id);
CREATE INDEX IF NOT EXISTS idx_spartan_invoices_user_id ON public.spartan_invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_spartan_ai_conversations_user_id ON public.spartan_ai_conversations(user_id);

-- 6. Atualizar função de criação de novo usuário para provisionar ambiente 100% limpo e isolado
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

  INSERT INTO public.spartan_profiles(id, user_id, email, full_name, company_name, company_id, role, plan_id, ai_credits_remaining)
  VALUES (
    NEW.id,
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'company_name'), ''), 'Minha farm 3D'),
    new_company_id,
    'client',
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

-- 7. Trigger de Segurança para injetar automaticamente user_id = auth.uid() e bloquear falsificação de posse
CREATE OR REPLACE FUNCTION public.spartan_enforce_tenant_user_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.user_id := auth.uid();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Impede que qualquer update altere o dono do registro
    NEW.user_id := OLD.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  tbl TEXT;
  tenant_tables TEXT[] := ARRAY[
    'spartan_companies',
    'spartan_user_settings',
    'spartan_filaments',
    'spartan_printers',
    'spartan_projects',
    'spartan_inventory_events',
    'spartan_printer_events',
    'spartan_ai_conversations',
    'spartan_push_subscriptions'
  ];
BEGIN
  FOREACH tbl IN ARRAY tenant_tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_user_id_%I ON public.%I;', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_enforce_user_id_%I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.spartan_enforce_tenant_user_id();',
      tbl, tbl
    );
  END LOOP;
END $$;

-- 8. Atualizar RPCs operacionais para validar estritamente user_id = auth.uid()
CREATE OR REPLACE FUNCTION public.spartan_consume_filaments(p_materials JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  item JSONB;
  filament public.spartan_filaments%ROWTYPE;
  quantity INTEGER;
BEGIN
  FOR item IN SELECT value FROM jsonb_array_elements(p_materials) LOOP
    quantity := GREATEST(0, COALESCE((item->>'quantity_g')::INTEGER, 0));
    IF quantity = 0 THEN CONTINUE; END IF;
    SELECT * INTO filament
    FROM public.spartan_filaments
    WHERE id = (item->>'filament_id')::UUID
      AND user_id = auth.uid()
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Filamento não encontrado ou acesso negado.'; END IF;
    IF filament.remaining_weight_g < quantity THEN RAISE EXCEPTION 'Estoque insuficiente para %', filament.color; END IF;
    UPDATE public.spartan_filaments
    SET remaining_weight_g = remaining_weight_g - quantity, updated_at = now()
    WHERE id = filament.id AND user_id = auth.uid();
    INSERT INTO public.spartan_inventory_events(company_id, user_id, filament_id, event_type, quantity_g, created_by)
    VALUES (filament.company_id, auth.uid(), filament.id, 'consumption', quantity, auth.uid());
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.spartan_return_filaments(p_materials JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  item JSONB;
  filament public.spartan_filaments%ROWTYPE;
  quantity INTEGER;
BEGIN
  FOR item IN SELECT value FROM jsonb_array_elements(p_materials) LOOP
    quantity := GREATEST(0, COALESCE((item->>'quantity_g')::INTEGER, 0));
    IF quantity = 0 THEN CONTINUE; END IF;
    SELECT * INTO filament
    FROM public.spartan_filaments
    WHERE id = (item->>'filament_id')::UUID
      AND user_id = auth.uid()
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Filamento não encontrado ou acesso negado.'; END IF;
    UPDATE public.spartan_filaments
    SET remaining_weight_g = LEAST(total_weight_g, remaining_weight_g + quantity), updated_at = now()
    WHERE id = filament.id AND user_id = auth.uid();
    INSERT INTO public.spartan_inventory_events(company_id, user_id, filament_id, event_type, quantity_g, created_by)
    VALUES (filament.company_id, auth.uid(), filament.id, 'return', quantity, auth.uid());
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.spartan_set_printer_status(p_printer_id UUID, p_status TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  printer_row public.spartan_printers%ROWTYPE;
BEGIN
  IF p_status NOT IN ('imprimindo', 'pausada', 'disponivel', 'manutencao', 'desconectada') THEN
    RAISE EXCEPTION 'Status de impressora inválido.';
  END IF;
  SELECT * INTO printer_row
  FROM public.spartan_printers
  WHERE id = p_printer_id AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Impressora não encontrada ou acesso negado.'; END IF;
  IF printer_row.current_project_id IS NOT NULL AND p_status IN ('disponivel', 'manutencao', 'desconectada') THEN
    RAISE EXCEPTION 'Conclua ou cancele o projeto atual antes de alterar o status da impressora.';
  END IF;
  IF printer_row.current_project_id IS NULL AND p_status = 'pausada' THEN
    RAISE EXCEPTION 'Não há projeto ativo para pausar.';
  END IF;
  UPDATE public.spartan_printers
  SET status = p_status, updated_at = now()
  WHERE id = p_printer_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.spartan_update_printer_progress(p_printer_id UUID, p_progress INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  printer_row public.spartan_printers%ROWTYPE;
BEGIN
  IF p_progress < 0 OR p_progress > 100 THEN RAISE EXCEPTION 'O progresso deve estar entre 0 e 100.'; END IF;
  SELECT * INTO printer_row
  FROM public.spartan_printers
  WHERE id = p_printer_id AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Impressora não encontrada ou acesso negado.'; END IF;
  IF printer_row.current_project_id IS NULL THEN RAISE EXCEPTION 'Não há projeto ativo nesta impressora.'; END IF;
  UPDATE public.spartan_printers
  SET progress_percent = p_progress, updated_at = now()
  WHERE id = p_printer_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.spartan_record_printer_maintenance(p_printer_id UUID, p_tasks TEXT[], p_note TEXT DEFAULT '')
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  printer_row public.spartan_printers%ROWTYPE;
BEGIN
  SELECT * INTO printer_row
  FROM public.spartan_printers
  WHERE id = p_printer_id AND user_id = auth.uid()
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Impressora não encontrada ou acesso negado.'; END IF;
  IF printer_row.current_project_id IS NOT NULL THEN
    RAISE EXCEPTION 'Conclua ou cancele o projeto atual antes de registrar manutenção.';
  END IF;
  UPDATE public.spartan_printers
  SET status = 'disponivel', hours_since_maintenance = 0, updated_at = now()
  WHERE id = p_printer_id AND user_id = auth.uid();
  INSERT INTO public.spartan_printer_events(company_id, user_id, printer_id, event_type, payload)
  VALUES (
    printer_row.company_id,
    auth.uid(),
    printer_row.id,
    'maintenance_completed',
    jsonb_build_object('tasks', COALESCE(p_tasks, ARRAY[]::TEXT[]), 'note', COALESCE(p_note, ''), 'completed_at', now())
  );
END;
$$;

-- 9. Ativar e Forçar Row Level Security (RLS) em 100% das tabelas e aplicar política estrita por auth.uid() = user_id
DO $$
DECLARE
  tbl TEXT;
  pol RECORD;
  strict_user_tables TEXT[] := ARRAY[
    'spartan_companies',
    'spartan_company_memberships',
    'spartan_user_settings',
    'spartan_filaments',
    'spartan_printers',
    'spartan_projects',
    'spartan_inventory_events',
    'spartan_printer_events',
    'spartan_ai_conversations',
    'spartan_notifications',
    'spartan_push_subscriptions'
  ];
BEGIN
  FOREACH tbl IN ARRAY strict_user_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', tbl);

    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, tbl);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY "Acesso restrito ao proprietario" ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);',
      tbl
    );
  END LOOP;
END $$;

-- 10. RLS em spartan_profiles (isolado por proprietário; admin da plataforma acessa apenas dados de assinatura do SaaS)
ALTER TABLE public.spartan_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spartan_profiles FORCE ROW LEVEL SECURITY;
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'spartan_profiles' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.spartan_profiles;', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Acesso restrito ao proprietario"
ON public.spartan_profiles
FOR ALL
TO authenticated
USING (auth.uid() = id AND auth.uid() = user_id)
WITH CHECK (auth.uid() = id AND auth.uid() = user_id);

CREATE POLICY "Admin plataforma gerencia assinaturas"
ON public.spartan_profiles
FOR SELECT
TO authenticated
USING (public.spartan_is_platform_admin());

CREATE POLICY "Admin plataforma atualiza status assinatura"
ON public.spartan_profiles
FOR UPDATE
TO authenticated
USING (public.spartan_is_platform_admin())
WITH CHECK (public.spartan_is_platform_admin());

-- 11. RLS em spartan_invoices (cada usuário vê apenas suas faturas; admin da plataforma gerencia cobranças de assinatura)
ALTER TABLE public.spartan_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spartan_invoices FORCE ROW LEVEL SECURITY;
DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'spartan_invoices' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.spartan_invoices;', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Acesso restrito ao proprietario"
ON public.spartan_invoices
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin plataforma gerencia faturas"
ON public.spartan_invoices
FOR ALL
TO authenticated
USING (public.spartan_is_platform_admin())
WITH CHECK (public.spartan_is_platform_admin());

-- 12. Garantir permissões para spartan_user_settings
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spartan_user_settings TO authenticated;

COMMIT;
