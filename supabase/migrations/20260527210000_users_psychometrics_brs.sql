-- Brief Resilience Scale (BRS) — first psychometric instrument in the sequence.
alter table public.users add column if not exists psychometrics_brs_responses jsonb default null;
alter table public.users add column if not exists psychometrics_brs_score numeric default null;
