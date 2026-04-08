-- 011_user_profiles_rls.sql
-- user_profiles has no RLS policies, so authenticated users cannot read their own profile.
-- AuthContext.fetchProfile silently returns nothing until these policies are added.

alter table public.user_profiles enable row level security;

-- Users can read their own profile (used by AuthContext to load role + name)
create policy "Users can read own profile"
  on public.user_profiles for select to authenticated
  using (id = auth.uid());

-- Users can update their own profile (e.g. name changes in the future)
create policy "Users can update own profile"
  on public.user_profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Note: INSERT is handled by the handle_new_user() trigger which runs as postgres
-- (bypasses RLS), so no insert policy is needed for authenticated users.
-- The service role key used in /api/admin/invite-employee also bypasses RLS.
