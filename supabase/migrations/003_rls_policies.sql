-- RLS was enabled in 001 but no policies were added, so all SELECTs return no rows.
-- This migration adds policies so the app (using anon key) can read and write data.
-- Tighten these later when you add auth (e.g. allow only authenticated users to write).

-- Locations: allow read and write for anon (used by app without auth for now)
create policy "Allow anon read locations"
  on public.locations for select to anon using (true);

create policy "Allow anon insert locations"
  on public.locations for insert to anon with check (true);

create policy "Allow anon update locations"
  on public.locations for update to anon using (true) with check (true);

create policy "Allow anon delete locations"
  on public.locations for delete to anon using (true);

-- Employees: allow read and write for anon
create policy "Allow anon read employees"
  on public.employees for select to anon using (true);

create policy "Allow anon insert employees"
  on public.employees for insert to anon with check (true);

create policy "Allow anon update employees"
  on public.employees for update to anon using (true) with check (true);

create policy "Allow anon delete employees"
  on public.employees for delete to anon using (true);

-- Shifts: allow read and write for anon
create policy "Allow anon read shifts"
  on public.shifts for select to anon using (true);

create policy "Allow anon insert shifts"
  on public.shifts for insert to anon with check (true);

create policy "Allow anon update shifts"
  on public.shifts for update to anon using (true) with check (true);

create policy "Allow anon delete shifts"
  on public.shifts for delete to anon using (true);
