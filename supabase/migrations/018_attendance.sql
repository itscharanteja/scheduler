-- Migration: 018_attendance
-- Creates attendance_sessions table for employee punch in/out tracking.
-- Access control is enforced at the API layer; service role bypasses RLS for all server queries.

create table if not exists public.attendance_sessions (
  id              uuid primary key default gen_random_uuid(),
  employee_id     uuid not null references public.employees(id) on delete cascade,
  location_id     uuid not null references public.locations(id) on delete cascade,
  clocked_in_at   timestamptz not null default now(),
  clocked_out_at  timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists attendance_sessions_employee_id_idx
  on public.attendance_sessions(employee_id, clocked_in_at desc);

create index if not exists attendance_sessions_location_id_idx
  on public.attendance_sessions(location_id, clocked_in_at desc);

alter table public.attendance_sessions enable row level security;

-- Service role (used by all API routes) bypasses RLS automatically.
-- Authenticated users can read their own sessions (for future client-side use).
create policy "authenticated read own attendance"
  on public.attendance_sessions
  for select
  to authenticated
  using (
    employee_id = (
      select employee_id from public.user_profiles where id = auth.uid()
    )
  );
