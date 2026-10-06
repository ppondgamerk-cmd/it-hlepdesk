-- Run after setup.sql, using the Supabase SQL Editor.
BEGIN;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS "reporterUsername" TEXT REFERENCES public.users(username);
UPDATE public.users SET role = 'admin' WHERE username = 'admin' AND role = 'staff';
UPDATE public.tickets t SET "reporterUsername" = u.username
FROM public.users u
WHERE t."reporterUsername" IS NULL AND t.reporter = u.name
AND (SELECT count(*) FROM public.users other WHERE other.name = u.name) = 1;
CREATE TABLE IF NOT EXISTS public.sessions (
    "tokenHash" TEXT PRIMARY KEY,
    username TEXT NOT NULL REFERENCES public.users(username) ON DELETE CASCADE,
    "credentialHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_username_idx ON public.sessions(username);
CREATE INDEX IF NOT EXISTS tickets_owner_idx ON public.tickets("reporterUsername");
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users, public.tickets, public.sessions FROM anon, authenticated;
COMMIT;
-- The backend uses SUPABASE_SECRET_KEY (or a service-role SUPABASE_KEY).
-- Legacy passwords are converted to salted scrypt hashes on successful login.
