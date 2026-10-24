alter table public.spartan_filaments
  add column if not exists minimum_stock_g integer not null default 200 check (minimum_stock_g >= 0);
