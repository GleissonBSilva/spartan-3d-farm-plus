# Configuração do Supabase

## Aplicação local

1. Copie `.env.example` para `.env` e preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` com os valores do projeto Supabase. Essas credenciais públicas só são seguras com RLS habilitado.
2. No terminal, execute `npx supabase login`, `npx supabase link --project-ref <PROJECT_REF>` e `npx supabase db push` para aplicar o esquema e as políticas RLS.
3. Cadastre o primeiro usuário pela tela de registro. Para promover uma conta de confiança a administrador da plataforma, use o SQL Editor do Supabase:

```sql
update public.spartan_profiles
set role = 'admin'
where email = 'SEU_EMAIL_DE_ADMIN';
```

4. Publique as funções Edge:

```sh
npx supabase functions deploy ai-assistant
npx supabase functions deploy invite-client
npx supabase functions deploy create-checkout
npx supabase functions deploy payment-webhook
```

## Segredos das funções

Adicione no painel Supabase em **Edge Functions → Secrets** (ou `supabase secrets set`):

- `OPENAI_API_KEY` para o assistente de IA.
- `STRIPE_SECRET_KEY` e `STRIPE_WEBHOOK_SECRET` para checkout com cartão e webhooks Stripe.
- `MERCADOPAGO_ACCESS_TOKEN` e `MERCADOPAGO_WEBHOOK_SECRET` para Pix/Boleto e webhooks Mercado Pago.
- `SUPABASE_SERVICE_ROLE_KEY` é usado apenas no runtime seguro das Edge Functions. Nunca o coloque no `.env` do Vite nem o exponha no navegador.

Configure os webhooks dos provedores para a URL da função `payment-webhook`. O endereço de webhook gerado pelo Supabase deve ser informado também no painel do provedor.

## Limites que ainda exigem configuração externa

- Push nativo registra os tokens dos dispositivos no banco. Entrega remota requer credenciais e configuração FCM/APNs, além de uma função remetente.
- O cache offline cobre o shell público do app; dados do Supabase e alterações não são armazenados para sincronização offline.
- OctoPrint/PrusaLink ainda precisam de um conector e credenciais do equipamento; esta versão não envia comandos às impressoras.
- O app funciona no navegador e tem plugins Capacitor instalados. Gere/sincronize os projetos nativos com `npx cap add android`/`npx cap add ios` (uma vez) e `npx cap sync` antes de compilar para dispositivos.
- Chaves de produção e aplicação da migration no projeto hospedado são específicas da sua conta Supabase.
