-- 010_authenticated_rls.sql
-- Migration 003 added RLS policies only for the `anon` role.
-- Once users log in they become `authenticated`, so all those tables return empty.
-- This migration mirrors the same open policies for the `authenticated` role.

-- Locations
create policy "Allow authenticated read locations"
  on public.locations for select to authenticated using (true);

create policy "Allow authenticated insert locations"
  on public.locations for insert to authenticated with check (true);

create policy "Allow authenticated update locations"
  on public.locations for update to authenticated using (true) with check (true);

create policy "Allow authenticated delete locations"
  on public.locations for delete to authenticated using (true);

-- Employees
create policy "Allow authenticated read employees"
  on public.employees for select to authenticated using (true);

create policy "Allow authenticated insert employees"
  on public.employees for insert to authenticated with check (true);

create policy "Allow authenticated update employees"
  on public.employees for update to authenticated using (true) with check (true);

create policy "Allow authenticated delete employees"
  on public.employees for delete to authenticated using (true);

-- Shifts
create policy "Allow authenticated read shifts"
  on public.shifts for select to authenticated using (true);

create policy "Allow authenticated insert shifts"
  on public.shifts for insert to authenticated with check (true);

create policy "Allow authenticated update shifts"
  on public.shifts for update to authenticated using (true) with check (true);

create policy "Allow authenticated delete shifts"
  on public.shifts for delete to authenticated using (true);
