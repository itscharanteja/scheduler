-- 019_custom_forms.sql
-- Custom form builder: forms, fields, submissions, and per-field responses.
-- Access control is enforced at the API layer; RLS uses permissive anon policies
-- consistent with the rest of the schema.

-- ─── custom_forms ─────────────────────────────────────────────────────────────
create table if not exists public.custom_forms (
  id           uuid primary key default gen_random_uuid(),
  location_id  uuid not null references public.locations(id) on delete cascade,
  name         text not null,
  description  text not null default '',
  is_active    boolean not null default true,
  created_by   uuid references public.employees(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_custom_forms_location
  on public.custom_forms(location_id, is_active);

alter table public.custom_forms enable row level security;
create policy "anon read custom_forms"   on public.custom_forms for select using (true);
create policy "anon insert custom_forms" on public.custom_forms for insert with check (true);
create policy "anon update custom_forms" on public.custom_forms for update using (true);
create policy "anon delete custom_forms" on public.custom_forms for delete using (true);


-- ─── custom_form_fields ───────────────────────────────────────────────────────
-- config JSONB is a discriminated union per field_type:
--   text:     { "placeholder"?: string, "multiline"?: boolean }
--   number:   { "min"?: number, "max"?: number, "unit"?: string }
--   checkbox: {}
--   date:     {}
--   select:   { "options"?: string[], "linked_source"?: "employees"|"inventory" }
create table if not exists public.custom_form_fields (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.custom_forms(id) on delete cascade,
  label        text not null,
  field_type   text not null check (field_type in ('text','number','checkbox','date','select')),
  config       jsonb not null default '{}',
  order_index  integer not null default 0,
  is_required  boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_custom_form_fields_form
  on public.custom_form_fields(form_id, order_index asc);

alter table public.custom_form_fields enable row level security;
create policy "anon read custom_form_fields"   on public.custom_form_fields for select using (true);
create policy "anon insert custom_form_fields" on public.custom_form_fields for insert with check (true);
create policy "anon update custom_form_fields" on public.custom_form_fields for update using (true);
create policy "anon delete custom_form_fields" on public.custom_form_fields for delete using (true);


-- ─── custom_form_submissions ──────────────────────────────────────────────────
-- One row per submission event. `date` is the operational day (not the timestamp).
create table if not exists public.custom_form_submissions (
  id           uuid primary key default gen_random_uuid(),
  form_id      uuid not null references public.custom_forms(id) on delete cascade,
  location_id  uuid not null references public.locations(id) on delete cascade,
  submitted_by uuid references public.employees(id) on delete set null,
  date         date not null default current_date,
  created_at   timestamptz not null default now()
);

create index if not exists idx_custom_form_submissions_form
  on public.custom_form_submissions(form_id, date desc);
create index if not exists idx_custom_form_submissions_location
  on public.custom_form_submissions(location_id, date desc);

alter table public.custom_form_submissions enable row level security;
create policy "anon read custom_form_submissions"   on public.custom_form_submissions for select using (true);
create policy "anon insert custom_form_submissions" on public.custom_form_submissions for insert with check (true);
-- No delete policy: submissions are kept for audit


-- ─── custom_form_responses ────────────────────────────────────────────────────
-- One row per field per submission. Value JSONB encodes the typed value:
--   text     → { "text": "some string" }
--   number   → { "number": 3.5 }
--   checkbox → { "checked": true }
--   date     → { "date": "2026-05-07" }
--   select   → { "value": "option-string-or-employee-uuid" }
create table if not exists public.custom_form_responses (
  id            uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.custom_form_submissions(id) on delete cascade,
  field_id      uuid not null references public.custom_form_fields(id) on delete cascade,
  value         jsonb not null default 'null',
  created_at    timestamptz not null default now(),
  unique(submission_id, field_id)
);

create index if not exists idx_custom_form_responses_submission
  on public.custom_form_responses(submission_id);

alter table public.custom_form_responses enable row level security;
create policy "anon read custom_form_responses"   on public.custom_form_responses for select using (true);
create policy "anon insert custom_form_responses" on public.custom_form_responses for insert with check (true);
-- No delete policy: responses are kept for audit
