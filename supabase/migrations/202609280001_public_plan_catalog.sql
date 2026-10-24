-- Public signup and pricing pages need to read active plan definitions.
grant select on public.spartan_plans to anon;
notify pgrst, 'reload schema';
