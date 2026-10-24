-- Permite que administradores da plataforma criem e alterem faturas de qualquer cliente/empresa
drop policy if exists "platform admins can insert invoices" on public.spartan_invoices;
create policy "platform admins can insert invoices" on public.spartan_invoices
  for insert with check (public.spartan_is_company_member(company_id) or public.spartan_is_platform_admin());

drop policy if exists "platform admins can update invoices" on public.spartan_invoices;
create policy "platform admins can update invoices" on public.spartan_invoices
  for update using (public.spartan_is_company_admin(company_id) or public.spartan_is_platform_admin())
  with check (public.spartan_is_company_admin(company_id) or public.spartan_is_platform_admin());

drop policy if exists "platform admins can delete invoices" on public.spartan_invoices;
create policy "platform admins can delete invoices" on public.spartan_invoices
  for delete using (public.spartan_is_company_admin(company_id) or public.spartan_is_platform_admin());
