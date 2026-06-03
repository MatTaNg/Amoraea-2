-- AAQ-II, RSES, and SCS psychometric instruments (post-login gate before / after interview).
alter table users add column if not exists psychometrics_aaq2_responses jsonb default null;
alter table users add column if not exists psychometrics_aaq2_score integer default null;
alter table users add column if not exists psychometrics_rses_responses jsonb default null;
alter table users add column if not exists psychometrics_rses_score integer default null;
alter table users add column if not exists psychometrics_scs_public_responses jsonb default null;
alter table users add column if not exists psychometrics_scs_public_score integer default null;
alter table users add column if not exists psychometrics_scs_private_responses jsonb default null;
alter table users add column if not exists psychometrics_scs_private_score integer default null;
alter table users add column if not exists psychometrics_completed_at timestamptz default null;
alter table users add column if not exists psychometrics_current_assessment text default null;
alter table users add column if not exists psychometrics_current_question_index integer default null;
alter table users add column if not exists psychometrics_partial_responses jsonb default null;
