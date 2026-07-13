import type { DefensePatternsJson } from '@features/aria/aggregateMarkerScoresFromSlices';
import type { GamingCorrectionResult } from '@features/psychometrics/computeGamingCorrection';
import type { DefenseCrossReferenceResult } from '@features/psychometrics/crossReferenceDefenseDetection';
import type { UncertaintyBreakdown } from '@features/psychometrics/computeUncertaintyScore';

export type UserRow = {
  id: string;
  email: string | null;
  full_name?: string | null;
  name?: string | null;
  display_name?: string | null;
  /** Onboarding JSON; may include `firstName` when `users.name` is missing or corrupt. */
  basic_info?: unknown;
  created_at?: string;
  /** When set, user completed at least one attempt row in DB (even if admin cannot read attempts yet). */
  latest_attempt_id?: string | null;
  interview_completed?: boolean | null;
  /** Effective pass/fail for routing (gate result unless admin override is set). */
  interview_passed?: boolean | null;
  interview_passed_computed?: boolean | null;
  interview_passed_admin_override?: boolean | null;
  interview_cohort_admin_reviewed?: boolean | null;
  /** Admin-only human judgment; null = follow current gate outcome in UI. Does not change routing. */
  admin_human_verified_pass?: boolean | null;
  interview_completed_at?: string | null;
  interview_retake_admin_allowed_at?: string | null;
  interview_attempt_count?: number | null;
  /** Optional SMS number from post-interview flow (`users.launch_notification_phone`). */
  launch_notification_phone?: string | null;
  psychometrics_sd3_narcissism_score?: number | null;
  psychometric_straight_line_flags?: unknown;
  psychometrics_rfq_score?: number | null;
  psychometrics_gasp_score?: number | null;
  psychometrics_dweck_score?: number | null;
  psychometrics_scs_sf_score?: number | null;
  validation_track?: string | null;
  validation_standard_app_enrolled?: boolean | null;
};

export type AttemptRow = {
  id: string;
  user_id: string;
  attempt_number: number;
  created_at: string;
  completed_at: string | null;
  weighted_score: number | null;
  passed: boolean | null;
  pillar_scores: Record<string, number> | null;
  scenario_1_scores: Record<string, unknown> | null;
  scenario_2_scores: Record<string, unknown> | null;
  scenario_3_scores: Record<string, unknown> | null;
  score_consistency: Record<string, { std_dev?: number }> | null;
  construct_asymmetry: Record<string, unknown> | null;
  response_timings: Array<{ latency_ms?: number; duration_ms?: number; word_count?: number }> | null;
  dropout_point: Record<string, unknown> | null;
  language_markers: Record<string, unknown> | null;
  ai_reasoning: Record<string, unknown> | null;
  user_analysis_rating: number | null;
  user_analysis_comment: string | null;
  per_construct_ratings: Record<string, unknown> | null;
  transcript: Array<{ role: string; content?: string }> | null;
  scenario_specific_patterns?: Record<string, unknown> | null;
  probe_log?: unknown;
  communication_style_error?: string | null;
  communication_floor_flag?: boolean | null;
  communication_floor_avg_unprompted_words?: number | null;
  communication_floor_dismissed_at?: string | null;
  communication_floor_dismissed_by?: string | null;
  communication_floor_dismiss_note?: string | null;
  reasoning_pending?: boolean | null;
  override_status?: boolean | null;
  override_set_at?: string | null;
  scenario_composites?: Record<string, unknown> | null;
  scenario_floor_grandfather_review?: boolean | null;
  gate_fail_reasons?: unknown;
  gate_fail_detail?: unknown;
  mentalizing_repair_floor_grandfather_review?: boolean | null;
  /** Snapshot before admin score recalculation. */
  original_scores?: Record<string, unknown> | null;
  recalculated_at?: string | null;
  recalculation_delta?: Record<string, number> | null;
  recalculation_notes?: string[] | null;
  incomplete_reason?: string | null;
  ego_development_level?: number | null;
  review_flags?: unknown;
  score_modifier?: number | null;
  depth_signal_modifier?: number | null;
  modified_weighted_score?: number | null;
  psychometric_modifier_applied?: number | null;
  corrected_psychometric_modifier?: number | null;
  gaming_correction?: GamingCorrectionResult | null;
  modified_weighted_score_with_psychometrics?: number | null;
  final_gate_pass?: boolean | null;
  mentalizing_overcertainty_count?: number | null;
  defense_patterns?: DefensePatternsJson | null;
  moment_4_concreteness?: string | null;
  moment_5_concreteness?: string | null;
  personal_moment_emotional_vocab_low?: boolean | null;
  personal_moment_emotional_vocab_density?: number | null;
  disclosure_calibration?: string | null;
  emotion_recognition_raw_score?: number | null;
  emotion_recognition_score?: number | null;
  emotion_recognition_responses?: string[] | null;
  /** Not yet persisted on all rows — optional for forward compatibility. */
  closing_integration?: string | null;
  skip_penalty_total?: number | null;
  auto_failed?: boolean | null;
  uncertainty_score?: number | null;
  uncertainty_breakdown?: UncertaintyBreakdown | null;
  defense_cross_reference?: DefenseCrossReferenceResult | null;
  requires_clarification_battery?: boolean | null;
  post_clarification_uncertainty_score?: number | null;
  uncertainty_pending_admin_review?: boolean | null;
};

