alter table public.spartan_printers
  add column if not exists hours_since_maintenance numeric(12,2) not null default 0 check (hours_since_maintenance >= 0),
  add column if not exists maintenance_interval_hours integer not null default 100 check (maintenance_interval_hours > 0);

alter table public.spartan_printers drop constraint if exists spartan_printers_status_check;
alter table public.spartan_printers add constraint spartan_printers_status_check
  check (status in ('imprimindo', 'pausada', 'disponivel', 'manutencao', 'desconectada'));

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
  if printer_row.current_project_id is null and p_status = 'pausada' then raise exception 'There is no active project to pause'; end if;
  update public.spartan_printers set status = p_status, updated_at = now() where id = p_printer_id;
end;
$$;
grant execute on function public.spartan_set_printer_status(uuid, text) to authenticated;

create or replace function public.spartan_update_printer_progress(p_printer_id uuid, p_progress integer)
returns void language plpgsql security invoker set search_path = public as $$
declare printer_row public.spartan_printers%rowtype;
begin
  if p_progress < 0 or p_progress > 100 then raise exception 'Progress must be between 0 and 100'; end if;
  select * into printer_row from public.spartan_printers where id = p_printer_id for update;
  if not found or not public.spartan_is_company_member(printer_row.company_id) then raise exception 'Printer not found'; end if;
  if printer_row.current_project_id is null then raise exception 'There is no active project'; end if;
  update public.spartan_printers set progress_percent = p_progress, updated_at = now() where id = p_printer_id;
end;
$$;
grant execute on function public.spartan_update_printer_progress(uuid, integer) to authenticated;

create or replace function public.spartan_record_printer_maintenance(p_printer_id uuid, p_tasks text[], p_note text default '')
returns void language plpgsql security invoker set search_path = public as $$
declare printer_row public.spartan_printers%rowtype;
begin
  select * into printer_row from public.spartan_printers where id = p_printer_id for update;
  if not found or not public.spartan_is_company_member(printer_row.company_id) then raise exception 'Printer not found'; end if;
  if printer_row.current_project_id is not null then raise exception 'Finish or cancel the current project before recording maintenance'; end if;
  update public.spartan_printers set status = 'disponivel', hours_since_maintenance = 0, updated_at = now() where id = p_printer_id;
  insert into public.spartan_printer_events(company_id, printer_id, event_type, payload)
    values (printer_row.company_id, printer_row.id, 'maintenance_completed', jsonb_build_object('tasks', coalesce(p_tasks, array[]::text[]), 'note', coalesce(p_note, ''), 'completed_at', now()));
end;
$$;
grant execute on function public.spartan_record_printer_maintenance(uuid, text[], text) to authenticated;

create or replace function public.spartan_log_printer_status_change()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if old.status is distinct from new.status then
    insert into public.spartan_printer_events(company_id, printer_id, event_type, payload)
      values (new.company_id, new.id, 'status_changed', jsonb_build_object('from', old.status, 'to', new.status, 'project', new.current_project_name));
  end if;
  return new;
end;
$$;
drop trigger if exists spartan_printer_status_history on public.spartan_printers;
create trigger spartan_printer_status_history after update of status on public.spartan_printers
for each row execute function public.spartan_log_printer_status_change();

create or replace function public.spartan_log_completed_printer_hours()
returns trigger language plpgsql security invoker set search_path = public as $$
declare printer_row public.spartan_printers%rowtype;
begin
  if new.status = 'concluido' and old.status is distinct from 'concluido' and new.printer_id is not null then
    update public.spartan_printers set hours_used = hours_used + new.estimated_hours,
      hours_since_maintenance = hours_since_maintenance + new.estimated_hours, updated_at = now()
      where id = new.printer_id returning * into printer_row;
    if found then
      insert into public.spartan_printer_events(company_id, printer_id, event_type, payload)
        values (printer_row.company_id, printer_row.id, 'project_completed', jsonb_build_object('project_id', new.id, 'project_name', new.part_name, 'hours', new.estimated_hours));
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists spartan_project_printer_hours on public.spartan_projects;
create trigger spartan_project_printer_hours after update of status on public.spartan_projects
for each row execute function public.spartan_log_completed_printer_hours();

do $$
declare project_row public.spartan_projects%rowtype; printer_row public.spartan_printers%rowtype;
begin
  for project_row in
    select p.* from public.spartan_projects p
    where p.status = 'concluido' and p.printer_id is not null
      and not exists (select 1 from public.spartan_printer_events e where e.event_type = 'project_completed' and e.payload->>'project_id' = p.id::text)
  loop
    update public.spartan_printers set hours_used = hours_used + project_row.estimated_hours,
      hours_since_maintenance = hours_since_maintenance + project_row.estimated_hours, updated_at = now()
      where id = project_row.printer_id returning * into printer_row;
    if found then
      insert into public.spartan_printer_events(company_id, printer_id, event_type, payload)
        values (printer_row.company_id, printer_row.id, 'project_completed', jsonb_build_object('project_id', project_row.id, 'project_name', project_row.part_name, 'hours', project_row.estimated_hours, 'historical', true));
    end if;
  end loop;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'spartan_printer_events') then
    alter publication supabase_realtime add table public.spartan_printer_events;
  end if;
end $$;
