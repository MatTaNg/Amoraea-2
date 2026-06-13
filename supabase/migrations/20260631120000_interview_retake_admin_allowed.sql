-- Admin-initiated interview retake + routing view refresh.

alter table public.users
  add column if not exists interview_retake_admin_allowed_at timestamptz;

comment on column public.users.interview_retake_admin_allowed_at is
  'When set, user may start a new interview run (admin allow-retake). Cleared when retake begins.';

-- CREATE OR REPLACE cannot insert a column in the middle of an existing view (PG treats it as a rename).
drop view if exists public.user_interview_routing;

create view public.user_interview_routing
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
  interview_retake_admin_allowed_at,
  market_research_completed_at,
  launch_notification_phone,
  launch_notification_submitted_at,
  created_at,
  updated_at
from public.users;

grant select on public.user_interview_routing to authenticated;
grant select on public.user_interview_routing to service_role;
