-- =============================================================================
-- MIGRATION: Persistência de Investimento, Vida Útil e Depreciação em spartan_printers
-- Data: 2026-10-17
-- Descrição:
-- Adiciona as colunas investment_cost, lifespan_hours e depreciation_per_hour
-- na tabela spartan_printers para que o Investimento e Depreciação/h não fiquem
-- zerados (R$ 0.00) no Parque de Impressoras 3D.
-- =============================================================================

BEGIN;

ALTER TABLE public.spartan_printers
  ADD COLUMN IF NOT EXISTS investment_cost NUMERIC(12, 2) NOT NULL DEFAULT 5000.00,
  ADD COLUMN IF NOT EXISTS lifespan_hours NUMERIC(12, 2) NOT NULL DEFAULT 5000.00,
  ADD COLUMN IF NOT EXISTS depreciation_per_hour NUMERIC(12, 4) NOT NULL DEFAULT 1.00;

-- Atualiza impressoras existentes que estavam sem valor de investimento configurado (0)
UPDATE public.spartan_printers
SET
  investment_cost = 5000.00,
  lifespan_hours = 5000.00,
  depreciation_per_hour = 1.00
WHERE COALESCE(investment_cost, 0) <= 0;

NOTIFY pgrst, 'reload schema';

COMMIT;
