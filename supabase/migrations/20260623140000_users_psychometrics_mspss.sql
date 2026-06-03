-- MSPSS (family + friends subscales) — final pre-interview psychometric instrument

alter table public.users add column if not exists psychometrics_mspss_responses jsonb default null;
alter table public.users add column if not exists psychometrics_mspss_score numeric default null;
alter table public.users add column if not exists psychometrics_mspss_family_score numeric default null;
alter table public.users add column if not exists psychometrics_mspss_friends_score numeric default null;
