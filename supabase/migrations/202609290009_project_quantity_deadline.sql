alter table public.spartan_projects
  add column if not exists quantity integer not null default 1 check (quantity > 0),
  add column if not exists due_date date;
