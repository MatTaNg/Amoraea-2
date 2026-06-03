-- Post-login market research questionnaire (shown before psychometrics / interview).
alter table users add column if not exists market_research_completed_at timestamptz default null;
alter table users add column if not exists market_research_referral_source text default null;
alter table users add column if not exists market_research_referral_other text default null;
alter table users add column if not exists market_research_relationship_seriousness text default null;
alter table users add column if not exists market_research_search_duration text default null;
alter table users add column if not exists market_research_dating_status text default null;
alter table users add column if not exists market_research_max_spend text default null;
alter table users add column if not exists market_research_spend_context text default null;
