-- =============================================================================
-- MIGRATION: Limpeza de payment_settings duplicados acidentalmente entre contas
-- Data: 2026-10-16
-- =============================================================================

BEGIN;

-- Se duas contas diferentes tiverem exatamente a mesma chave Pix não-vazia em spartan_user_settings
-- (causada por abas compartilhando o mesmo localStorage antes do isolamento por sessionStorage),
-- mantém a configuração apenas na conta proprietária original (mais antiga em spartan_profiles)
-- e limpa o registro duplicado na outra conta.
WITH ranked_pix AS (
  SELECT
    us.user_id,
    us.payment_settings->>'pixKey' AS pix_key,
    ROW_NUMBER() OVER (
      PARTITION BY TRIM(LOWER(us.payment_settings->>'pixKey'))
      ORDER BY p.created_at ASC NULLS LAST, us.created_at ASC
    ) AS rn
  FROM public.spartan_user_settings us
  LEFT JOIN public.spartan_profiles p ON p.id = us.user_id
  WHERE COALESCE(TRIM(us.payment_settings->>'pixKey'), '') <> ''
)
UPDATE public.spartan_user_settings target
SET
  payment_settings = '{}'::jsonb,
  updated_at = now()
FROM ranked_pix r
WHERE target.user_id = r.user_id
  AND r.rn > 1;

COMMIT;
