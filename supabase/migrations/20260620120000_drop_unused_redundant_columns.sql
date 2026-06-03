-- Drop columns with no active reads/writes or superseded by other storage.
-- See: users.interview_scenario_* (scores live on interview_attempts),
-- psychometrics_progress (superseded by users.psychometrics_* columns),
-- launch_notification_email (replaced by launch_notification_phone + auth email).

-- users: legacy gate + duplicate scenario checkpoint cache
alter table public.users
  drop column if exists gate1_score,
  drop column if exists interview_scenario_1_scores,
  drop column if exists interview_scenario_2_scores,
  drop column if exists interview_scenario_3_scores,
  drop column if exists launch_notification_email,
  drop column if exists psychometrics_progress,
  drop column if exists profile_visible;

-- interview_attempts: never used in app (users.interview_reviewed_at is used instead)
alter table public.interview_attempts
  drop column if exists reviewed_at,
  drop column if exists reviewed_by,
  drop column if exists switch_log;

-- profiles: Supabase template cruft; canonical data is profile_json
alter table public.profiles
  drop column if exists website,
  drop column if exists username;

update public.profiles
set profile_json = coalesce(profile_json, '{}'::jsonb) - 'website' - 'username'
where profile_json ?| array['website', 'username'];
