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
