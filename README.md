# SPARTAN 3D Print

Aplicação de gestão para farms de impressão 3D, construída com React, Vite e Supabase.

## Executar localmente no Windows

1. Instale as dependências com `npm.cmd install`.
2. Copie `.env.example` para `.env` e preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY` com os valores públicos do projeto Supabase.
3. Aplique as migrations e inicie a aplicação:

```powershell
npx.cmd supabase login
npx.cmd supabase db push
npm.cmd run dev
```

O projeto Supabase já está configurado em `supabase/config.toml`. O servidor Vite informa o endereço local no terminal.

## Acessos da conta proprietária

Depois que `gsroboticmania@gmail.com` tiver uma conta confirmada no Supabase Auth, a migration `202609300001_platform_access_and_business_owner.sql` atribui os acessos de plataforma **Admin** e **Dev**, mantém o perfil **Cliente** da própria farm e associa o plano **SPARTAN BUSINESS**. A conta pode alternar entre a administração e o painel da farm pelo menu lateral. Nenhuma senha ou chave secreta é armazenada no código.

## Configuração de serviços

Chaves de pagamento e IA devem ficar nos secrets das Supabase Edge Functions, nunca no `.env` entregue ao navegador. Consulte `.env.example` para os nomes dos secrets usados pelo projeto.

## Comandos úteis

- `npm.cmd run dev` — iniciar desenvolvimento local.
- `npm.cmd run build` — gerar build de produção.
- `npm.cmd run lint` — analisar o código com ESLint.
- `npm.cmd test` — executar os testes automatizados.
