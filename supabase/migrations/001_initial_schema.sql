-- Enable required extensions
create extension if not exists "pgcrypto";

-- 1. locations
create table public.locations (
  id uuid primary key,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

-- 2. employees
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('service', 'shiftleader', 'rutin')),
  contract_hours integer not null,
  max_weekly_hours integer not null,
  employment_type text not null check (employment_type in ('full-time', 'part-time', 'hourly')),
  phone text,
  location_id uuid references public.locations(id),
  hourly_rate numeric(8, 2),
  created_at timestamptz not null default now()
);

-- 3. shifts
create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  role text not null,
  location_id uuid references public.locations(id),
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by_ai boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

-- Helpful indexes
create index idx_employees_location_id on public.employees(location_id);
create index idx_shifts_employee_id on public.shifts(employee_id);
create index idx_shifts_date on public.shifts(date);
create index idx_shifts_location_id on public.shifts(location_id);

-- Enable Row Level Security
alter table public.locations enable row level security;
alter table public.employees enable row level security;
alter table public.shifts enable row level security;

-- Seed data

-- Seed 1 location: Mister York Gothenburg
insert into public.locations (id, name, address)
values (
  '11111111-1111-4111-8111-111111111111',
  'Mister York Gothenburg',
  'Gothenburg, Sweden'
);

-- Seed 6 sample employees with different roles and employment types
insert into public.employees
  (name, role, contract_hours, max_weekly_hours, employment_type, phone, location_id, hourly_rate)
values
  ('Anna Andersson', 'service', 40, 40, 'full-time', '+46 70 111 11 11', '11111111-1111-4111-8111-111111111111', 145.00),
  ('Björn Berg', 'shiftleader', 30, 32, 'part-time', '+46 70 222 22 22', '11111111-1111-4111-8111-111111111111', 165.00),
  ('Carla Lind', 'rutin', 40, 45, 'full-time', '+46 70 333 33 33', '11111111-1111-4111-8111-111111111111', 190.00),
  ('David Nilsson', 'service', 20, 25, 'part-time', '+46 70 444 44 44', '11111111-1111-4111-8111-111111111111', 130.00),
  ('Elin Svensson', 'rutin', 15, 20, 'part-time', '+46 70 555 55 55', '11111111-1111-4111-8111-111111111111', 150.00),
  ('Fred Holm', 'service', 0, 30, 'hourly', '+46 70 666 66 66', '11111111-1111-4111-8111-111111111111', 140.00);

