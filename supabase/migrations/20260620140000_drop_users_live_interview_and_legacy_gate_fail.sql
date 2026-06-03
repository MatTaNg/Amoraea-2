-- Live interview checkpoint now lives on interview_attempts.transcript / resume_active_scenario.
-- Legacy semicolon-separated gate_fail_reason superseded by gate_fail_reasons + gate_fail_detail.

alter table public.users
  drop column if exists interview_transcript,
  drop column if exists interview_last_checkpoint;

alter table public.interview_attempts
  drop column if exists gate_fail_reason;

-- Recreate routing view (unchanged columns; users table shape changed).
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

grant select on public.user_interview_routing to authenticated;
grant select on public.user_interview_routing to service_role;
