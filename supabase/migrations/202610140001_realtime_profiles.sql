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
