-- 006_tasks.sql
-- Creates shift_logs (for API / AI scheduling flow) and tasks (for the UI task board)

-- ─── shift_logs ───────────────────────────────────────────────────────────────
create table if not exists public.shift_logs (
  id               uuid primary key default gen_random_uuid(),
  location_id      uuid not null references public.locations(id) on delete cascade,
  shift_leader_id  uuid not null references public.employees(id) on delete cascade,
  date             date not null,
  shift_type       text not null check (shift_type in ('morning','lunch','evening','full')),
  notes            text not null default '',
  issues_flagged   boolean not null default false,
  tasks_completed  jsonb not null default '[]',
  tasks_pending    jsonb not null default '[]',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz
);

create index if not exists idx_shift_logs_location_id on public.shift_logs(location_id);
create index if not exists idx_shift_logs_date        on public.shift_logs(date);

alter table public.shift_logs enable row level security;

create policy "anon can read shift_logs"
  on public.shift_logs for select using (true);
create policy "anon can insert shift_logs"
  on public.shift_logs for insert with check (true);
create policy "anon can update shift_logs"
  on public.shift_logs for update using (true);

-- ─── tasks ────────────────────────────────────────────────────────────────────
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.locations(id) on delete cascade,
  title        text not null,
  note         text not null default '',
  category     text not null default 'ops' check (category in ('ops','staff','stock','guest')),
  priority     text not null default 'medium' check (priority in ('low','medium','high')),
  status       text not null default 'open' check (status in ('open','delegated','done')),
  assignee_id  uuid references public.employees(id) on delete set null,
  due_time     timestamptz,
  created_at   timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_tasks_location_id on public.tasks(location_id);
create index if not exists idx_tasks_status      on public.tasks(status);

alter table public.tasks enable row level security;

create policy "anon can read tasks"
  on public.tasks for select using (true);
create policy "anon can insert tasks"
  on public.tasks for insert with check (true);
create policy "anon can update tasks"
  on public.tasks for update using (true);
create policy "anon can delete tasks"
  on public.tasks for delete using (true);

-- ─── seed tasks ───────────────────────────────────────────────────────────────
do $$
declare
  loc_id  uuid := '22222222-2222-4222-8222-222222222222';
  emp1    uuid;
  emp2    uuid;
  emp3    uuid;
begin
  select id into emp1 from public.employees where location_id = loc_id order by name limit 1 offset 0;
  select id into emp2 from public.employees where location_id = loc_id order by name limit 1 offset 1;
  select id into emp3 from public.employees where location_id = loc_id order by name limit 1 offset 2;

  insert into public.tasks (location_id, title, note, category, priority, status, assignee_id, due_time) values
    (loc_id, 'Restock front-counter napkins',  'Running low — grab from storage B2',   'stock',  'high',   'open',      emp1, now() + interval '2 hours'),
    (loc_id, 'Deep-clean fryer station',        'Scheduled weekly clean',               'ops',    'medium', 'open',      emp2, now() + interval '4 hours'),
    (loc_id, 'Brief new hire on closing steps', 'First solo closing shift tonight',     'staff',  'high',   'delegated', emp1, now() + interval '6 hours'),
    (loc_id, 'Check cooler temperature log',    'Log every 2h per health code',         'ops',    'medium', 'done',      emp3, now() - interval '1 hour'),
    (loc_id, 'Respond to guest review',         'Negative Google review from yesterday','guest',  'low',    'open',      null, now() + interval '1 day'),
    (loc_id, 'Reorder coffee cups (M/L)',       'Stock down to last sleeve',            'stock',  'medium', 'open',      emp2, now() + interval '3 hours');
end;
$$;
