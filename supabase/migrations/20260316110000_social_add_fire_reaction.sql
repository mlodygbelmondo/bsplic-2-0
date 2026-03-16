-- Migration: add fire reaction emoji for social reactions

ALTER TYPE public.reaction_emoji
  ADD VALUE IF NOT EXISTS 'fire';
