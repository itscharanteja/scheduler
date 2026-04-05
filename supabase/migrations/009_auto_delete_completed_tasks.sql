-- 009_auto_delete_completed_tasks.sql
-- Automatically deletes completed tasks 10 minutes after completion
-- Requires pg_cron extension (enable in Supabase Dashboard → Database → Extensions → pg_cron)

create extension if not exists pg_cron with schema extensions;

-- Grant usage so the cron job can run under the postgres role
grant usage on schema cron to postgres;

-- Schedule: every minute, delete tasks that have been done for 10+ minutes
select cron.schedule(
  'delete-completed-tasks',          -- job name (unique)
  '* * * * *',                       -- every minute
  $$
    delete from public.tasks
    where status = 'done'
      and completed_at is not null
      and completed_at < now() - interval '10 minutes';
  $$
);
