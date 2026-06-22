-- Add the notification enum value in its own migration so later migrations can
-- use it safely on PostgreSQL 14.

ALTER TYPE public.notification_type
  ADD VALUE IF NOT EXISTS 'jackpot_draw_ready';
