-- Run after auth-migration.sql. Only recovery code hashes are stored.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS "recoveryHash" TEXT;
