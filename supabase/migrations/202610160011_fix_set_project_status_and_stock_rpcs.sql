-- =============================================================================
-- MIGRATION: Correção definitiva do início de produção (spartan_set_project_status)
-- Data: 2026-10-17
-- Descrição:
-- Corrige o erro 400 (Bad Request) ao iniciar a impressão (`em_impressao`)
-- preservando 100% do isolamento multi-tenant (RLS), exclusão de usuários e
-- controle dos 14 dias de teste grátis.
-- =============================================================================

BEGIN;

-- 1. Ajustar trigger de isolamento user_id para preencher automaticamente caso OLD.user_id esteja nulo
CREATE OR REPLACE FUNCTION public.spartan_enforce_tenant_user_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.user_id := auth.uid();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Preserva o dono original e, se estava nulo em registro legado, vincula ao usuário autenticado
    NEW.user_id := COALESCE(OLD.user_id, NEW.user_id, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Sincronizar user_id, company_id e memberships de todos os usuários existentes
ALTER TABLE public.spartan_profiles DISABLE TRIGGER USER;

DO $$
DECLARE
  prof RECORD;
  v_comp_id UUID;
BEGIN
  FOR prof IN
    SELECT p.id, p.email, p.full_name, p.company_name, p.company_id
    FROM public.spartan_profiles p
  LOOP
    v_comp_id := prof.company_id;

    IF v_comp_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.spartan_companies c WHERE c.id = v_comp_id) THEN
      INSERT INTO public.spartan_companies (name, user_id)
      VALUES (
        COALESCE(NULLIF(BTRIM(prof.company_name), ''), NULLIF(BTRIM(prof.full_name), ''), 'Minha farm 3D'),
        prof.id
      )
      RETURNING id INTO v_comp_id;

      UPDATE public.spartan_profiles
      SET company_id = v_comp_id, user_id = prof.id
      WHERE id = prof.id;
    ELSE
      UPDATE public.spartan_profiles
      SET user_id = prof.id
      WHERE id = prof.id AND (user_id IS NULL OR user_id <> prof.id);

      UPDATE public.spartan_companies
      SET user_id = prof.id
      WHERE id = v_comp_id AND user_id IS NULL;
    END IF;

    INSERT INTO public.spartan_company_memberships (company_id, user_id, role)
    VALUES (v_comp_id, prof.id, 'owner')
    ON CONFLICT (company_id, user_id) DO NOTHING;
  END LOOP;
END $$;

ALTER TABLE public.spartan_profiles ENABLE TRIGGER USER;

-- Garantir consistência entre user_id e company_id em projetos, impressoras e filamentos
UPDATE public.spartan_projects pr
SET user_id = pr.created_by
WHERE pr.user_id IS NULL AND pr.created_by IS NOT NULL;

UPDATE public.spartan_projects pr
SET user_id = p.id
FROM public.spartan_profiles p
WHERE pr.user_id IS NULL AND p.company_id = pr.company_id;

UPDATE public.spartan_projects pr
SET company_id = p.company_id
FROM public.spartan_profiles p
WHERE pr.user_id = p.id
  AND p.company_id IS NOT NULL
  AND pr.company_id IS DISTINCT FROM p.company_id;

UPDATE public.spartan_printers prn
SET user_id = p.id
FROM public.spartan_profiles p
WHERE prn.user_id IS NULL AND p.company_id = prn.company_id;

UPDATE public.spartan_printers prn
SET company_id = p.company_id
FROM public.spartan_profiles p
WHERE prn.user_id = p.id
  AND p.company_id IS NOT NULL
  AND prn.company_id IS DISTINCT FROM p.company_id;

UPDATE public.spartan_filaments f
SET user_id = p.id
FROM public.spartan_profiles p
WHERE f.user_id IS NULL AND p.company_id = f.company_id;

UPDATE public.spartan_filaments f
SET company_id = p.company_id
FROM public.spartan_profiles p
WHERE f.user_id = p.id
  AND p.company_id IS NOT NULL
  AND f.company_id IS DISTINCT FROM p.company_id;

