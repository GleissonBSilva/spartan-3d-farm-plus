-- =============================================================================
-- MIGRATION: Coluna opcional customer_phone em spartan_projects
-- Data: 2026-10-17
-- Descrição:
-- Adiciona coluna opcional (nullable) customer_phone na tabela spartan_projects
-- para armazenar o Contato / WhatsApp do cliente na Proposta Comercial em PDF.
-- =============================================================================

BEGIN;

ALTER TABLE public.spartan_projects
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;

NOTIFY pgrst, 'reload schema';

COMMIT;
