-- =============================================================================
-- MIGRATION: Sincronização de projetos em impressão com o Parque de Impressoras
-- e suporte a progresso numérico (decimal/inteiro) sem erro 400
-- Data: 2026-10-17
-- =============================================================================

BEGIN;

-- 1. Se houver qualquer projeto com status = 'em_impressao', garante que a impressora
-- vinculada (ou a impressora disponível do usuário) esteja marcada como 'imprimindo'
-- e com current_project_id apontando para o projeto.
DO $$
DECLARE
  proj RECORD;
  v_printer_id UUID;
BEGIN
  FOR proj IN
    SELECT p.*
    FROM public.spartan_projects p
    WHERE p.status = 'em_impressao'
    ORDER BY p.updated_at DESC
  LOOP
    v_printer_id := proj.printer_id;

    IF v_printer_id IS NULL THEN
      SELECT prn.id INTO v_printer_id
      FROM public.spartan_printers prn
      WHERE (prn.user_id = proj.user_id OR prn.company_id = proj.company_id)
        AND prn.status = 'disponivel'
      ORDER BY prn.created_at ASC
      LIMIT 1;

      IF v_printer_id IS NOT NULL THEN
        UPDATE public.spartan_projects
        SET printer_id = v_printer_id, updated_at = now()
        WHERE id = proj.id;
      END IF;
    END IF;

    IF v_printer_id IS NOT NULL THEN
      UPDATE public.spartan_printers
      SET
        status = CASE WHEN status = 'pausada' THEN 'pausada' ELSE 'imprimindo' END,
        current_project_id = proj.id,
        current_project_name = proj.part_name,
        updated_at = now()
      WHERE id = v_printer_id
        AND (current_project_id IS NULL OR current_project_id = proj.id);
    END IF;
  END LOOP;
END $$;

-- 2. Permitir que spartan_update_printer_progress receba valores decimais (ex: 12.5 do slider)
-- ou inteiros sem erro de cast, arredondando com segurança para 0..100.
DROP FUNCTION IF EXISTS public.spartan_update_printer_progress(UUID, INTEGER);
DROP FUNCTION IF EXISTS public.spartan_update_printer_progress(UUID, NUMERIC);

CREATE OR REPLACE FUNCTION public.spartan_update_printer_progress(p_printer_id UUID, p_progress NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  printer_row public.spartan_printers%ROWTYPE;
  v_progress INTEGER;
BEGIN
  v_progress := LEAST(100, GREATEST(0, COALESCE(ROUND(p_progress)::INTEGER, 0)));

  SELECT * INTO printer_row
  FROM public.spartan_printers
  WHERE id = p_printer_id
    AND (user_id = auth.uid() OR public.spartan_is_company_member(company_id))
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Impressora não encontrada ou acesso negado.';
  END IF;

  UPDATE public.spartan_printers
  SET
    progress_percent = v_progress,
    updated_at = now()
  WHERE id = printer_row.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spartan_update_printer_progress(UUID, NUMERIC) TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
