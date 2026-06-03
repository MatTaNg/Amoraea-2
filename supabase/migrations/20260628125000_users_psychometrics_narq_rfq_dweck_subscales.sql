-- Combined relationship beliefs subscales + main-battery NARQ-S and RFQ

alter table public.users add column if not exists psychometrics_dweck_growth_score numeric default null;
alter table public.users add column if not exists psychometrics_dweck_rbi_disagreement_score numeric default null;

alter table public.users add column if not exists psychometrics_narq_s_responses jsonb default null;
alter table public.users add column if not exists psychometrics_narq_s_score numeric default null;

alter table public.users add column if not exists psychometrics_rfq_responses jsonb default null;
alter table public.users add column if not exists psychometrics_rfq_score numeric default null;
