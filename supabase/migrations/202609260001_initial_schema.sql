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
