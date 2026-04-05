-- 007_auth_roles.sql
-- Creates user_profiles linked to Supabase auth.users with role-based access.

create table if not exists public.user_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null default 'user'
                 check (role in ('super_admin','admin','user_lead','user')),
  employee_id  uuid references public.employees(id) on delete set null,
  full_name    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz
);

alter table public.user_profiles enable row level security;

-- Authenticated users can read their own profile
create policy "users can read own profile"
  on public.user_profiles for select
  to authenticated
  using (auth.uid() = id);

-- Authenticated users can update their own display name (not role)
create policy "users can update own name"
  on public.user_profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select role from public.user_profiles where id = auth.uid())
  );

-- ─── auto-create profile on sign-up ──────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── notes ───────────────────────────────────────────────────────────────────
-- To assign a role after creating a user via the Supabase dashboard:
--   update public.user_profiles set role = 'admin' where id = '<user-uuid>';
--
-- Role hierarchy (highest → lowest):
--   super_admin  full system access
--   admin        scheduling, employees, AI agent, all features
--   user_lead    shift logs, sales, inventory, tasks, schedule (view)
--   user         tasks, schedule (view), chat
