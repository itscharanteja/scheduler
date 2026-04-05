-- 008_tasks_created_by.sql
-- Adds created_by column to tasks so we can filter tasks by creator vs assignee

alter table public.tasks
  add column if not exists created_by uuid references public.employees(id) on delete set null;

create index if not exists idx_tasks_created_by on public.tasks(created_by);
