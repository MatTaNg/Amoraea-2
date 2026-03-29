-- Run this in Supabase SQL Editor to enable remote logging for interview completion tracing.
-- You must run this once before any logs will appear. Remove after diagnosis: DROP TABLE debug_logs;

CREATE TABLE IF NOT EXISTS debug_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message text,
  data jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE debug_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running this script
DROP POLICY IF EXISTS "Allow all inserts to debug_logs" ON debug_logs;
DROP POLICY IF EXISTS "Allow admin to read debug_logs" ON debug_logs;
DROP POLICY IF EXISTS "Allow authenticated insert debug_logs" ON debug_logs;
DROP POLICY IF EXISTS "Allow anon insert debug_logs" ON debug_logs;

-- Allow inserts from both authenticated and anon (app uses anon key + auth session)
CREATE POLICY "Allow authenticated insert debug_logs"
ON debug_logs FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow anon insert debug_logs"
ON debug_logs FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow admin to read debug_logs"
ON debug_logs FOR SELECT USING (true);
