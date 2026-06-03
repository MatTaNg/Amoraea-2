-- Pre-production: slim users row — interview scores live on interview_attempts only.
-- Safe while no legacy gate2/gate3 or users-level score cache is relied upon in production.

alter table public.users
  drop column if exists gate2_psychometrics,
  drop column if exists gate3_compatibility,
  drop column if exists interview_weighted_score,
  drop column if exists interview_pillar_scores,
  drop column if exists interview_reviewed_at;

-- Lightweight routing read: hot path for PostInterview / Aria status checks.
create or replace view public.user_interview_routing
with (security_invoker = true)
as
select
  id,
  email,
  interview_completed,
  interview_passed,
  interview_passed_computed,
  interview_passed_admin_override,
  latest_attempt_id,
  interview_attempt_count,
  is_alpha_tester,
  referral_boost_active,
  referral_notice_pending,
  psychometrics_completed_at,
  interview_completed_at,
  market_research_completed_at,
  launch_notification_phone,
  launch_notification_submitted_at,
  created_at,
  updated_at
from public.users;

comment on view public.user_interview_routing is
  'Narrow projection for client routing; avoids pulling transcript/jsonb on status polls.';

grant select on public.user_interview_routing to authenticated;
grant select on public.user_interview_routing to service_role;
