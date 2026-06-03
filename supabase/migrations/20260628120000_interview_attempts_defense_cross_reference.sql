-- Defense pattern cross-reference validation (psychometric vs NLP detection)
alter table public.interview_attempts
  add column if not exists defense_cross_reference jsonb default null;

comment on column public.interview_attempts.defense_cross_reference is
  'Cross-reference of NLP defense pattern detections against self-report psychometric profile.';
