-- PAQ, GASP externalization, Dweck relationship beliefs, Neff SCS-SF (post-login psychometric battery).

alter table public.users add column if not exists psychometrics_scs_sf_responses jsonb default null;
alter table public.users add column if not exists psychometrics_scs_sf_score numeric default null;
alter table public.users add column if not exists psychometrics_scs_sf_self_kindness_score numeric default null;
alter table public.users add column if not exists psychometrics_scs_sf_common_humanity_score numeric default null;
alter table public.users add column if not exists psychometrics_scs_sf_mindfulness_score numeric default null;

alter table public.users add column if not exists psychometrics_paq_responses jsonb default null;
alter table public.users add column if not exists psychometrics_paq_score numeric default null;
alter table public.users add column if not exists psychometrics_paq_negative_score numeric default null;
alter table public.users add column if not exists psychometrics_paq_positive_score numeric default null;

alter table public.users add column if not exists psychometrics_gasp_responses jsonb default null;
alter table public.users add column if not exists psychometrics_gasp_score numeric default null;

alter table public.users add column if not exists psychometrics_dweck_responses jsonb default null;
alter table public.users add column if not exists psychometrics_dweck_score numeric default null;
