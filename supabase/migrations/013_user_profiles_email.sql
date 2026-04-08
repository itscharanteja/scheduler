-- 013_user_profiles_email.sql
-- Separate email from full_name in user_profiles.
-- Previously the handle_new_user() trigger stored email as full_name fallback,
-- causing email addresses to appear as display names throughout the app.

-- ─── add email column ─────────────────────────────────────────────────────────
alter table public.user_profiles
  add column if not exists email text;

-- ─── backfill email from auth.users ──────────────────────────────────────────
update public.user_profiles up
set email = au.email
from auth.users au
where au.id = up.id
  and up.email is null;

-- ─── clear full_name where it was set to the email (trigger fallback) ─────────
-- Only clear when full_name matches email exactly (the trigger stored email there)
update public.user_profiles
set full_name = null
where full_name is not null
  and full_name = email;

-- ─── fix the trigger: store email separately, leave full_name null if unknown ──
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    -- Only store a real name; do NOT fall back to email
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), '')
  );
  return new;
end;
$$;