/** List/overview only — loaded once for all users (small payload). Full rows load per user on drill-down. */
export type AttemptSummary = Pick<
  AttemptRow,
  | 'id'
  | 'user_id'
  | 'attempt_number'
  | 'created_at'
  | 'completed_at'
  | 'weighted_score'
  | 'passed'
  | 'reasoning_pending'
  | 'pillar_scores'
  | 'override_status'
  | 'override_set_at'
  | 'scenario_composites'
  | 'scenario_floor_grandfather_review'
  | 'gate_fail_reasons'
  | 'gate_fail_detail'
  | 'mentalizing_repair_floor_grandfather_review'
  | 'review_flags'
  | 'score_modifier'
  | 'depth_signal_modifier'
  | 'modified_weighted_score'
  | 'psychometric_modifier_applied'
  | 'modified_weighted_score_with_psychometrics'
  | 'final_gate_pass'
  | 'ego_development_level'
  | 'defense_patterns'
  | 'moment_4_concreteness'
  | 'moment_5_concreteness'
  | 'personal_moment_emotional_vocab_low'
  | 'disclosure_calibration'
  | 'mentalizing_overcertainty_count'
  | 'emotion_recognition_raw_score'
  | 'emotion_recognition_score'
  | 'emotion_recognition_responses'
  | 'uncertainty_score'
  | 'requires_clarification_battery'
  | 'post_clarification_uncertainty_score'
  | 'uncertainty_pending_admin_review'
>;

export type CommunicationStyleProfileRow = {
  user_id: string;
  emotional_analytical_score: number | null;
  narrative_conceptual_score: number | null;
  certainty_ambiguity_score: number | null;
  relational_individual_score: number | null;
  emotional_vocab_density: number | null;
  qualifier_density: number | null;
  first_person_ratio: number | null;
  avg_response_length: number | null;
  pitch_mean: number | null;
  pitch_range: number | null;
  speech_rate: number | null;
  pause_frequency: number | null;
  energy_variation: number | null;
  emotional_expressiveness: number | null;
  warmth_score: number | null;
  text_confidence: number | null;
  audio_confidence: number | null;
  overall_confidence: number | null;
  updated_at: string | null;
  style_labels_primary?: string[] | null;
  style_labels_secondary?: string[] | null;
  matchmaker_summary?: string | null;
  low_confidence_note?: string | null;
  source_attempt_id?: string | null;
};

export type UserGroup = {
  user: UserRow;
  attempts: AttemptSummary[];
  latestAttempt: AttemptSummary | null;
};

export type FetchAdminUsersListResult = { groups: UserGroup[]; errorMessage: string | null };

export type TimeRangeFilter = 'all' | 'day' | 'three_days' | 'week' | 'month' | 'custom';
export type BookmarkCohortFilter = 'all' | 'bookmarked' | 'not_bookmarked';
export type HumanVerifiedCohortFilter = 'all' | 'pass' | 'fail' | 'unset';

/** Cohort list filter — derived from live interview state + latest attempt gate display. */
export type AdminUserStatusFilter =
  | 'all'
  | 'incomplete'
  | 'in_progress'
  | 'pass'
  | 'fail'
  | 'almost'
  | 'no_result'
  | 'flagged'
  | 'er_floor_review'
  | 'sd3_narcissism_floor_review'
  | 'psychometric_floor_review';

export type LiveTranscriptMsg = { role: string; content?: string; scenarioNumber?: number };

export type UserListSort = 'date' | 'uncertainty';

export type UncertaintyBandFilter = 'all' | 'low' | 'medium' | 'high';

export type AdminAttemptInnerTabId =
  | 'profile_intent'
  | 'dating_profile'
  | 'summary'
  | 'reasoning'
  | 'transcript'
  | 'depth'
  | 'full_assessment';
