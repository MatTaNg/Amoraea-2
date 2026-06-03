-- Emotional Patterns Assessment (trait anxiety) — 4-item pre-interview instrument after BRS.
alter table public.users add column if not exists psychometrics_anxiety_trait_responses jsonb default null;
alter table public.users add column if not exists psychometrics_anxiety_trait_score numeric default null;
