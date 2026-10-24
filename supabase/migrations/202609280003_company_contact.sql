alter table public.spartan_profiles
  add column if not exists company_phone text not null default '';
