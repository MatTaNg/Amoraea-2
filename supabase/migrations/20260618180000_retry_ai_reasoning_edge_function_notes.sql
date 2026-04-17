-- Background retry for AI narrative (reasoning_pending): deploy Edge Function
-- `retry-pending-ai-reasoning` and schedule it.
--
-- Example (requires pg_cron + pg_net or equivalent HTTP extension; adjust URL and secret):
--   SELECT cron.schedule(
--     'retry-pending-ai-reasoning',
--     '*/15 * * * *',
--     $$
--     SELECT net.http_post(
--       url := 'https://<project-ref>.supabase.co/functions/v1/retry-pending-ai-reasoning',
--       headers := jsonb_build_object(
--         'Content-Type', 'application/json',
--         'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
--       ),
--       body := '{}'::jsonb
--     );
--     $$
--   );
--
-- Secrets for the function (Dashboard → Edge Functions → retry-pending-ai-reasoning → Secrets):
--   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
--   ANTHROPIC_API_KEY (direct API) OR ANTHROPIC_PROXY_URL + SUPABASE_ANON_KEY (via anthropic-proxy).

COMMENT ON COLUMN public.interview_attempts.reasoning_pending IS
  'True when pillar/transcript were saved but ai_reasoning narrative still needs generation. Cleared by client retry, admin retry, or retry-pending-ai-reasoning Edge Function.';
