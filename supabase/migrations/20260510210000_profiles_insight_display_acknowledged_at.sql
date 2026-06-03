-- Client stores when the member dismissed the post-interview self-insight block (not scoring feedback).
alter table public.profiles
  add column if not exists insight_display_acknowledged_at timestamptz;

comment on column public.profiles.insight_display_acknowledged_at is
  'When the user acknowledged the post-interview personal reflections (self-insight) UI.';

alter table public.interview_attempts
  add column if not exists disclosure_calibration text;

comment on column public.interview_attempts.disclosure_calibration is
  'Optional holistic label: underdisclosure | overdisclosure | calibrated — for self-insight copy when present.';
