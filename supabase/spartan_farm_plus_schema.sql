-- =============================================================================
-- SPARTAN 3D FARM PLUS - MASTER DATABASE SCHEMA & POLICIES
-- Gerado automaticamente consolidando todas as 34 migra��es oficiais
-- =============================================================================


-- >>> Migration: 202609260001_initial_schema.sql <<<
-- Spartan 3D Print: tenant scoped data model for Supabase/Postgres.
-- Run with `supabase db push` or paste into the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.spartan_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spartan_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  company_name text not null default '',
  company_id uuid references public.spartan_companies(id) on delete set null,
  role text not null default 'client' check (role in ('admin', 'client', 'manager')),
  status text not null default 'active' check (status in ('active', 'trialing', 'overdue', 'canceled')),
  avatar_url text,
  plan_id text not null default 'plan_pro',
  ai_credits_remaining integer not null default 25000 check (ai_credits_remaining >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spartan_company_memberships (
  company_id uuid not null references public.spartan_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'operator', 'member')),
  created_at timestamptz not null default now(),
  primary key (company_id, user_id)
);

create or replace function public.spartan_is_company_member(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.spartan_company_memberships m
    where m.company_id = target_company and m.user_id = auth.uid()
  );
$$;

create or replace function public.spartan_is_company_admin(target_company uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.spartan_company_memberships m
    where m.company_id = target_company and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.spartan_is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.spartan_profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create or replace function public.spartan_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_company_id uuid; assigned_plan text; assigned_credits integer;
begin
  insert into public.spartan_companies(name)
  values (coalesce(nullif(trim(new.raw_user_meta_data->>'company_name'), ''), 'Minha farm 3D'))
  returning id into new_company_id;

  assigned_plan := coalesce(new.raw_user_meta_data->>'plan_id', 'plan_pro');
  select ai_credits into assigned_credits from public.spartan_plans where id = assigned_plan and active;
  insert into public.spartan_profiles(id, email, full_name, company_name, company_id, role, plan_id, ai_credits_remaining)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(nullif(trim(new.raw_user_meta_data->>'company_name'), ''), 'Minha farm 3D'), new_company_id, 'client',
    assigned_plan, coalesce(assigned_credits, 25000));

  insert into public.spartan_company_memberships(company_id, user_id, role)
  values (new_company_id, new.id, 'owner');
  return new;
end;
$$;

drop trigger if exists spartan_on_auth_user_created on auth.users;
create trigger spartan_on_auth_user_created after insert on auth.users
for each row execute procedure public.spartan_handle_new_user();

-- A user must never grant themselves platform privileges or change tenant ownership.
create or replace function public.spartan_protect_profile_privileges()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.role() <> 'service_role' and (
    new.role is distinct from old.role or new.company_id is distinct from old.company_id
  ) then
    raise exception 'role and company assignment can only be changed by a trusted administrator';
  end if;
  return new;
end;
$$;
drop trigger if exists spartan_protect_profile_privileges on public.spartan_profiles;
create trigger spartan_protect_profile_privileges before update on public.spartan_profiles
for each row execute procedure public.spartan_protect_profile_privileges();

create table if not exists public.spartan_plans (
  id text primary key,
  name text not null,
  description text not null default '',
  price_monthly numeric(12,2) not null default 0 check (price_monthly >= 0),
  price_yearly numeric(12,2) not null default 0 check (price_yearly >= 0),
  max_projects integer not null default 20,
  max_printers integer not null default 2,
  max_filaments integer not null default 10,
  max_users integer not null default 1,
  ai_credits integer not null default 0,
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.spartan_filaments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.spartan_companies(id) on delete cascade,
  type text not null,
  color text not null,
  color_hex text not null default '#64748b',
  brand text not null default '',
  total_weight_g integer not null check (total_weight_g > 0),
  remaining_weight_g integer not null check (remaining_weight_g >= 0),
  price_per_kg numeric(12,2) not null default 0 check (price_per_kg >= 0),
  nozzle_temperature text,
  bed_temperature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (remaining_weight_g <= total_weight_g)
);

create table if not exists public.spartan_printers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.spartan_companies(id) on delete cascade,
  name text not null,
  model text not null default '',
  type text not null default 'FDM',
  status text not null default 'disponivel' check (status in ('imprimindo', 'disponivel', 'manutencao', 'desconectada')),
  power_watts integer not null default 350 check (power_watts > 0),
  nozzle_mm numeric(5,2) not null default 0.4,
  hours_used numeric(12,2) not null default 0,
  current_project_id uuid,
  current_project_name text,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  integration text,
  integration_url text,
  integration_secret_encrypted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spartan_projects (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.spartan_companies(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  printer_id uuid references public.spartan_printers(id) on delete set null,
  part_name text not null,
  customer_name text not null default '',
  estimated_weight_g numeric(12,2) not null default 0 check (estimated_weight_g >= 0),
  estimated_hours numeric(12,2) not null default 0 check (estimated_hours >= 0),
  materials jsonb not null default '[]'::jsonb,
  material_cost numeric(12,2) not null default 0,
  energy_cost numeric(12,2) not null default 0,
  depreciation_cost numeric(12,2) not null default 0,
  labor_cost numeric(12,2) not null default 0,
  other_cost numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null default 0,
  margin_percent numeric(8,2) not null default 0,
  charged_price numeric(12,2) not null default 0,
  net_profit numeric(12,2) not null default 0,
  status text not null default 'orcamento' check (status in ('orcamento', 'aprovado', 'em_impressao', 'concluido', 'cancelado')),
  stock_deducted boolean not null default false,
  notes text,
  file_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.spartan_printers drop constraint if exists printers_current_project_id_fkey;
alter table public.spartan_printers add constraint printers_current_project_id_fkey
  foreign key (current_project_id) references public.spartan_projects(id) on delete set null;

create table if not exists public.spartan_inventory_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.spartan_companies(id) on delete cascade,
  filament_id uuid not null references public.spartan_filaments(id) on delete cascade,
  project_id uuid references public.spartan_projects(id) on delete set null,
  event_type text not null check (event_type in ('consumption', 'return', 'purchase', 'adjustment')),
  quantity_g integer not null check (quantity_g > 0),
  note text,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.spartan_invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.spartan_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  plan_id text references public.spartan_plans(id),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'BRL',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'canceled', 'refunded')),
  method text not null check (method in ('pix', 'credit_card', 'boleto')),
  due_date date not null,
  paid_at timestamptz,
  provider text,
  provider_reference text,
  checkout_url text,
  created_at timestamptz not null default now()
);

