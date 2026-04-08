-- 014_chat_features.sql
-- Adds pin / edit / soft-delete support to chat messages
-- and a channel_members table so admins can manage access per channel.

-- ── chat_messages ──────────────────────────────────────────────────────────────

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_pinned   boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_edited   boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at   timestamptz,
  ADD COLUMN IF NOT EXISTS is_deleted  boolean      NOT NULL DEFAULT false;

-- ── channel_members ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.channel_members (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id  uuid         NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  employee_id uuid         NOT NULL REFERENCES public.employees(id)     ON DELETE CASCADE,
  added_by    uuid         REFERENCES public.employees(id),
  added_at    timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (channel_id, employee_id)
);
