-- Add moderator role before policies/functions reference the enum value.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';
