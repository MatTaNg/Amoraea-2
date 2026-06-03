-- Post-interview sexual communication comfort scale (not part of pre-interview ASSESSMENT_ORDER).

alter table public.users add column if not exists psychometrics_sexual_communication_responses jsonb default null;
alter table public.users add column if not exists psychometrics_sexual_communication_score numeric default null;
alter table public.users add column if not exists psychometrics_sexual_communication_completed_at timestamptz default null;
alter table public.users add column if not exists psychometrics_sexual_communication_skipped_at timestamptz default null;
alter table public.users add column if not exists psychometrics_sexual_communication_current_question_index integer default null;
alter table public.users add column if not exists psychometrics_sexual_communication_partial_responses jsonb default null;
