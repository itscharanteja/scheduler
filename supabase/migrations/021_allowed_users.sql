-- 021_allowed_users.sql
-- Table of pre-approved email addresses permitted to register via /signup

create table if not exists public.allowed_users (
  email text primary key,
  role text not null default 'user' check (role in ('super_admin','admin','user_lead','user')),
  full_name text,
  created_at timestamptz not null default now()
);

alter table public.allowed_users enable row level security;

-- Authenticated users can view and manage allowed users if they are admin or super_admin
create policy "admins can manage allowed_users"
  on public.allowed_users
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles
      where id = auth.uid() and role in ('admin', 'super_admin')
    )
  );
