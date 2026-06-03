-- Gate audit: total modifier applied before threshold, modified weighted score, review queue flags.
-- `review_flags` may already exist from a prior migration; IF NOT EXISTS keeps this idempotent.
alter table public.interview_attempts
  add column if not exists review_flags jsonb default '[]'::jsonb;

alter table public.interview_attempts
  add column if not exists score_modifier double precision,
  add column if not exists modified_weighted_score double precision;

comment on column public.interview_attempts.score_modifier is
  'Sum of ego, defense-pattern, and personal-moment concreteness modifiers applied before pass threshold.';
comment on column public.interview_attempts.modified_weighted_score is
  'Marker weighted score (with skip penalties) plus score_modifier; used for pass/fail vs threshold.';
