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
