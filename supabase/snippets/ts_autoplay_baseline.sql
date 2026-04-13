-- Baseline queries for TTS autoplay telemetry (§3).
-- Events are written to `debug_logs` via remoteLog from the app.
-- Message prefixes: '[TTS_AUTOPLAY]', '[TTS_AUTOPLAY_MIC_STOP]'.
--
-- Run in Supabase SQL editor (service role or RLS that allows read on debug_logs).

-- 1) Direct play outcomes by browser (web), last 7 days
select
  (data->>'browserFamily') as browser_family,
  (data->>'isMobileWeb')::boolean as is_mobile_web,
  (data->>'outcome') as outcome,
  (data->>'pipeline') as pipeline,
  (data->>'telemetrySource') as telemetry_source,
  count(*) as n
from debug_logs
where message = '[TTS_AUTOPLAY]'
  and created_at > now() - interval '7 days'
group by 1, 2, 3, 4, 5
order by n desc;

-- 2) Share of successful direct ElevenLabs web plays (not gesture flush)
with web_direct as (
  select *
  from debug_logs
  where message = '[TTS_AUTOPLAY]'
    and (data->>'pipeline') = 'elevenlabs_web_html_audio'
    and created_at > now() - interval '7 days'
)
select
  (data->>'outcome') as outcome,
  count(*) as n,
  round(100.0 * count(*) / sum(count(*)) over (), 2) as pct
from web_direct
group by 1
order by n desc;

-- 3) Turn-only: autoplay success rate (direct MP3 play_ok vs blocked)
select
  count(*) filter (where (data->>'outcome') = 'play_ok') as play_ok,
  count(*) filter (where (data->>'outcome') = 'play_blocked_autoplay') as blocked,
  count(*) as total_turn_samples
from debug_logs
where message = '[TTS_AUTOPLAY]'
  and (data->>'telemetrySource') = 'turn'
  and (data->>'pipeline') = 'elevenlabs_web_html_audio'
  and created_at > now() - interval '7 days';

-- 4) Mic stop volume (correlate with following TTS in your analytics tool by user_id + time window)
select
  date_trunc('day', created_at) as day,
  (data->>'browserFamily') as browser_family,
  count(*) as mic_stops
from debug_logs
where message = '[TTS_AUTOPLAY_MIC_STOP]'
  and created_at > now() - interval '30 days'
group by 1, 2
order by day desc, mic_stops desc;
