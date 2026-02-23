-- If your profiles table has display_name with NOT NULL, you can make it nullable
-- so profile upserts don't require it. The app now sends display_name on every upsert anyway.
-- Run in Supabase SQL Editor if you prefer nullable display_name.

ALTER TABLE profiles ALTER COLUMN display_name DROP NOT NULL;
