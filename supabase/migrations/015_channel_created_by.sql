-- 015_channel_created_by.sql
-- Track which employee created each channel so edit/delete permissions can be enforced.

ALTER TABLE public.chat_channels
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.employees(id) ON DELETE SET NULL;
