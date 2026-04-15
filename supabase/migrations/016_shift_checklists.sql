-- 016_shift_checklists.sql
-- Shift checklist templates (manager-managed) and per-shift submissions (shift leader fills out)

-- ─── Templates ────────────────────────────────────────────────────────────────
-- One row per (location, shift_type). Managers add/remove/reorder items.
create table if not exists public.shift_checklist_templates (
  id          uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.locations(id) on delete cascade,
  shift_type  text not null check (shift_type in ('morning', 'evening')),
  items       jsonb not null default '[]',
  updated_at  timestamptz,
  unique(location_id, shift_type)
);

create index if not exists idx_checklist_templates_location on public.shift_checklist_templates(location_id);

alter table public.shift_checklist_templates enable row level security;
create policy "anon read checklist_templates"   on public.shift_checklist_templates for select using (true);
create policy "anon insert checklist_templates" on public.shift_checklist_templates for insert with check (true);
create policy "anon update checklist_templates" on public.shift_checklist_templates for update using (true);
create policy "anon delete checklist_templates" on public.shift_checklist_templates for delete using (true);

-- ─── Submissions ──────────────────────────────────────────────────────────────
-- One row per (location, shift_type, date). Auto-created the first time a
-- shift leader opens the checklist for that day's shift. Resets each shift day.
create table if not exists public.shift_checklist_submissions (
  id            uuid primary key default gen_random_uuid(),
  location_id   uuid not null references public.locations(id) on delete cascade,
  shift_type    text not null check (shift_type in ('morning', 'evening')),
  date          date not null,
  submitted_by  uuid references public.employees(id) on delete set null,
  checked_items jsonb not null default '[]', -- parallel boolean array to template items
  is_complete   boolean not null default false,
  submitted_at  timestamptz not null default now(),
  unique(location_id, shift_type, date)
);

create index if not exists idx_checklist_submissions_location on public.shift_checklist_submissions(location_id);
create index if not exists idx_checklist_submissions_date     on public.shift_checklist_submissions(date);

alter table public.shift_checklist_submissions enable row level security;
create policy "anon read checklist_submissions"   on public.shift_checklist_submissions for select using (true);
create policy "anon insert checklist_submissions" on public.shift_checklist_submissions for insert with check (true);
create policy "anon update checklist_submissions" on public.shift_checklist_submissions for update using (true);

-- ─── Seed default templates ───────────────────────────────────────────────────
insert into public.shift_checklist_templates (location_id, shift_type, items)
values
  ('22222222-2222-4222-8222-222222222222', 'morning', '[
    "Check cash register and float",
    "Restock napkins, cutlery and condiments",
    "Check fridge and freezer temperature log",
    "Start coffee and drinks equipment",
    "Complete opening inspection walkthrough",
    "Brief team on daily specials and staffing"
  ]'),
  ('22222222-2222-4222-8222-222222222222', 'evening', '[
    "Clean all prep surfaces and stations",
    "Count cash register and prepare deposit",
    "Check and log closing stock levels",
    "Power down all equipment safely",
    "Mop floors and empty bins",
    "Lock up and set alarm"
  ]')
on conflict (location_id, shift_type) do nothing;
