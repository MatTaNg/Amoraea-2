-- Multi-code gate failures + separate grandfather flag for mentalizing/repair scenario floors.

alter table public.interview_attempts
  add column if not exists gate_fail_reasons jsonb not null default '[]'::jsonb;

alter table public.interview_attempts
  add column if not exists gate_fail_detail jsonb;

alter table public.interview_attempts
  add column if not exists mentalizing_repair_floor_grandfather_review boolean not null default false;

comment on column public.interview_attempts.gate_fail_reasons is
  'JSON array of failure codes: weighted_score, scenario_floor, mentalizing_floor, repair_floor.';

comment on column public.interview_attempts.gate_fail_detail is
  'Structured breakdown aligned with gate_fail_reasons (scenarios, scores, composites).';

comment on column public.interview_attempts.mentalizing_repair_floor_grandfather_review is
  'Passed before mentalizing/repair dual-scenario floor; flagged for review (independent of scenario_floor_grandfather_review).';