create table if not exists public.spartan_ai_conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.spartan_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  question text not null,
  answer text not null,
  model text,
  tokens_used integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.spartan_notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.spartan_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  title text not null,
  message text not null,
  type text not null default 'system',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.spartan_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.spartan_companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('android', 'ios', 'web')),
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.spartan_printer_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.spartan_companies(id) on delete cascade,
  printer_id uuid not null references public.spartan_printers(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.spartan_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

insert into public.spartan_plans(id, name, description, price_monthly, price_yearly, max_projects, max_printers, max_filaments, max_users, ai_credits, features)
values
  ('plan_starter', 'SPARTAN START', 'Para makers e estúdios iniciantes.', 49, 39, 20, 2, 10, 1, 5000, '["Calculadora de custos","Gestão de estoque","Orçamentos em PDF"]'::jsonb),
  ('plan_pro', 'SPARTAN PRO', 'Para farms de impressão 3D em crescimento.', 129, 99, 50, 5, 50, 3, 25000, '["Baixa de estoque","Múltiplas impressoras","Equipe de operadores"]'::jsonb),
  ('plan_enterprise', 'SPARTAN BUSINESS', 'Para operações de maior escala.', 299, 249, 9999, 999, 999, 10, 100000, '["Relatórios","Integrações de impressora","Equipe ampliada"]'::jsonb)
on conflict (id) do update set name = excluded.name, description = excluded.description,
  price_monthly = excluded.price_monthly, price_yearly = excluded.price_yearly,
  max_projects = excluded.max_projects, max_printers = excluded.max_printers,
  max_filaments = excluded.max_filaments, max_users = excluded.max_users,
  ai_credits = excluded.ai_credits, features = excluded.features;

-- Backfill existing Auth users into the app-specific tenant tables. The legacy
-- public schema stays intact for the older backend and its existing data.
do $$
declare account record; tenant_id uuid; target_plan text; target_credits integer; member_role text;
begin
  if to_regclass('public.profiles') is not null
     and to_regclass('public.companies') is not null
     and to_regclass('public.plans') is not null then
    for account in execute $query$
      select u.id, u.email,
        coalesce(nullif(p.full_name, ''), nullif(u.raw_user_meta_data->>'full_name', ''), '') as full_name,
        coalesce(p.company_id, gen_random_uuid()) as company_id,
        coalesce(nullif(c.name, ''), nullif(u.raw_user_meta_data->>'company_name', ''), 'Minha farm 3D') as company_name,
        case
          when lower(coalesce(lp.slug, lp.name, '')) like '%enterprise%' then 'plan_enterprise'
          when lower(coalesce(lp.slug, lp.name, '')) like '%starter%' then 'plan_starter'
          else 'plan_pro'
        end as plan_id
      from auth.users u
      left join public.profiles p on p.id = u.id
      left join public.companies c on c.id = p.company_id
      left join public.plans lp on lp.id = c.plan_id
      order by u.created_at, u.id
    $query$ loop
      tenant_id := account.company_id;
      target_plan := account.plan_id;
      insert into public.spartan_companies(id, name) values (tenant_id, account.company_name) on conflict (id) do nothing;
      select ai_credits into target_credits from public.spartan_plans where id = target_plan and active;
      insert into public.spartan_profiles(id, email, full_name, company_name, company_id, role, plan_id, ai_credits_remaining)
        values (account.id, coalesce(account.email, ''), account.full_name, account.company_name, tenant_id, 'client', target_plan, coalesce(target_credits, 25000))
        on conflict (id) do nothing;
      member_role := case when exists (select 1 from public.spartan_company_memberships where company_id = tenant_id) then 'member' else 'owner' end;
      insert into public.spartan_company_memberships(company_id, user_id, role)
        values (tenant_id, account.id, member_role) on conflict (company_id, user_id) do nothing;
    end loop;
  else
    for account in select id, email,
      coalesce(nullif(raw_user_meta_data->>'full_name', ''), '') as full_name,
      coalesce(nullif(raw_user_meta_data->>'company_name', ''), 'Minha farm 3D') as company_name
      from auth.users order by created_at, id loop
      tenant_id := gen_random_uuid();
      insert into public.spartan_companies(id, name) values (tenant_id, account.company_name);
      select ai_credits into target_credits from public.spartan_plans where id = 'plan_pro' and active;
      insert into public.spartan_profiles(id, email, full_name, company_name, company_id, role, plan_id, ai_credits_remaining)
        values (account.id, coalesce(account.email, ''), account.full_name, account.company_name, tenant_id, 'client', 'plan_pro', coalesce(target_credits, 25000))
        on conflict (id) do nothing;
      insert into public.spartan_company_memberships(company_id, user_id, role)
        values (tenant_id, account.id, 'owner') on conflict (company_id, user_id) do nothing;
    end loop;
  end if;
end;
$$;

create or replace function public.spartan_consume_filaments(p_materials jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare item jsonb; filament public.spartan_filaments%rowtype; quantity integer;
begin
  for item in select value from jsonb_array_elements(p_materials) loop
    quantity := greatest(0, coalesce((item->>'quantity_g')::integer, 0));
    if quantity = 0 then continue; end if;
    select * into filament from public.spartan_filaments where id = (item->>'filament_id')::uuid for update;
    if not found or not public.spartan_is_company_member(filament.company_id) then raise exception 'Filament not found'; end if;
    if filament.remaining_weight_g < quantity then raise exception 'Insufficient filament stock for %', filament.color; end if;
    update public.spartan_filaments set remaining_weight_g = remaining_weight_g - quantity, updated_at = now() where id = filament.id;
    insert into public.spartan_inventory_events(company_id, filament_id, event_type, quantity_g) values (filament.company_id, filament.id, 'consumption', quantity);
  end loop;
end;
$$;

create or replace function public.spartan_return_filaments(p_materials jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare item jsonb; filament public.spartan_filaments%rowtype; quantity integer;
begin
  for item in select value from jsonb_array_elements(p_materials) loop
    quantity := greatest(0, coalesce((item->>'quantity_g')::integer, 0));
    if quantity = 0 then continue; end if;
    select * into filament from public.spartan_filaments where id = (item->>'filament_id')::uuid for update;
    if not found or not public.spartan_is_company_member(filament.company_id) then raise exception 'Filament not found'; end if;
    update public.spartan_filaments set remaining_weight_g = least(total_weight_g, remaining_weight_g + quantity), updated_at = now() where id = filament.id;
    insert into public.spartan_inventory_events(company_id, filament_id, event_type, quantity_g) values (filament.company_id, filament.id, 'return', quantity);
  end loop;
end;
$$;
grant execute on function public.spartan_consume_filaments(jsonb), public.spartan_return_filaments(jsonb) to authenticated;

create or replace function public.spartan_set_project_status(p_project_id uuid, p_status text)
returns void language plpgsql security invoker set search_path = public as $$
declare project_row public.spartan_projects%rowtype; printer_row public.spartan_printers%rowtype;
begin
  if p_status not in ('orcamento', 'aprovado', 'em_impressao', 'concluido', 'cancelado') then raise exception 'Invalid project status'; end if;
  select * into project_row from public.spartan_projects where id = p_project_id for update;
  if not found or not public.spartan_is_company_member(project_row.company_id) then raise exception 'Project not found'; end if;
  if p_status in ('aprovado', 'em_impressao') and not project_row.stock_deducted then
    if project_row.printer_id is not null then
      select * into printer_row from public.spartan_printers where id = project_row.printer_id and company_id = project_row.company_id for update;
      if not found or printer_row.status <> 'disponivel' then raise exception 'Selected printer is unavailable'; end if;
      update public.spartan_printers set status = 'imprimindo', current_project_id = project_row.id,
        current_project_name = project_row.part_name, progress_percent = 0 where id = printer_row.id;
    end if;
    perform public.spartan_consume_filaments(project_row.materials);
    update public.spartan_projects set status = p_status, stock_deducted = true, updated_at = now() where id = p_project_id;
  elsif p_status = 'cancelado' and project_row.stock_deducted then
    perform public.spartan_return_filaments(project_row.materials);
    if project_row.printer_id is not null then
      update public.spartan_printers set status = 'disponivel', current_project_id = null, current_project_name = null, progress_percent = 0 where id = project_row.printer_id and current_project_id = project_row.id;
    end if;
    update public.spartan_projects set status = p_status, stock_deducted = false, updated_at = now() where id = p_project_id;
  else
    if p_status = 'concluido' and project_row.printer_id is not null then
      update public.spartan_printers set status = 'disponivel', current_project_id = null, current_project_name = null, progress_percent = 0 where id = project_row.printer_id and current_project_id = project_row.id;
    end if;
    update public.spartan_projects set status = p_status, updated_at = now() where id = p_project_id;
  end if;
end;
$$;
grant execute on function public.spartan_set_project_status(uuid, text) to authenticated;

create or replace function public.spartan_set_printer_status(p_printer_id uuid, p_status text)
returns void language plpgsql security invoker set search_path = public as $$
declare printer_row public.spartan_printers%rowtype;
begin
  if p_status not in ('imprimindo', 'disponivel', 'manutencao', 'desconectada') then raise exception 'Invalid printer status'; end if;
  select * into printer_row from public.spartan_printers where id = p_printer_id for update;
  if not found or not public.spartan_is_company_member(printer_row.company_id) then raise exception 'Printer not found'; end if;
  if printer_row.current_project_id is not null and p_status in ('disponivel', 'manutencao', 'desconectada') then
    raise exception 'Finish or cancel the assigned project before changing printer status';
  end if;
  update public.spartan_printers set status = p_status, updated_at = now() where id = p_printer_id;
end;
$$;
grant execute on function public.spartan_set_printer_status(uuid, text) to authenticated;

create or replace function public.spartan_consume_ai_credits(p_amount integer)
returns integer language plpgsql security invoker set search_path = public as $$
declare remaining integer;
begin
  if p_amount is null or p_amount < 1 or p_amount > 10000 then raise exception 'Invalid credit amount'; end if;
  update public.spartan_profiles set ai_credits_remaining = ai_credits_remaining - p_amount, updated_at = now()
    where id = auth.uid() and ai_credits_remaining >= p_amount
    returning ai_credits_remaining into remaining;
  if not found then raise exception 'Insufficient AI credits'; end if;
  return remaining;
end;
$$;
grant execute on function public.spartan_consume_ai_credits(integer) to authenticated;
revoke all on function public.spartan_consume_ai_credits(integer) from public, anon;
grant execute on function public.spartan_consume_ai_credits(integer) to authenticated;

create or replace function public.spartan_refund_ai_credit(p_user_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare remaining integer;
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  update public.spartan_profiles p set ai_credits_remaining = least(pl.ai_credits, p.ai_credits_remaining + 1), updated_at = now()
    from public.spartan_plans pl where p.id = p_user_id and pl.id = p.plan_id returning p.ai_credits_remaining into remaining;
  return remaining;
end;
$$;
revoke all on function public.spartan_refund_ai_credit(uuid) from public, anon, authenticated;
grant execute on function public.spartan_refund_ai_credit(uuid) to service_role;

create index if not exists projects_company_created_idx on public.spartan_projects(company_id, created_at desc);
create index if not exists invoices_company_due_idx on public.spartan_invoices(company_id, due_date desc);
create index if not exists filaments_company_idx on public.spartan_filaments(company_id);
create index if not exists printers_company_idx on public.spartan_printers(company_id);
create index if not exists notifications_user_created_idx on public.spartan_notifications(user_id, created_at desc);

alter table public.spartan_companies enable row level security;
alter table public.spartan_profiles enable row level security;
alter table public.spartan_company_memberships enable row level security;
alter table public.spartan_plans enable row level security;
alter table public.spartan_filaments enable row level security;
alter table public.spartan_printers enable row level security;
alter table public.spartan_projects enable row level security;
alter table public.spartan_inventory_events enable row level security;
alter table public.spartan_invoices enable row level security;
alter table public.spartan_ai_conversations enable row level security;
alter table public.spartan_notifications enable row level security;
alter table public.spartan_push_subscriptions enable row level security;
alter table public.spartan_printer_events enable row level security;
alter table public.spartan_payment_events enable row level security;

create policy "members or platform admins can view company" on public.spartan_companies for select using (public.spartan_is_company_member(id) or public.spartan_is_platform_admin());
create policy "company admins can update company" on public.spartan_companies for update using (public.spartan_is_company_admin(id)) with check (public.spartan_is_company_admin(id));
create policy "users can view their profile" on public.spartan_profiles for select using (id = auth.uid() or public.spartan_is_platform_admin());
create policy "users can update their profile" on public.spartan_profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "platform admins can update client profiles" on public.spartan_profiles for update using (public.spartan_is_platform_admin()) with check (public.spartan_is_platform_admin());
create policy "members can view memberships" on public.spartan_company_memberships for select using (public.spartan_is_company_member(company_id));
create policy "company admins can manage memberships" on public.spartan_company_memberships for all using (public.spartan_is_company_admin(company_id)) with check (public.spartan_is_company_admin(company_id));
create policy "active plans are public" on public.spartan_plans for select using (active or public.spartan_is_platform_admin());
create policy "platform admins manage plans" on public.spartan_plans for all using (public.spartan_is_platform_admin()) with check (public.spartan_is_platform_admin());
create policy "users manage their push devices" on public.spartan_push_subscriptions for all using (user_id = auth.uid() and public.spartan_is_company_member(company_id)) with check (user_id = auth.uid() and public.spartan_is_company_member(company_id));

do $$
declare t text;
begin
  foreach t in array array['spartan_filaments','spartan_printers','spartan_projects','spartan_inventory_events','spartan_invoices','spartan_ai_conversations','spartan_notifications','spartan_printer_events'] loop
    execute format('create policy "company members or platform admins can read %1$s" on public.%1$I for select using (public.spartan_is_company_member(company_id) or public.spartan_is_platform_admin())', t);
    execute format('create policy "company members can create %1$s" on public.%1$I for insert with check (public.spartan_is_company_member(company_id))', t);
    execute format('create policy "company admins can update %1$s" on public.%1$I for update using (public.spartan_is_company_admin(company_id)) with check (public.spartan_is_company_admin(company_id))', t);
    execute format('create policy "company admins can delete %1$s" on public.%1$I for delete using (public.spartan_is_company_admin(company_id))', t);
  end loop;
end $$;

create policy "only trusted server records payment events" on public.spartan_payment_events for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "platform admins inspect payment events" on public.spartan_payment_events for select using (public.spartan_is_platform_admin());

-- Private storage bucket for STL/3MF/G-code. Path: <company_id>/<filename>.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('3d-models', '3d-models', false, 52428800,
  array['model/stl','model/3mf','application/vnd.ms-package.3dmanufacturing-3dmodel+xml','text/plain','application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "spartan company members read their model files" on storage.objects for select
using (bucket_id = '3d-models' and public.spartan_is_company_member((storage.foldername(name))[1]::uuid));
create policy "spartan company members upload their model files" on storage.objects for insert
with check (bucket_id = '3d-models' and public.spartan_is_company_member((storage.foldername(name))[1]::uuid));
create policy "spartan company admins remove model files" on storage.objects for delete
using (bucket_id = '3d-models' and public.spartan_is_company_admin((storage.foldername(name))[1]::uuid));

grant usage on schema public to authenticated;
grant select, update on public.spartan_profiles to authenticated;
grant select, update on public.spartan_companies to authenticated;
grant select, insert, update, delete on public.spartan_company_memberships to authenticated;
grant select, insert, update, delete on public.spartan_plans, public.spartan_filaments, public.spartan_printers,
  public.spartan_projects, public.spartan_inventory_events, public.spartan_invoices, public.spartan_ai_conversations,
  public.spartan_notifications, public.spartan_printer_events to authenticated;
grant select, insert, update, delete on public.spartan_push_subscriptions to authenticated;
grant select on public.spartan_payment_events to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spartan_profiles') then
      alter publication supabase_realtime add table public.spartan_profiles;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spartan_payment_events') then
      alter publication supabase_realtime add table public.spartan_payment_events;
    end if;
  end if;
end $$;

-- >>> Migration: 202609280001_public_plan_catalog.sql <<<
-- Public signup and pricing pages need to read active plan definitions.
grant select on public.spartan_plans to anon;
notify pgrst, 'reload schema';

-- >>> Migration: 202609280002_profile_images.sql <<<
-- Public image assets for member avatars or a studio logo used as the account identity image.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-images', 'profile-images', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "members read profile images" on storage.objects for select
using (bucket_id = 'profile-images');
create policy "members upload own profile image" on storage.objects for insert
with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "members update own profile image" on storage.objects for update
using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "members delete own profile image" on storage.objects for delete
using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- >>> Migration: 202609280003_company_contact.sql <<<
alter table public.spartan_profiles
  add column if not exists company_phone text not null default '';

-- >>> Migration: 202609280004_project_images.sql <<<
alter table public.spartan_projects
  add column if not exists image_path text;

update storage.buckets
set allowed_mime_types = array[
  'model/stl', 'model/3mf', 'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
  'text/plain', 'application/octet-stream', 'image/jpeg', 'image/png', 'image/webp'
]
where id = '3d-models';

-- >>> Migration: 202609290001_realtime_farm_state.sql <<<
do $$
declare table_name text;
begin
  foreach table_name in array array['spartan_projects', 'spartan_printers', 'spartan_filaments'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;

-- >>> Migration: 202609290002_filament_min_stock.sql <<<
alter table public.spartan_filaments
  add column if not exists minimum_stock_g integer not null default 200 check (minimum_stock_g >= 0);

-- >>> Migration: 202609290003_project_stock_history.sql <<<
-- Keep each project material movement linked to its project so the stock history
-- can show the exact spool/color and grams that were deducted or returned.
create or replace function public.spartan_consume_project_filaments(p_materials jsonb, p_project_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare item jsonb; filament public.spartan_filaments%rowtype; quantity integer;
begin
  for item in select value from jsonb_array_elements(p_materials) loop
    quantity := greatest(0, coalesce((item->>'quantity_g')::integer, 0));
    if quantity = 0 then continue; end if;
    select * into filament from public.spartan_filaments where id = (item->>'filament_id')::uuid for update;
    if not found or not public.spartan_is_company_member(filament.company_id) then raise exception 'Filament not found'; end if;
    if filament.remaining_weight_g < quantity then raise exception 'Insufficient filament stock for %', filament.color; end if;
    update public.spartan_filaments set remaining_weight_g = remaining_weight_g - quantity, updated_at = now() where id = filament.id;
    insert into public.spartan_inventory_events(company_id, filament_id, project_id, event_type, quantity_g)
      values (filament.company_id, filament.id, p_project_id, 'consumption', quantity);
  end loop;
end;
$$;

create or replace function public.spartan_return_project_filaments(p_materials jsonb, p_project_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare item jsonb; filament public.spartan_filaments%rowtype; quantity integer;
begin
  for item in select value from jsonb_array_elements(p_materials) loop
    quantity := greatest(0, coalesce((item->>'quantity_g')::integer, 0));
    if quantity = 0 then continue; end if;
    select * into filament from public.spartan_filaments where id = (item->>'filament_id')::uuid for update;
    if not found or not public.spartan_is_company_member(filament.company_id) then raise exception 'Filament not found'; end if;
    update public.spartan_filaments set remaining_weight_g = least(total_weight_g, remaining_weight_g + quantity), updated_at = now() where id = filament.id;
    insert into public.spartan_inventory_events(company_id, filament_id, project_id, event_type, quantity_g)
      values (filament.company_id, filament.id, p_project_id, 'return', quantity);
  end loop;
end;
$$;

grant execute on function public.spartan_consume_project_filaments(jsonb, uuid), public.spartan_return_project_filaments(jsonb, uuid) to authenticated;

create or replace function public.spartan_set_project_status(p_project_id uuid, p_status text)
returns void language plpgsql security invoker set search_path = public as $$
declare project_row public.spartan_projects%rowtype; printer_row public.spartan_printers%rowtype;
begin
  if p_status not in ('orcamento', 'aprovado', 'em_impressao', 'concluido', 'cancelado') then raise exception 'Invalid project status'; end if;
  select * into project_row from public.spartan_projects where id = p_project_id for update;
  if not found or not public.spartan_is_company_member(project_row.company_id) then raise exception 'Project not found'; end if;
  if p_status in ('aprovado', 'em_impressao') and not project_row.stock_deducted then
    if project_row.printer_id is not null then
      select * into printer_row from public.spartan_printers where id = project_row.printer_id and company_id = project_row.company_id for update;
      if not found or printer_row.status <> 'disponivel' then raise exception 'Selected printer is unavailable'; end if;
      update public.spartan_printers set status = 'imprimindo', current_project_id = project_row.id,
        current_project_name = project_row.part_name, progress_percent = 0 where id = printer_row.id;
    end if;
    perform public.spartan_consume_project_filaments(project_row.materials, project_row.id);
    update public.spartan_projects set status = p_status, stock_deducted = true, updated_at = now() where id = p_project_id;
  elsif p_status = 'cancelado' and project_row.stock_deducted then
    perform public.spartan_return_project_filaments(project_row.materials, project_row.id);
    if project_row.printer_id is not null then
      update public.spartan_printers set status = 'disponivel', current_project_id = null, current_project_name = null, progress_percent = 0 where id = project_row.printer_id and current_project_id = project_row.id;
    end if;
    update public.spartan_projects set status = p_status, stock_deducted = false, updated_at = now() where id = p_project_id;
  else
    if p_status = 'concluido' and project_row.printer_id is not null then
      update public.spartan_printers set status = 'disponivel', current_project_id = null, current_project_name = null, progress_percent = 0 where id = project_row.printer_id and current_project_id = project_row.id;
    end if;
    update public.spartan_projects set status = p_status, updated_at = now() where id = p_project_id;
  end if;
end;
$$;
grant execute on function public.spartan_set_project_status(uuid, text) to authenticated;

-- >>> Migration: 202609290004_project_material_json_keys.sql <<<
-- ProjectMaterial is stored as camelCase JSON by the web app. The generic
-- inventory RPC payload uses snake_case, so project stock movements accept both.
create or replace function public.spartan_consume_project_filaments(p_materials jsonb, p_project_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare item jsonb; filament public.spartan_filaments%rowtype; quantity integer; filament_key text;
begin
  for item in select value from jsonb_array_elements(p_materials) loop
    quantity := greatest(0, coalesce(nullif(item->>'quantity_g', '')::integer, nullif(item->>'weightGrams', '')::numeric::integer, 0));
    if quantity = 0 then continue; end if;
    filament_key := coalesce(item->>'filament_id', item->>'materialId');
    if filament_key is null then raise exception 'Project material is missing its filament id'; end if;
    select * into filament from public.spartan_filaments where id = filament_key::uuid for update;
    if not found or not public.spartan_is_company_member(filament.company_id) then raise exception 'Filament not found'; end if;
    if filament.remaining_weight_g < quantity then raise exception 'Insufficient filament stock for %', filament.color; end if;
    update public.spartan_filaments set remaining_weight_g = remaining_weight_g - quantity, updated_at = now() where id = filament.id;
    insert into public.spartan_inventory_events(company_id, filament_id, project_id, event_type, quantity_g)
      values (filament.company_id, filament.id, p_project_id, 'consumption', quantity);
  end loop;
end;
$$;

create or replace function public.spartan_return_project_filaments(p_materials jsonb, p_project_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare item jsonb; filament public.spartan_filaments%rowtype; quantity integer; filament_key text;
begin
  for item in select value from jsonb_array_elements(p_materials) loop
    quantity := greatest(0, coalesce(nullif(item->>'quantity_g', '')::integer, nullif(item->>'weightGrams', '')::numeric::integer, 0));
    if quantity = 0 then continue; end if;
    filament_key := coalesce(item->>'filament_id', item->>'materialId');
    if filament_key is null then raise exception 'Project material is missing its filament id'; end if;
    select * into filament from public.spartan_filaments where id = filament_key::uuid for update;
    if not found or not public.spartan_is_company_member(filament.company_id) then raise exception 'Filament not found'; end if;
    update public.spartan_filaments set remaining_weight_g = least(total_weight_g, remaining_weight_g + quantity), updated_at = now() where id = filament.id;
    insert into public.spartan_inventory_events(company_id, filament_id, project_id, event_type, quantity_g)
      values (filament.company_id, filament.id, p_project_id, 'return', quantity);
  end loop;
end;
$$;

grant execute on function public.spartan_consume_project_filaments(jsonb, uuid), public.spartan_return_project_filaments(jsonb, uuid) to authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spartan_inventory_events') then
    alter publication supabase_realtime add table public.spartan_inventory_events;
  end if;
end $$;

-- >>> Migration: 202609290005_reconcile_project_stock.sql <<<
-- Reconcile previously started/completed projects that were marked as having
-- deducted stock but have no corresponding inventory movement. This is safe to
-- rerun because each project is skipped once a consumption event exists.
do $$
declare project_row public.spartan_projects%rowtype; item jsonb; filament public.spartan_filaments%rowtype;
  quantity integer; filament_key text;
begin
  for project_row in
    select p.* from public.spartan_projects p
    where p.stock_deducted = true
      and p.status in ('aprovado', 'em_impressao', 'concluido')
      and not exists (
        select 1 from public.spartan_inventory_events e
        where e.project_id = p.id and e.event_type = 'consumption'
      )
  loop
    for item in select value from jsonb_array_elements(project_row.materials) loop
      quantity := greatest(0, coalesce(nullif(item->>'quantity_g', '')::integer, nullif(item->>'weightGrams', '')::numeric::integer, 0));
      if quantity = 0 then continue; end if;
      filament_key := coalesce(item->>'filament_id', item->>'materialId');
      if filament_key is null then raise exception 'Project % has a material without a filament id', project_row.id; end if;
      select * into filament from public.spartan_filaments
        where id = filament_key::uuid and company_id = project_row.company_id for update;
      if not found then raise exception 'Filament % for project % was not found', filament_key, project_row.id; end if;
      if filament.remaining_weight_g < quantity then
        raise exception 'Cannot reconcile project %: filament % has % g available but % g must be deducted', project_row.id, filament.color, filament.remaining_weight_g, quantity;
      end if;
      update public.spartan_filaments set remaining_weight_g = remaining_weight_g - quantity, updated_at = now()
        where id = filament.id;
      insert into public.spartan_inventory_events(company_id, filament_id, project_id, event_type, quantity_g, note, created_by)
        values (project_row.company_id, filament.id, project_row.id, 'consumption', quantity, 'Baixa reconciliada do projeto', project_row.created_by);
    end loop;
  end loop;
end;
$$;

-- >>> Migration: 202609290006_printer_farm_v1.sql <<<
alter table public.spartan_printers
  add column if not exists hours_since_maintenance numeric(12,2) not null default 0 check (hours_since_maintenance >= 0),
  add column if not exists maintenance_interval_hours integer not null default 100 check (maintenance_interval_hours > 0);

alter table public.spartan_printers drop constraint if exists spartan_printers_status_check;
alter table public.spartan_printers add constraint spartan_printers_status_check
  check (status in ('imprimindo', 'pausada', 'disponivel', 'manutencao', 'desconectada'));

create or replace function public.spartan_set_printer_status(p_printer_id uuid, p_status text)
returns void language plpgsql security invoker set search_path = public as $$
declare printer_row public.spartan_printers%rowtype;
begin
  if p_status not in ('imprimindo', 'pausada', 'disponivel', 'manutencao', 'desconectada') then raise exception 'Invalid printer status'; end if;
  select * into printer_row from public.spartan_printers where id = p_printer_id for update;
  if not found or not public.spartan_is_company_member(printer_row.company_id) then raise exception 'Printer not found'; end if;
  if printer_row.current_project_id is not null and p_status in ('disponivel', 'manutencao', 'desconectada') then
    raise exception 'Finish or cancel the assigned project before changing printer status';
  end if;
  if printer_row.current_project_id is null and p_status = 'pausada' then raise exception 'There is no active project to pause'; end if;
  update public.spartan_printers set status = p_status, updated_at = now() where id = p_printer_id;
end;
$$;
grant execute on function public.spartan_set_printer_status(uuid, text) to authenticated;

create or replace function public.spartan_update_printer_progress(p_printer_id uuid, p_progress integer)
returns void language plpgsql security invoker set search_path = public as $$
declare printer_row public.spartan_printers%rowtype;
begin
  if p_progress < 0 or p_progress > 100 then raise exception 'Progress must be between 0 and 100'; end if;
  select * into printer_row from public.spartan_printers where id = p_printer_id for update;
  if not found or not public.spartan_is_company_member(printer_row.company_id) then raise exception 'Printer not found'; end if;
  if printer_row.current_project_id is null then raise exception 'There is no active project'; end if;
  update public.spartan_printers set progress_percent = p_progress, updated_at = now() where id = p_printer_id;
end;
$$;
grant execute on function public.spartan_update_printer_progress(uuid, integer) to authenticated;

create or replace function public.spartan_record_printer_maintenance(p_printer_id uuid, p_tasks text[], p_note text default '')
returns void language plpgsql security invoker set search_path = public as $$
declare printer_row public.spartan_printers%rowtype;
begin
  select * into printer_row from public.spartan_printers where id = p_printer_id for update;
  if not found or not public.spartan_is_company_member(printer_row.company_id) then raise exception 'Printer not found'; end if;
  if printer_row.current_project_id is not null then raise exception 'Finish or cancel the current project before recording maintenance'; end if;
  update public.spartan_printers set status = 'disponivel', hours_since_maintenance = 0, updated_at = now() where id = p_printer_id;
  insert into public.spartan_printer_events(company_id, printer_id, event_type, payload)
    values (printer_row.company_id, printer_row.id, 'maintenance_completed', jsonb_build_object('tasks', coalesce(p_tasks, array[]::text[]), 'note', coalesce(p_note, ''), 'completed_at', now()));
end;
$$;
grant execute on function public.spartan_record_printer_maintenance(uuid, text[], text) to authenticated;

create or replace function public.spartan_log_printer_status_change()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if old.status is distinct from new.status then
    insert into public.spartan_printer_events(company_id, printer_id, event_type, payload)
      values (new.company_id, new.id, 'status_changed', jsonb_build_object('from', old.status, 'to', new.status, 'project', new.current_project_name));
  end if;
  return new;
end;
$$;
drop trigger if exists spartan_printer_status_history on public.spartan_printers;
create trigger spartan_printer_status_history after update of status on public.spartan_printers
for each row execute function public.spartan_log_printer_status_change();

create or replace function public.spartan_log_completed_printer_hours()
returns trigger language plpgsql security invoker set search_path = public as $$
declare printer_row public.spartan_printers%rowtype;
begin
  if new.status = 'concluido' and old.status is distinct from 'concluido' and new.printer_id is not null then
    update public.spartan_printers set hours_used = hours_used + new.estimated_hours,
      hours_since_maintenance = hours_since_maintenance + new.estimated_hours, updated_at = now()
      where id = new.printer_id returning * into printer_row;
    if found then
      insert into public.spartan_printer_events(company_id, printer_id, event_type, payload)
        values (printer_row.company_id, printer_row.id, 'project_completed', jsonb_build_object('project_id', new.id, 'project_name', new.part_name, 'hours', new.estimated_hours));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists spartan_project_printer_hours on public.spartan_projects;
create trigger spartan_project_printer_hours after update of status on public.spartan_projects
for each row execute function public.spartan_log_completed_printer_hours();

do $$
declare project_row public.spartan_projects%rowtype; printer_row public.spartan_printers%rowtype;
begin
  for project_row in
    select p.* from public.spartan_projects p
    where p.status = 'concluido' and p.printer_id is not null
      and not exists (select 1 from public.spartan_printer_events e where e.event_type = 'project_completed' and e.payload->>'project_id' = p.id::text)
  loop
    update public.spartan_printers set hours_used = hours_used + project_row.estimated_hours,
      hours_since_maintenance = hours_since_maintenance + project_row.estimated_hours, updated_at = now()
      where id = project_row.printer_id returning * into printer_row;
    if found then
      insert into public.spartan_printer_events(company_id, printer_id, event_type, payload)
        values (printer_row.company_id, printer_row.id, 'project_completed', jsonb_build_object('project_id', project_row.id, 'project_name', project_row.part_name, 'hours', project_row.estimated_hours, 'historical', true));
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spartan_printer_events') then
    alter publication supabase_realtime add table public.spartan_printer_events;
  end if;
end $$;

-- >>> Migration: 202609290007_pause_unassigned_printer.sql <<<
create or replace function public.spartan_set_printer_status(p_printer_id uuid, p_status text)
returns void language plpgsql security invoker set search_path = public as $$
declare printer_row public.spartan_printers%rowtype;
begin
  if p_status not in ('imprimindo', 'pausada', 'disponivel', 'manutencao', 'desconectada') then raise exception 'Invalid printer status'; end if;
  select * into printer_row from public.spartan_printers where id = p_printer_id for update;
  if not found or not public.spartan_is_company_member(printer_row.company_id) then raise exception 'Printer not found'; end if;
  if printer_row.current_project_id is not null and p_status in ('disponivel', 'manutencao', 'desconectada') then
    raise exception 'Finish or cancel the assigned project before changing printer status';
  end if;
  update public.spartan_printers set status = p_status, updated_at = now() where id = p_printer_id;
end;
$$;
grant execute on function public.spartan_set_printer_status(uuid, text) to authenticated;

-- >>> Migration: 202609290008_project_approval_before_production.sql <<<
-- Client approval is a separate step from beginning production. Reserve/consume
-- filaments and assign the printer only when production actually starts.
create or replace function public.spartan_set_project_status(p_project_id uuid, p_status text)
returns void language plpgsql security invoker set search_path = public as $$
declare project_row public.spartan_projects%rowtype; printer_row public.spartan_printers%rowtype;
begin
  if p_status not in ('orcamento', 'aprovado', 'em_impressao', 'concluido', 'cancelado') then raise exception 'Invalid project status'; end if;
  select * into project_row from public.spartan_projects where id = p_project_id for update;
  if not found or not public.spartan_is_company_member(project_row.company_id) then raise exception 'Project not found'; end if;
  if p_status = 'em_impressao' and not project_row.stock_deducted then
    if project_row.printer_id is null then raise exception 'Select a printer before starting production'; end if;
    select * into printer_row from public.spartan_printers where id = project_row.printer_id and company_id = project_row.company_id for update;
    if not found or printer_row.status <> 'disponivel' then raise exception 'Selected printer is unavailable'; end if;
    update public.spartan_printers set status = 'imprimindo', current_project_id = project_row.id,
      current_project_name = project_row.part_name, progress_percent = 0 where id = printer_row.id;
    perform public.spartan_consume_project_filaments(project_row.materials, project_row.id);
    update public.spartan_projects set status = p_status, stock_deducted = true, updated_at = now() where id = p_project_id;
  elsif p_status = 'cancelado' and project_row.stock_deducted then
    perform public.spartan_return_project_filaments(project_row.materials, project_row.id);
    if project_row.printer_id is not null then
      update public.spartan_printers set status = 'disponivel', current_project_id = null, current_project_name = null, progress_percent = 0 where id = project_row.printer_id and current_project_id = project_row.id;
    end if;
    update public.spartan_projects set status = p_status, stock_deducted = false, updated_at = now() where id = p_project_id;
  else
    if p_status = 'concluido' and project_row.printer_id is not null then
      update public.spartan_printers set status = 'disponivel', current_project_id = null, current_project_name = null, progress_percent = 0 where id = project_row.printer_id and current_project_id = project_row.id;
    end if;
    update public.spartan_projects set status = p_status, updated_at = now() where id = p_project_id;
  end if;
end;
$$;
grant execute on function public.spartan_set_project_status(uuid, text) to authenticated;

-- >>> Migration: 202609290009_project_quantity_deadline.sql <<<
alter table public.spartan_projects
  add column if not exists quantity integer not null default 1 check (quantity > 0),
  add column if not exists due_date date;

-- >>> Migration: 202609300001_platform_access_and_business_owner.sql <<<
-- Separates platform administration from the user's tenant role, allowing the
-- owner to keep a client farm while also entering Admin and Developer tools.
create table if not exists public.spartan_platform_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  access_role text not null check (access_role in ('admin', 'developer')),
  created_at timestamptz not null default now(),
  primary key (user_id, access_role)
);

alter table public.spartan_platform_access enable row level security;
drop policy if exists "users can view own platform access" on public.spartan_platform_access;
create policy "users can view own platform access" on public.spartan_platform_access
  for select using (user_id = auth.uid() or public.spartan_is_platform_admin());
grant select on public.spartan_platform_access to authenticated;

create or replace function public.spartan_is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.spartan_profiles p
    where p.id = auth.uid() and p.role = 'admin'
  ) or exists (
    select 1 from public.spartan_platform_access a
    where a.user_id = auth.uid() and a.access_role in ('admin', 'developer')
  );
$$;

create or replace function public.spartan_assign_business_owner_access()
returns trigger language plpgsql security definer set search_path = public, auth as $$
declare business_credits integer;
begin
  if lower(coalesce(new.email, '')) <> 'gsroboticmania@gmail.com' or new.email_confirmed_at is null then
    return new;
  end if;

  insert into public.spartan_platform_access(user_id, access_role)
    values (new.id, 'admin'), (new.id, 'developer')
    on conflict (user_id, access_role) do nothing;

  select ai_credits into business_credits from public.spartan_plans
    where id = 'plan_enterprise' and active;
  update public.spartan_profiles
    set role = 'client', plan_id = 'plan_enterprise',
        ai_credits_remaining = coalesce(business_credits, 100000), updated_at = now()
    where id = new.id;
  return new;
end;
$$;

drop trigger if exists spartan_zz_assign_business_owner_access on auth.users;
create trigger spartan_zz_assign_business_owner_access
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.spartan_assign_business_owner_access();

-- Provision the exact, verified account if it already exists. The auth.users
-- trigger handles later registration or email confirmation for the same email.
insert into public.spartan_platform_access(user_id, access_role)
select u.id, roles.access_role
from auth.users u
cross join (values ('admin'), ('developer')) as roles(access_role)
where lower(u.email) = 'gsroboticmania@gmail.com' and u.email_confirmed_at is not null
on conflict (user_id, access_role) do nothing;

update public.spartan_profiles p
set role = 'client', plan_id = 'plan_enterprise',
    ai_credits_remaining = coalesce((select ai_credits from public.spartan_plans where id = 'plan_enterprise' and active), 100000),
    updated_at = now()
from auth.users u
where u.id = p.id and lower(u.email) = 'gsroboticmania@gmail.com' and u.email_confirmed_at is not null;

-- Keep tenant admins from editing their own subscription or platform status
-- through the self-service profile endpoint.
create or replace function public.spartan_protect_profile_privileges()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.role() is distinct from 'service_role' and not public.spartan_is_platform_admin() and (
    new.role is distinct from old.role or
    new.company_id is distinct from old.company_id or
    new.plan_id is distinct from old.plan_id or
    new.status is distinct from old.status or
    new.ai_credits_remaining is distinct from old.ai_credits_remaining
  ) then
    raise exception 'role, company, subscription, and platform privileges require a trusted administrator';
  end if;
  return new;
end;
$$;

-- >>> Migration: 202610140001_realtime_profiles.sql <<<
-- Adiciona spartan_profiles na publicação de realtime para atualização imediata de status do cliente
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'spartan_profiles'
  ) then
    alter publication supabase_realtime add table public.spartan_profiles;
  end if;
end $$;

-- >>> Migration: 202610140002_admin_invoices_policy.sql <<<
-- Permite que administradores da plataforma criem e alterem faturas de qualquer cliente/empresa
drop policy if exists "platform admins can insert invoices" on public.spartan_invoices;
create policy "platform admins can insert invoices" on public.spartan_invoices
  for insert with check (public.spartan_is_company_member(company_id) or public.spartan_is_platform_admin());

drop policy if exists "platform admins can update invoices" on public.spartan_invoices;
create policy "platform admins can update invoices" on public.spartan_invoices
  for update using (public.spartan_is_company_admin(company_id) or public.spartan_is_platform_admin())
  with check (public.spartan_is_company_admin(company_id) or public.spartan_is_platform_admin());

drop policy if exists "platform admins can delete invoices" on public.spartan_invoices;
create policy "platform admins can delete invoices" on public.spartan_invoices
  for delete using (public.spartan_is_company_admin(company_id) or public.spartan_is_platform_admin());

-- >>> Migration: 202610160001_strict_tenant_user_isolation_rls.sql <<<
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

-- >>> Migration: 202610160002_deduplicate_user_payment_settings.sql <<<
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

-- >>> Migration: 202610160003_admin_delete_user_completely.sql <<<
-- =============================================================================
-- MIGRATION: Exclusão completa de usuário pelo Admin (Banco, Auth e Storage)
-- Data: 2026-10-16
-- Permite que o Admin exclua 100% dos dados de um cliente no Supabase e libere
-- o e-mail em auth.users para que o cliente possa criar uma nova conta do zero.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.spartan_admin_delete_user(p_target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_company_id UUID;
BEGIN
  IF auth.uid() IS NULL OR NOT public.spartan_is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores da plataforma podem excluir usuários.';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'ID do usuário inválido.';
  END IF;

  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir sua própria conta de administrador.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.spartan_platform_access
    WHERE user_id = p_target_user_id AND access_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Não é permitido excluir outro administrador da plataforma.';
  END IF;

  SELECT company_id INTO v_company_id
  FROM public.spartan_profiles
  WHERE id = p_target_user_id;

  -- 1. Remove arquivos do usuário no Supabase Storage (fotos de perfil, modelos 3D, imagens de projetos)
  DELETE FROM storage.objects
  WHERE owner = p_target_user_id
     OR owner_id = p_target_user_id::text
     OR name LIKE (p_target_user_id::text || '/%')
     OR (v_company_id IS NOT NULL AND name LIKE (v_company_id::text || '/%'));

  -- 2. Remove todos os dados operacionais e financeiros vinculados ao usuário e à sua farm
  DELETE FROM public.spartan_printer_events
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_inventory_events
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_projects
  WHERE user_id = p_target_user_id OR created_by = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_printers
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_filaments
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_invoices
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_subscriptions
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_ai_usage_logs
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_ai_conversations
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_notifications
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_push_subscriptions
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_user_settings
  WHERE user_id = p_target_user_id;

  DELETE FROM public.spartan_company_memberships
  WHERE user_id = p_target_user_id OR (v_company_id IS NOT NULL AND company_id = v_company_id);

  DELETE FROM public.spartan_profiles
  WHERE id = p_target_user_id OR user_id = p_target_user_id;

  IF v_company_id IS NOT NULL THEN
    DELETE FROM public.spartan_companies
    WHERE id = v_company_id
      AND NOT EXISTS (
        SELECT 1 FROM public.spartan_profiles p WHERE p.company_id = v_company_id
      );
  END IF;

  DELETE FROM public.spartan_companies
  WHERE user_id = p_target_user_id;

  -- 3. Remove identidades e conta de autenticação em auth.users
  -- Isso encerra todas as sessões e libera o e-mail para novo cadastro futuro do zero.
  DELETE FROM auth.identities WHERE user_id = p_target_user_id;
  DELETE FROM auth.users WHERE id = p_target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.spartan_admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spartan_admin_delete_user(UUID) TO authenticated;

COMMIT;

-- >>> Migration: 202610160004_enforce_14_day_trial_expiration.sql <<<
-- =============================================================================
-- MIGRATION: Período de Teste de 14 Dias e Bloqueio Automático (Exceto Admins)
-- Data: 2026-10-16
-- =============================================================================

BEGIN;

-- 1. Adicionar coluna trial_ends_at em spartan_profiles (14 dias a partir do cadastro)
ALTER TABLE public.spartan_profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '14 days');

ALTER TABLE public.spartan_profiles
  ALTER COLUMN status SET DEFAULT 'trialing';

-- Preencher trial_ends_at para contas existentes com base em created_at + 14 dias
UPDATE public.spartan_profiles
SET trial_ends_at = created_at + interval '14 days'
WHERE trial_ends_at IS NULL;

-- Garantir que contas de administradores estejam sempre com status 'active'
ALTER TABLE public.spartan_profiles DISABLE TRIGGER USER;
UPDATE public.spartan_profiles p
SET status = 'active'
WHERE p.role = 'admin'
   OR EXISTS (
     SELECT 1 FROM public.spartan_platform_access pa
     WHERE pa.user_id = p.id AND pa.access_role IN ('admin', 'developer')
   );
ALTER TABLE public.spartan_profiles ENABLE TRIGGER USER;

-- 2. Atualizar spartan_handle_new_user() para iniciar novas contas de clientes em 'trialing' (14 dias)
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
    'trialing',
    now() + interval '14 days',
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

-- 3. Função que bloqueia automaticamente contas em período de teste ('trialing') após 14 dias
--    (com exceção absoluta das contas de administrador)
CREATE OR REPLACE FUNCTION public.spartan_sync_expired_trials()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  UPDATE public.spartan_profiles p
  SET
    status = 'overdue',
    updated_at = now()
  WHERE p.status = 'trialing'
    AND p.role <> 'admin'
    AND NOT EXISTS (
      SELECT 1 FROM public.spartan_platform_access pa
      WHERE pa.user_id = p.id AND pa.access_role IN ('admin', 'developer')
    )
    AND COALESCE(p.trial_ends_at, p.created_at + interval '14 days') <= now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spartan_sync_expired_trials() TO authenticated;

-- Executa imediatamente na aplicação da migration
SELECT public.spartan_sync_expired_trials();

COMMIT;

-- >>> Migration: 202610160005_isolate_user_deletion_and_companies.sql <<<
-- =============================================================================
-- MIGRATION: Blindagem de exclusão individual de cliente e isolamento 1:1 de company_id
-- Data: 2026-10-16
-- Garante que:
-- 1. Nenhum cliente compartilhe o mesmo company_id com outro cliente no banco.
-- 2. A função spartan_admin_delete_user(p_target_user_id) apague EXCLUSIVAMENTE
--    os registros cujo user_id seja igual a p_target_user_id, mantendo todos os
--    demais clientes 100% intactos sob qualquer circunstância.
-- =============================================================================

BEGIN;

-- 1. Se existir qualquer perfil compartilhando o mesmo company_id com outro usuário,
-- cria uma company exclusiva para cada usuário adicional para garantir isolamento 1:1.
ALTER TABLE public.spartan_profiles DISABLE TRIGGER USER;

DO $$
DECLARE
  r RECORD;
  v_new_company_id UUID;
BEGIN
  FOR r IN
    SELECT p.id AS profile_id, p.company_name, p.full_name, p.email, p.company_id
    FROM public.spartan_profiles p
    WHERE p.company_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.spartan_profiles p2
        WHERE p2.company_id = p.company_id
          AND p2.id <> p.id
          AND (p2.created_at < p.created_at OR (p2.created_at = p.created_at AND p2.id < p.id))
      )
  LOOP
    INSERT INTO public.spartan_companies (name, user_id)
    VALUES (
      COALESCE(NULLIF(BTRIM(r.company_name), ''), NULLIF(BTRIM(r.full_name), ''), split_part(COALESCE(r.email, 'Minha farm 3D'), '@', 1)),
      r.profile_id
    )
    RETURNING id INTO v_new_company_id;

    UPDATE public.spartan_profiles
    SET company_id = v_new_company_id
    WHERE id = r.profile_id;

    DELETE FROM public.spartan_company_memberships
    WHERE user_id = r.profile_id;

    INSERT INTO public.spartan_company_memberships (company_id, user_id, role)
    VALUES (v_new_company_id, r.profile_id, 'owner')
    ON CONFLICT DO NOTHING;

    -- Atualiza company_id nas tabelas de dados pertencentes estritamente a este user_id
    UPDATE public.spartan_projects SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_printers SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_filaments SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_printer_events SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_inventory_events SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_invoices SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_subscriptions SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_ai_usage_logs SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_ai_conversations SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_notifications SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_push_subscriptions SET company_id = v_new_company_id WHERE user_id = r.profile_id;
    UPDATE public.spartan_user_settings SET company_id = v_new_company_id WHERE user_id = r.profile_id;
  END LOOP;
END $$;

ALTER TABLE public.spartan_profiles ENABLE TRIGGER USER;

-- 2. Atualiza spartan_admin_delete_user para filtrar ESTRITAMENTE pelo p_target_user_id,
-- garantindo que nenhum dado de outro cliente seja jamais afetado.
CREATE OR REPLACE FUNCTION public.spartan_admin_delete_user(p_target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_company_id UUID;
  v_company_is_exclusive BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL OR NOT public.spartan_is_platform_admin() THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores da plataforma podem excluir usuários.';
  END IF;

  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'ID do usuário inválido.';
  END IF;

  IF p_target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode excluir sua própria conta de administrador.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.spartan_platform_access
    WHERE user_id = p_target_user_id AND access_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Não é permitido excluir outro administrador da plataforma.';
  END IF;

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

  -- 1. Remove apenas arquivos do usuário alvo no Supabase Storage
  DELETE FROM storage.objects
  WHERE owner = p_target_user_id
     OR owner_id = p_target_user_id::text
     OR name LIKE (p_target_user_id::text || '/%')
     OR (v_company_is_exclusive AND v_company_id IS NOT NULL AND name LIKE (v_company_id::text || '/%'));

  -- 2. Remove exclusivamente os dados pertencentes ao p_target_user_id
  -- (Jamais toca em registros onde user_id pertence a outro usuário)
  DELETE FROM public.spartan_printer_events
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_inventory_events
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_projects
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND created_by = p_target_user_id)
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_printers
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_filaments
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_invoices
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_subscriptions
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_ai_usage_logs
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_ai_conversations
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_notifications
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_push_subscriptions
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_user_settings
  WHERE user_id = p_target_user_id;

  DELETE FROM public.spartan_company_memberships
  WHERE user_id = p_target_user_id;

  DELETE FROM public.spartan_profiles
  WHERE id = p_target_user_id;

  -- Só remove o registro da empresa se nenhum outro perfil estiver vinculado a ela
  IF v_company_id IS NOT NULL AND v_company_is_exclusive THEN
    DELETE FROM public.spartan_companies
    WHERE id = v_company_id
      AND NOT EXISTS (
        SELECT 1 FROM public.spartan_profiles p WHERE p.company_id = v_company_id
      );
  END IF;

  DELETE FROM public.spartan_companies
  WHERE user_id = p_target_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.spartan_profiles p WHERE p.company_id = public.spartan_companies.id
    );

  -- 3. Remove exclusivamente as identidades e a conta do usuário alvo em auth.users
  DELETE FROM auth.identities WHERE user_id = p_target_user_id;
  DELETE FROM auth.users WHERE id = p_target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.spartan_admin_delete_user(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spartan_admin_delete_user(UUID) TO authenticated;

COMMIT;

-- >>> Migration: 202610160006_fix_admin_delete_user_403.sql <<<
-- =============================================================================
-- MIGRATION: Correção definitiva do erro HTTP 403 (SQLSTATE 42501) em spartan_admin_delete_user
-- Data: 2026-10-17
-- Causa raiz do 403 no PostgREST:
-- O Supabase Storage possui o trigger storage.protect_delete() em storage.objects que
-- lança SQLSTATE 42501 ("Direct deletion from storage tables is not allowed") caso
-- a flag local `storage.allow_delete_query = 'true'` não esteja ativa na transação.
-- O PostgREST converte qualquer SQLSTATE 42501 em HTTP 403 Forbidden.
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.spartan_admin_delete_user(p_target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage
AS $$
DECLARE
  v_company_id UUID;
  v_company_is_exclusive BOOLEAN := FALSE;
  v_caller_email TEXT;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sessão expirada. Faça login novamente.';
  END IF;

  -- Verifica se o usuário logado é administrador (via função, perfil, platform_access ou e-mail do proprietário)
  SELECT lower(coalesce(email, '')) INTO v_caller_email
  FROM auth.users
  WHERE id = auth.uid();

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

  IF EXISTS (
    SELECT 1 FROM public.spartan_platform_access
    WHERE user_id = p_target_user_id AND access_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Não é permitido excluir outro administrador da plataforma.';
  END IF;

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

  -- 1. Remove arquivos do usuário alvo no Supabase Storage
  -- Ativa `storage.allow_delete_query = 'true'` exigido pelo trigger storage.protect_delete()
  -- do Supabase para evitar SQLSTATE 42501 (HTTP 403 Forbidden).
  BEGIN
    PERFORM set_config('storage.allow_delete_query', 'true', true);

    DELETE FROM storage.objects
    WHERE owner = p_target_user_id
       OR owner_id = p_target_user_id::text
       OR name LIKE (p_target_user_id::text || '/%')
       OR (v_company_is_exclusive AND v_company_id IS NOT NULL AND name LIKE (v_company_id::text || '/%'));
  EXCEPTION WHEN OTHERS THEN
    -- Caso a versão do Supabase Storage bloqueie DELETE direto, desvincula o owner
    BEGIN
      UPDATE storage.objects
      SET owner = NULL, owner_id = NULL
      WHERE owner = p_target_user_id OR owner_id = p_target_user_id::text;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  -- 2. Remove exclusivamente os dados pertencentes ao p_target_user_id
  DELETE FROM public.spartan_printer_events
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_inventory_events
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_projects
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND created_by = p_target_user_id)
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_printers
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_filaments
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_invoices
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_subscriptions
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_ai_usage_logs
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_ai_conversations
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_notifications
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_push_subscriptions
  WHERE user_id = p_target_user_id
     OR (user_id IS NULL AND v_company_is_exclusive AND company_id = v_company_id);

  DELETE FROM public.spartan_user_settings
  WHERE user_id = p_target_user_id;

  DELETE FROM public.spartan_platform_access
  WHERE user_id = p_target_user_id;

  DELETE FROM public.spartan_company_memberships
  WHERE user_id = p_target_user_id;

  DELETE FROM public.spartan_profiles
  WHERE id = p_target_user_id;

  -- Só remove o registro da empresa se nenhum outro perfil estiver vinculado a ela
  IF v_company_id IS NOT NULL AND v_company_is_exclusive THEN
    DELETE FROM public.spartan_companies
    WHERE id = v_company_id
      AND NOT EXISTS (
        SELECT 1 FROM public.spartan_profiles p WHERE p.company_id = v_company_id
      );
  END IF;

  DELETE FROM public.spartan_companies
  WHERE user_id = p_target_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.spartan_profiles p WHERE p.company_id = public.spartan_companies.id
    );

  -- 3. Remove exclusivamente as identidades, sessões e a conta do usuário alvo em auth.users
  DELETE FROM auth.identities WHERE user_id = p_target_user_id;
  DELETE FROM auth.users WHERE id = p_target_user_id;
END;
$$;

ALTER FUNCTION public.spartan_admin_delete_user(UUID) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.spartan_admin_delete_user(UUID) TO authenticated, service_role;

-- Teste de verificação em transação para garantir que storage.allow_delete_query e auth.users
-- funcionam sem erro 42501 (403 Forbidden)
DO $$
DECLARE
  v_test_uid UUID := gen_random_uuid();
BEGIN
  PERFORM set_config('storage.allow_delete_query', 'true', true);
  DELETE FROM storage.objects WHERE owner = v_test_uid;
  DELETE FROM auth.identities WHERE user_id = v_test_uid;
  DELETE FROM auth.users WHERE id = v_test_uid;
END $$;

COMMIT;

-- >>> Migration: 202610160007_test_and_verify_admin_delete_rpc.sql <<<
-- =============================================================================
-- MIGRATION: Diagnóstico e correção de SQLSTATE 42501 em spartan_admin_delete_user
-- =============================================================================

BEGIN;

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
  v_is_admin BOOLEAN := FALSE;
  v_tbl TEXT;
  v_step TEXT := 'init';
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

  v_step := 'check_target_admin';
  IF EXISTS (
    SELECT 1 FROM public.spartan_platform_access
    WHERE user_id = p_target_user_id AND access_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Não é permitido excluir outro administrador da plataforma.';
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

  v_step := 'delete_projects_created_by';
  IF to_regclass('public.spartan_projects') IS NOT NULL THEN
    DELETE FROM public.spartan_projects
    WHERE user_id IS NULL AND created_by = p_target_user_id;
  END IF;

  v_step := 'delete_user_settings';
  IF to_regclass('public.spartan_user_settings') IS NOT NULL THEN
    DELETE FROM public.spartan_user_settings
    WHERE user_id = p_target_user_id;
  END IF;

  v_step := 'delete_platform_access';
  IF to_regclass('public.spartan_platform_access') IS NOT NULL THEN
    DELETE FROM public.spartan_platform_access
    WHERE user_id = p_target_user_id;
  END IF;

  v_step := 'delete_company_memberships';
  IF to_regclass('public.spartan_company_memberships') IS NOT NULL THEN
    DELETE FROM public.spartan_company_memberships
    WHERE user_id = p_target_user_id;
  END IF;

  v_step := 'delete_profiles';
  DELETE FROM public.spartan_profiles
  WHERE id = p_target_user_id;

  v_step := 'delete_companies';
  IF v_company_id IS NOT NULL AND v_company_is_exclusive THEN
    DELETE FROM public.spartan_companies
    WHERE id = v_company_id
      AND NOT EXISTS (
        SELECT 1 FROM public.spartan_profiles p WHERE p.company_id = v_company_id
      );
  END IF;

  DELETE FROM public.spartan_companies
  WHERE user_id = p_target_user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.spartan_profiles p WHERE p.company_id = public.spartan_companies.id
    );

  v_step := 'delete_auth_identities';
  DELETE FROM auth.identities WHERE user_id = p_target_user_id;

  v_step := 'delete_auth_users';
  DELETE FROM auth.users WHERE id = p_target_user_id;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'STEP=% USER=% SESSION=% ERR=% (SQLSTATE=%)', v_step, current_user, session_user, SQLERRM, SQLSTATE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spartan_admin_delete_user(UUID) TO anon, authenticated, service_role;

DO $$
DECLARE
  v_admin_id UUID;
  v_temp_user_id UUID := gen_random_uuid();
BEGIN
  SELECT id INTO v_admin_id
  FROM public.spartan_profiles
  WHERE role = 'admin'
     OR id IN (SELECT user_id FROM public.spartan_platform_access WHERE access_role = 'admin')
  LIMIT 1;

  IF v_admin_id IS NOT NULL THEN
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) VALUES (
      v_temp_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      'temp_delete_test_' || replace(v_temp_user_id::text, '-', '') || '@example.com',
      'encrypted',
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Teste Exclusao","company_name":"Farm Teste"}'::jsonb,
      now(),
      now()
    );

    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);

    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM public.spartan_admin_delete_user(v_temp_user_id);
    EXECUTE 'RESET ROLE';
  END IF;
END $$;

COMMIT;

-- >>> Migration: 202610160008_fix_real_user_deletion_fks.sql <<<
-- =============================================================================
-- MIGRATION: Desvinculação circular de FKs e limpeza automática de todas as
-- referências a auth.users / spartan_profiles / spartan_companies antes da exclusão
-- Data: 2026-10-17
-- =============================================================================

BEGIN;

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

  v_step := 'check_target_admin';
  IF EXISTS (
    SELECT 1 FROM public.spartan_platform_access
    WHERE user_id = p_target_user_id AND access_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Não é permitido excluir outro administrador da plataforma.';
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

  v_step := 'delete_projects_created_by';
  IF to_regclass('public.spartan_projects') IS NOT NULL THEN
    DELETE FROM public.spartan_projects
    WHERE created_by = p_target_user_id;
  END IF;

  v_step := 'delete_user_settings';
  IF to_regclass('public.spartan_user_settings') IS NOT NULL THEN
    DELETE FROM public.spartan_user_settings
    WHERE user_id = p_target_user_id;
  END IF;

  v_step := 'delete_platform_access';
  IF to_regclass('public.spartan_platform_access') IS NOT NULL THEN
    DELETE FROM public.spartan_platform_access
    WHERE user_id = p_target_user_id;
  END IF;

  v_step := 'delete_company_memberships';
  IF to_regclass('public.spartan_company_memberships') IS NOT NULL THEN
    DELETE FROM public.spartan_company_memberships
    WHERE user_id = p_target_user_id
       OR (v_company_is_exclusive AND company_id = v_company_id);
  END IF;

  v_step := 'delete_profiles';
  DELETE FROM public.spartan_profiles
  WHERE id = p_target_user_id;

  -- 4. Antes de remover a company exclusiva, limpa quaisquer referências residuais a v_company_id em tabelas onde user_id era NULL
  IF v_company_id IS NOT NULL AND v_company_is_exclusive THEN
    v_step := 'cleanup_exclusive_company_refs';
    FOR r_fk IN
      SELECT c.relname AS table_name, a.attname AS column_name
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

  -- 5. Remove exclusivamente as identidades e a conta do usuário alvo em auth.users
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

-- Simulação DRY-RUN (com rollback automático por subtransação) em TODOS os clientes reais
-- cadastrados no banco para validar que 100% deles podem ser excluídos sem nenhum erro!
DO $$
DECLARE
  v_admin_id UUID;
  r_client RECORD;
BEGIN
  SELECT id INTO v_admin_id
  FROM public.spartan_profiles
  WHERE role = 'admin'
     OR id IN (SELECT user_id FROM public.spartan_platform_access WHERE access_role = 'admin')
  LIMIT 1;

  IF v_admin_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', v_admin_id::text, true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin_id::text, 'role', 'authenticated')::text, true);

    FOR r_client IN
      SELECT id, email
      FROM public.spartan_profiles
      WHERE id <> v_admin_id
        AND role <> 'admin'
        AND id NOT IN (SELECT user_id FROM public.spartan_platform_access WHERE access_role = 'admin')
    LOOP
      BEGIN
        EXECUTE 'SET LOCAL ROLE authenticated';
        PERFORM public.spartan_admin_delete_user(r_client.id);
        EXECUTE 'RESET ROLE';
        -- Força rollback desta subtransação para não apagar os clientes durante o teste!
        RAISE EXCEPTION '__DRY_RUN_ROLLBACK__';
      EXCEPTION
        WHEN OTHERS THEN
          EXECUTE 'RESET ROLE';
          IF SQLERRM <> '__DRY_RUN_ROLLBACK__' THEN
            RAISE EXCEPTION 'Falha na simulação de exclusão do cliente real % (%): %', r_client.email, r_client.id, SQLERRM;
          END IF;
      END;
    END LOOP;
  END IF;
END $$;

COMMIT;

-- >>> Migration: 202610160009_bulletproof_admin_delete_user.sql <<<
-- =============================================================================
-- MIGRATION: Blindagem total de FKs em spartan_admin_delete_user e reload do PostgREST
-- Data: 2026-10-17
-- =============================================================================

BEGIN;

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

  IF v_target_email = 'gsroboticmania@gmail.com' OR EXISTS (
    SELECT 1 FROM public.spartan_platform_access
    WHERE user_id = p_target_user_id AND access_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Não é permitido excluir a conta principal de administrador da plataforma.';
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

NOTIFY pgrst, 'reload schema';

COMMIT;

-- >>> Migration: 202610160010_prevent_repeat_free_trial.sql <<<
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

-- >>> Migration: 202610160011_fix_set_project_status_and_stock_rpcs.sql <<<
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

-- >>> Migration: 202610160012_sync_active_printing_projects_and_progress.sql <<<
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

-- >>> Migration: 202610160013_add_optional_customer_phone_to_projects.sql <<<
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

-- >>> Migration: 202610160014_persist_printer_investment_and_roi.sql <<<
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

-- >>> Migration: 202610230001_persist_user_company_phone_on_signup.sql <<<
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

-- >>> Migration: 202610230002_platform_pix_config_rpc.sql <<<
-- =============================================================================
-- Permite que qualquer assinante/cliente autenticado obtenha a chave Pix oficial
-- da plataforma (definida pelo Administrador) para pagamento de faturas e assinaturas.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.spartan_get_platform_pix_config()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_admin_id UUID;
  v_settings JSONB;
BEGIN
  -- 1. Localiza o ID do administrador principal na tabela de acessos
  SELECT user_id INTO v_admin_id
  FROM public.spartan_platform_access
  WHERE access_role = 'admin'
  LIMIT 1;

  -- 2. Fallback por perfil com role = 'admin' ou email do proprietário
  IF v_admin_id IS NULL THEN
    SELECT id INTO v_admin_id
    FROM public.spartan_profiles
    WHERE lower(btrim(email)) IN ('gsroboticmania@gmail.com', 'gleisson1984@hotmail.com', 'gleison@hotmail.com')
       OR role = 'admin'
    LIMIT 1;
  END IF;

  -- 3. Se encontrou o admin, busca suas configurações de pagamento em spartan_user_settings
  IF v_admin_id IS NOT NULL THEN
    SELECT payment_settings INTO v_settings
    FROM public.spartan_user_settings
    WHERE user_id = v_admin_id;

    IF v_settings IS NOT NULL THEN
      IF v_settings->'admin_pix' IS NOT NULL AND coalesce(v_settings->'admin_pix'->>'chave', '') <> '' THEN
        RETURN v_settings->'admin_pix';
      END IF;

      IF coalesce(v_settings->>'pixKey', '') <> '' THEN
        RETURN jsonb_build_object(
          'chave', v_settings->>'pixKey',
          'tipoChave', coalesce(v_settings->>'pixKeyType', 'email'),
          'nomeTitular', coalesce(v_settings->>'pixBeneficiary', 'SPARTAN 3D PRINT'),
          'cidade', coalesce(v_settings->>'pixCity', 'MANAUS')
        );
      END IF;
    END IF;
  END IF;

  -- 4. Fallback padrão com os dados reais do proprietário
  RETURN jsonb_build_object(
    'chave', 'gsroboticmania@gmail.com',
    'tipoChave', 'email',
    'nomeTitular', 'SPARTAN 3D PRINT',
    'cidade', 'MANAUS'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.spartan_get_platform_pix_config() TO authenticated, anon;
