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
