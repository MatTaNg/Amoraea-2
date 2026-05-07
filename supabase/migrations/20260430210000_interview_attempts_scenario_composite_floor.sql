-- Per-scenario composite snapshot at gate time + manual review flag for passes that predate the scenario floor rule.

alter table public.interview_attempts
  add column if not exists scenario_composites jsonb;

alter table public.interview_attempts
  add column if not exists scenario_floor_grandfather_review boolean not null default false;

comment on column public.interview_attempts.scenario_composites is
  'Gate snapshot: mean pillar score per scenario {"1","2","3"} from scenario_*_scores slices (Moment 4/5 excluded).';

comment on column public.interview_attempts.scenario_floor_grandfather_review is
  'True when attempt passed before scenario composite floor; would fail today — flagged for manual review (passed unchanged).';
