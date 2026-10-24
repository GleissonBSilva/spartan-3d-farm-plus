create or replace function public.spartan_set_printer_status(p_printer_id uuid, p_status text)
returns void language plpgsql security invoker set search_path = public as $$
declare printer_row public.spartan_printers%rowtype;
begin
  if p_status not in ('imprimindo', 'pausada', 'disponivel', 'manutencao', 'desconectada') then raise exception 'Invalid printer status'; end if;
  select * into printer_row from public.spartan_printers where id = p_printer_id for update;
  if not found or not public.spartan_is_company_member(printer_row.company_id) then raise exception 'Printer not found'; end if;
  if printer_row.current_project_id is not null and p_status in ('disponivel', 'manutencao', 'desconectada') then
    raise exception 'Finish or cancel the assigned project before changing printer status';
  end if;
  update public.spartan_printers set status = p_status, updated_at = now() where id = p_printer_id;
end;
$$;
grant execute on function public.spartan_set_printer_status(uuid, text) to authenticated;