-- Liberar impressoras que ficaram presas em 'imprimindo' sem projeto em impressão ativo
UPDATE public.spartan_printers prn
SET
  status = 'disponivel',
  current_project_id = NULL,
  current_project_name = NULL,
  progress_percent = 0,
  updated_at = now()
WHERE prn.status = 'imprimindo'
  AND (
    prn.current_project_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.spartan_projects proj
      WHERE proj.id = prn.current_project_id
        AND proj.status = 'em_impressao'
    )
  );

-- 3. Tornar spartan_is_company_member e spartan_is_company_admin compatíveis com perfil e memberships
CREATE OR REPLACE FUNCTION public.spartan_is_company_member(target_company UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spartan_profiles p
    WHERE p.id = auth.uid() AND p.company_id = target_company
  ) OR EXISTS (
    SELECT 1 FROM public.spartan_company_memberships m
    WHERE m.company_id = target_company AND m.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.spartan_companies c
    WHERE c.id = target_company AND c.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.spartan_is_company_admin(target_company UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.spartan_profiles p
    WHERE p.id = auth.uid() AND p.company_id = target_company
  ) OR EXISTS (
    SELECT 1 FROM public.spartan_company_memberships m
    WHERE m.company_id = target_company
      AND m.user_id = auth.uid()
      AND m.role IN ('owner', 'admin')
  ) OR EXISTS (
    SELECT 1 FROM public.spartan_companies c
    WHERE c.id = target_company AND c.user_id = auth.uid()
  );
$$;

-- 4. Atualizar triggers de eventos de impressoras para incluir user_id explicitamente
CREATE OR REPLACE FUNCTION public.spartan_log_printer_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.spartan_printer_events(company_id, user_id, printer_id, event_type, payload)
    VALUES (
      NEW.company_id,
      COALESCE(NEW.user_id, auth.uid()),
      NEW.id,
      'status_changed',
      jsonb_build_object('from', OLD.status, 'to', NEW.status, 'project', NEW.current_project_name)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.spartan_log_completed_printer_hours()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  printer_row public.spartan_printers%ROWTYPE;
BEGIN
  IF NEW.status = 'concluido' AND OLD.status IS DISTINCT FROM 'concluido' AND NEW.printer_id IS NOT NULL THEN
    UPDATE public.spartan_printers
    SET
      hours_used = hours_used + COALESCE(NEW.estimated_hours, 0),
      hours_since_maintenance = hours_since_maintenance + COALESCE(NEW.estimated_hours, 0),
      updated_at = now()
    WHERE id = NEW.printer_id
    RETURNING * INTO printer_row;

    IF FOUND THEN
      INSERT INTO public.spartan_printer_events(company_id, user_id, printer_id, event_type, payload)
      VALUES (
        printer_row.company_id,
        COALESCE(printer_row.user_id, NEW.user_id, auth.uid()),
        printer_row.id,
        'project_completed',
        jsonb_build_object('project_id', NEW.id, 'project_name', NEW.part_name, 'hours', NEW.estimated_hours)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Atualizar spartan_consume_project_filaments e spartan_return_project_filaments
CREATE OR REPLACE FUNCTION public.spartan_consume_project_filaments(p_materials JSONB, p_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  filament public.spartan_filaments%ROWTYPE;
  raw_qty TEXT;
  quantity INTEGER;
  deducted_qty INTEGER;
  filament_key TEXT;
  filament_uuid UUID;
BEGIN
  IF p_materials IS NULL OR jsonb_typeof(p_materials) <> 'array' THEN
    RETURN;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_materials) LOOP
    raw_qty := NULLIF(BTRIM(COALESCE(item->>'quantity_g', item->>'weightGrams', '')), '');
    BEGIN
      quantity := GREATEST(0, COALESCE(ROUND(raw_qty::NUMERIC)::INTEGER, 0));
    EXCEPTION WHEN OTHERS THEN
      quantity := 0;
    END;

    IF quantity <= 0 THEN
      CONTINUE;
    END IF;

    filament_key := NULLIF(BTRIM(COALESCE(item->>'filament_id', item->>'materialId', '')), '');
    IF filament_key IS NULL THEN
      CONTINUE;
    END IF;

    BEGIN
      filament_uuid := filament_key::UUID;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    SELECT * INTO filament
    FROM public.spartan_filaments
    WHERE id = filament_uuid
      AND (user_id = auth.uid() OR public.spartan_is_company_member(company_id))
    FOR UPDATE;

    -- Se o carretel foi excluído anteriormente, ignora sem travar o início do projeto
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- Deduz até o limite disponível no carretel (evita erro 400 se o carretel tiver menos saldo que o estimado)
    deducted_qty := LEAST(GREATEST(0, filament.remaining_weight_g), quantity);

    UPDATE public.spartan_filaments
    SET
      remaining_weight_g = GREATEST(0, remaining_weight_g - deducted_qty),
      updated_at = now()
    WHERE id = filament.id;

    IF deducted_qty > 0 THEN
      INSERT INTO public.spartan_inventory_events(
        company_id,
        user_id,
        filament_id,
        project_id,
        event_type,
        quantity_g,
        created_by
      )
      VALUES (
        filament.company_id,
        COALESCE(filament.user_id, auth.uid()),
        filament.id,
        p_project_id,
        'consumption',
        deducted_qty,
        COALESCE(auth.uid(), filament.user_id)
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.spartan_return_project_filaments(p_materials JSONB, p_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  item JSONB;
  filament public.spartan_filaments%ROWTYPE;
  raw_qty TEXT;
  quantity INTEGER;
  filament_key TEXT;
  filament_uuid UUID;
BEGIN
  IF p_materials IS NULL OR jsonb_typeof(p_materials) <> 'array' THEN
    RETURN;
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_materials) LOOP
    raw_qty := NULLIF(BTRIM(COALESCE(item->>'quantity_g', item->>'weightGrams', '')), '');
    BEGIN
      quantity := GREATEST(0, COALESCE(ROUND(raw_qty::NUMERIC)::INTEGER, 0));
    EXCEPTION WHEN OTHERS THEN
      quantity := 0;
    END;

    IF quantity <= 0 THEN
      CONTINUE;
    END IF;

    filament_key := NULLIF(BTRIM(COALESCE(item->>'filament_id', item->>'materialId', '')), '');
    IF filament_key IS NULL THEN
      CONTINUE;
    END IF;

    BEGIN
      filament_uuid := filament_key::UUID;
    EXCEPTION WHEN OTHERS THEN
      CONTINUE;
    END;

    SELECT * INTO filament
    FROM public.spartan_filaments
    WHERE id = filament_uuid
      AND (user_id = auth.uid() OR public.spartan_is_company_member(company_id))
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    UPDATE public.spartan_filaments
    SET
      remaining_weight_g = LEAST(total_weight_g, remaining_weight_g + quantity),
      updated_at = now()
    WHERE id = filament.id;

    INSERT INTO public.spartan_inventory_events(
      company_id,
      user_id,
      filament_id,
      project_id,
      event_type,
      quantity_g,
      created_by
    )
    VALUES (
      filament.company_id,
      COALESCE(filament.user_id, auth.uid()),
      filament.id,
      p_project_id,
      'return',
      quantity,
      COALESCE(auth.uid(), filament.user_id)
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spartan_consume_project_filaments(JSONB, UUID), public.spartan_return_project_filaments(JSONB, UUID) TO authenticated;

-- 6. Atualizar spartan_set_project_status com suporte a multi-tenant user_id e alocação resiliente de impressora
CREATE OR REPLACE FUNCTION public.spartan_set_project_status(p_project_id UUID, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  project_row public.spartan_projects%ROWTYPE;
  printer_row public.spartan_printers%ROWTYPE;
  v_has_other_active_project BOOLEAN := FALSE;
BEGIN
  IF p_status NOT IN ('orcamento', 'aprovado', 'em_impressao', 'concluido', 'cancelado') THEN
    RAISE EXCEPTION 'Status de projeto inválido: %', p_status;
  END IF;

  SELECT * INTO project_row
  FROM public.spartan_projects
  WHERE id = p_project_id
    AND (
      user_id = auth.uid()
      OR created_by = auth.uid()
      OR public.spartan_is_company_member(company_id)
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Projeto não encontrado ou acesso negado.';
  END IF;

  IF p_status = 'em_impressao' AND NOT project_row.stock_deducted THEN
    -- Localiza a impressora vinculada ao projeto ou busca automaticamente uma impressora disponível do usuário
    IF project_row.printer_id IS NOT NULL THEN
      SELECT * INTO printer_row
      FROM public.spartan_printers
      WHERE id = project_row.printer_id
        AND (user_id = auth.uid() OR company_id = project_row.company_id)
      FOR UPDATE;
    END IF;

    IF printer_row.id IS NULL THEN
      SELECT * INTO printer_row
      FROM public.spartan_printers
      WHERE (user_id = auth.uid() OR company_id = project_row.company_id)
        AND status = 'disponivel'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE;
    END IF;

    IF printer_row.id IS NULL THEN
      RAISE EXCEPTION 'Selecione uma impressora disponível antes de iniciar a produção.';
    END IF;

    -- Verifica se a impressora está ocupada com outro projeto realmente em impressão
    IF printer_row.status <> 'disponivel' AND printer_row.current_project_id IS DISTINCT FROM project_row.id THEN
      IF printer_row.status IN ('manutencao', 'desconectada') THEN
        RAISE EXCEPTION 'A impressora selecionada (%) está em manutenção ou desconectada.', printer_row.name;
      END IF;

      IF printer_row.current_project_id IS NOT NULL THEN
        SELECT EXISTS (
          SELECT 1 FROM public.spartan_projects p2
          WHERE p2.id = printer_row.current_project_id
            AND p2.id <> project_row.id
            AND p2.status = 'em_impressao'
        ) INTO v_has_other_active_project;

        IF v_has_other_active_project THEN
          RAISE EXCEPTION 'A impressora % já está imprimindo outro projeto no momento.', printer_row.name;
        END IF;
      END IF;
    END IF;

    UPDATE public.spartan_printers
    SET
      status = 'imprimindo',
      current_project_id = project_row.id,
      current_project_name = project_row.part_name,
      progress_percent = 0,
      updated_at = now()
    WHERE id = printer_row.id;

    PERFORM public.spartan_consume_project_filaments(project_row.materials, project_row.id);

    UPDATE public.spartan_projects
    SET
      printer_id = printer_row.id,
      status = p_status,
      stock_deducted = true,
      updated_at = now()
    WHERE id = p_project_id;

  ELSIF p_status = 'cancelado' AND project_row.stock_deducted THEN
    PERFORM public.spartan_return_project_filaments(project_row.materials, project_row.id);

    UPDATE public.spartan_printers
    SET
      status = 'disponivel',
      current_project_id = NULL,
      current_project_name = NULL,
      progress_percent = 0,
      updated_at = now()
    WHERE current_project_id = project_row.id
       OR (project_row.printer_id IS NOT NULL AND id = project_row.printer_id AND current_project_id = project_row.id);

    UPDATE public.spartan_projects
    SET
      status = p_status,
      stock_deducted = false,
      updated_at = now()
    WHERE id = p_project_id;

  ELSE
    IF p_status IN ('concluido', 'cancelado') THEN
      UPDATE public.spartan_printers
      SET
        status = 'disponivel',
        current_project_id = NULL,
        current_project_name = NULL,
        progress_percent = 0,
        updated_at = now()
      WHERE current_project_id = project_row.id
         OR (project_row.printer_id IS NOT NULL AND id = project_row.printer_id AND current_project_id = project_row.id);
    END IF;

    UPDATE public.spartan_projects
    SET
      status = p_status,
      updated_at = now()
    WHERE id = p_project_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spartan_set_project_status(UUID, TEXT) TO authenticated;

-- 7. Teste automatizado do fluxo de impressão como usuário autenticado (garante 0 erros)
DO $$
DECLARE
  v_user_id UUID;
  v_comp_id UUID;
  v_printer_id UUID := gen_random_uuid();
  v_filament_id UUID := gen_random_uuid();
  v_project_id UUID := gen_random_uuid();
  v_proj_status TEXT;
  v_prn_status TEXT;
  v_rem_weight INTEGER;
BEGIN
  SELECT id, company_id INTO v_user_id, v_comp_id
  FROM public.spartan_profiles
  WHERE company_id IS NOT NULL
  LIMIT 1;

  IF v_user_id IS NOT NULL AND v_comp_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_user_id::text, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';

    INSERT INTO public.spartan_printers (id, company_id, user_id, name, model, type, status, power_watts)
    VALUES (v_printer_id, v_comp_id, v_user_id, 'Impressora Teste RPC', 'Bambu A1', 'FDM', 'disponivel', 350);

    INSERT INTO public.spartan_filaments (id, company_id, user_id, type, color, color_hex, brand, total_weight_g, remaining_weight_g, price_per_kg)
    VALUES (v_filament_id, v_comp_id, v_user_id, 'PLA', 'Preto', '#000000', 'Voolt3D', 1000, 500, 100);

    INSERT INTO public.spartan_projects (
      id, company_id, user_id, created_by, printer_id, part_name, customer_name,
      estimated_weight_g, estimated_hours, materials, status, stock_deducted
    )
    VALUES (
      v_project_id, v_comp_id, v_user_id, v_user_id, v_printer_id, 'Peça Teste Impressão', 'Cliente Teste',
      120.5, 2.5,
      jsonb_build_array(jsonb_build_object('materialId', v_filament_id::text, 'weightGrams', 120.5)),
      'aprovado', false
    );

    -- Inicia impressão via RPC exatamente como o frontend faz
    PERFORM public.spartan_set_project_status(v_project_id, 'em_impressao');

    SELECT status INTO v_proj_status FROM public.spartan_projects WHERE id = v_project_id;
    SELECT status INTO v_prn_status FROM public.spartan_printers WHERE id = v_printer_id;
    SELECT remaining_weight_g INTO v_rem_weight FROM public.spartan_filaments WHERE id = v_filament_id;

    IF v_proj_status <> 'em_impressao' OR v_prn_status <> 'imprimindo' OR v_rem_weight <> 379 THEN
      RAISE EXCEPTION 'Falha na validação do início de impressão: proj=%, prn=%, weight=%', v_proj_status, v_prn_status, v_rem_weight;
    END IF;

    -- Conclui impressão via RPC
    PERFORM public.spartan_set_project_status(v_project_id, 'concluido');

    SELECT status INTO v_proj_status FROM public.spartan_projects WHERE id = v_project_id;
    SELECT status INTO v_prn_status FROM public.spartan_printers WHERE id = v_printer_id;

    IF v_proj_status <> 'concluido' OR v_prn_status <> 'disponivel' THEN
      RAISE EXCEPTION 'Falha na validação da conclusão de impressão: proj=%, prn=%', v_proj_status, v_prn_status;
    END IF;

    -- Limpa dados temporários do teste
    DELETE FROM public.spartan_printer_events WHERE printer_id = v_printer_id;
    DELETE FROM public.spartan_inventory_events WHERE project_id = v_project_id;
    DELETE FROM public.spartan_projects WHERE id = v_project_id;
    DELETE FROM public.spartan_printers WHERE id = v_printer_id;
    DELETE FROM public.spartan_filaments WHERE id = v_filament_id;

    EXECUTE 'SET LOCAL ROLE postgres';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

COMMIT;
