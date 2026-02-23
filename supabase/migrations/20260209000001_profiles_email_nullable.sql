-- If your profiles table has an email column with NOT NULL, make it nullable
-- so profile upserts work when the session doesn't have email (e.g. anonymous auth).
-- Run in Supabase SQL Editor if you get "null value in column \"email\" violates not-null constraint".

ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;
