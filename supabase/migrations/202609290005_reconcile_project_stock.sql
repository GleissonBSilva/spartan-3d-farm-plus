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
