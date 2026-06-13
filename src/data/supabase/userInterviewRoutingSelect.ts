/** Supabase view: narrow `users` projection for routing polls (no transcript/jsonb). */
export const USER_INTERVIEW_ROUTING_TABLE = 'user_interview_routing' as const;

export const USER_INTERVIEW_ROUTING_SELECT =
  'id, interview_completed, interview_passed, interview_passed_computed, interview_passed_admin_override, latest_attempt_id, interview_attempt_count, is_alpha_tester, referral_boost_active, referral_notice_pending, psychometrics_completed_at, interview_completed_at, interview_retake_admin_allowed_at' as const;

/** Post-login stack routing (`resolveInitialInterviewRoute`). */
export const USER_LOGIN_ROUTING_SELECT =
  `${USER_INTERVIEW_ROUTING_SELECT}, market_research_completed_at` as const;

/** Post-interview contact + pass resolution (`PostInterviewScreen`). */
export const USER_POST_INTERVIEW_CONTACT_SELECT =
  `${USER_INTERVIEW_ROUTING_SELECT}, launch_notification_phone, launch_notification_submitted_at` as const;

/** Referral notice only. */
export const USER_REFERRAL_NOTICE_SELECT = 'referral_notice_pending' as const;

/** Pass / completion polls. */
export const USER_INTERVIEW_PASS_SELECT = 'interview_passed, interview_completed, latest_attempt_id' as const;

/** Post-interview reveal polling (pass + admin early-reveal signals). */
export const USER_INTERVIEW_REVEAL_POLL_SELECT =
  `${USER_INTERVIEW_PASS_SELECT}, interview_passed_admin_override, interview_passed_computed` as const;

/** Interview / account fields on `users` (demographics are in `profiles.profile_json`). */
export const USERS_PROFILE_SELECT =
  'id, created_at, updated_at, onboarding_completed, onboarding_step, name, display_name, invite_code, is_alpha_tester, profile_prompts, onboarding_stage, application_status, basic_info, interview_completed, interview_passed, referral_boost_active, referral_notice_pending' as const;

/** Dating `profiles` row reads (canonical `profile_json` + optional top-level mirrors). */
export const PROFILES_ROW_SELECT =
  'id, email, profile_json, created_at, updated_at, full_name, avatar_url, display_name, insight_display_acknowledged_at' as const;

/** Interview-only fields still on `users` (not in `profile_json`). */
export const USER_INTERVIEW_APPLICATION_SELECT = 'profile_prompts, basic_info' as const;
