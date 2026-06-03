-- SD3 narcissism subscale (replaces active use of NARQ-S rivalry columns; legacy NARQ columns preserved)
alter table public.users add column if not exists psychometrics_sd3_narcissism_responses jsonb default null;
alter table public.users add column if not exists psychometrics_sd3_narcissism_score numeric default null;

comment on column public.users.psychometrics_sd3_narcissism_responses is
  'SD3 narcissism subscale item responses (1–5). Legacy NARQ-S data remains in psychometrics_narq_s_* columns.';
comment on column public.users.psychometrics_sd3_narcissism_score is
  'SD3 narcissism subscale mean score (1–5, reverse-scored items 2, 6, 8).';
