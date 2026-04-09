-- Persist gate outcome detail (floor breach vs weighted fail) for analytics.
alter table public.interview_attempts
  add column if not exists gate_fail_reason text;

comment on column public.interview_attempts.gate_fail_reason is
  'Null on pass. On fail: e.g. floor_breach: accountability (4.0), repair (3.8) or weighted_below_threshold: 5.7 (required 6.0).';
