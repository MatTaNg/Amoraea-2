/** Explicit `interview_attempts` column lists for admin dashboard and tooling. */

/** Core full row — safe when gaming-correction or override migrations are not applied yet. */
export const INTERVIEW_ATTEMPTS_FULL_SELECT_CORE = `
      id,
      user_id,
      attempt_number,
      created_at,
      completed_at,
      weighted_score,
      passed,
      pillar_scores,
      scenario_1_scores,
      scenario_2_scores,
      scenario_3_scores,
      score_consistency,
      construct_asymmetry,
      response_timings,
      probe_log,
      dropout_point,
      language_markers,
      scenario_specific_patterns,
      ai_reasoning,
      user_analysis_rating,
      user_analysis_comment,
      per_construct_ratings,
      transcript,
      communication_style_error,
      communication_floor_flag,
      communication_floor_avg_unprompted_words,
      communication_floor_dismissed_at,
      communication_floor_dismissed_by,
      communication_floor_dismiss_note,
      reasoning_pending,
      scenario_composites,
      scenario_floor_grandfather_review,
      gate_fail_reasons,
      gate_fail_detail,
      mentalizing_repair_floor_grandfather_review,
      ego_development_level,
      review_flags,
      score_modifier,
      depth_signal_modifier,
      modified_weighted_score,
      psychometric_modifier_applied,
      modified_weighted_score_with_psychometrics,
      final_gate_pass,
      mentalizing_overcertainty_count,
      defense_patterns,
      moment_4_concreteness,
      moment_5_concreteness,
      personal_moment_emotional_vocab_low,
      personal_moment_emotional_vocab_density,
      disclosure_calibration,
      emotion_recognition_raw_score,
      emotion_recognition_score,
      emotion_recognition_responses,
      skip_penalty_total,
      auto_failed,
      uncertainty_score,
      uncertainty_breakdown,
      requires_clarification_battery,
      post_clarification_uncertainty_score,
      uncertainty_pending_admin_review
    ` as const;

/** Requires migration 20260628170000_interview_attempts_gaming_correction.sql */
export const INTERVIEW_ATTEMPTS_GAMING_CORRECTION_COLUMNS = `
      corrected_psychometric_modifier,
      gaming_correction` as const;

/** Requires migration 20260628120000_interview_attempts_defense_cross_reference.sql */
export const INTERVIEW_ATTEMPTS_DEFENSE_CROSS_REFERENCE_COLUMN = `
      defense_cross_reference` as const;

/** @deprecated Alias for core select — use {@link INTERVIEW_ATTEMPTS_FULL_SELECT_CORE} or {@link interviewAttemptsFullSelect}. */
export const INTERVIEW_ATTEMPTS_FULL_SELECT_BASE = INTERVIEW_ATTEMPTS_FULL_SELECT_CORE;

/** @deprecated Prefer {@link interviewAttemptsFullSelect}({ includeGamingCorrection: true }). */
export const INTERVIEW_ATTEMPTS_FULL_SELECT_WITH_GAMING =
  `${INTERVIEW_ATTEMPTS_FULL_SELECT_CORE},${INTERVIEW_ATTEMPTS_GAMING_CORRECTION_COLUMNS}` as const;

/** @deprecated Prefer {@link interviewAttemptsFullSelect}. */
export const INTERVIEW_ATTEMPTS_FULL_SELECT = INTERVIEW_ATTEMPTS_FULL_SELECT_CORE;

export type InterviewAttemptsFullSelectOptions = {
  includeGamingCorrection?: boolean;
  includeDefenseCrossReference?: boolean;
  includeOverride?: boolean;
};

/** Build a full attempt select for the current DB schema (falls back when migrations are missing). */
export function interviewAttemptsFullSelect(
  opts: InterviewAttemptsFullSelectOptions = {},
): string {
  const includeGaming = opts.includeGamingCorrection === true;
  const includeDefenseCrossReference = opts.includeDefenseCrossReference === true;
  const includeOverride = opts.includeOverride === true;
  let select = INTERVIEW_ATTEMPTS_FULL_SELECT_CORE.trim();
  if (includeGaming) {
    select = `${select},${INTERVIEW_ATTEMPTS_GAMING_CORRECTION_COLUMNS}`;
  }
  if (includeDefenseCrossReference) {
    select = `${select},${INTERVIEW_ATTEMPTS_DEFENSE_CROSS_REFERENCE_COLUMN}`;
  }
  if (includeOverride) {
    select = `${select},
      override_status,
      override_set_at`;
  }
  return select;
}

export const INTERVIEW_ATTEMPTS_SUMMARY_SELECT_BASE = `
      id,
      user_id,
      attempt_number,
      created_at,
      completed_at,
      weighted_score,
      passed,
      reasoning_pending,
      pillar_scores,
      scenario_composites,
      scenario_floor_grandfather_review,
      gate_fail_reasons,
      gate_fail_detail,
      mentalizing_repair_floor_grandfather_review,
      review_flags,
      score_modifier,
      modified_weighted_score,
      ego_development_level,
      defense_patterns,
      moment_4_concreteness,
      moment_5_concreteness,
      personal_moment_emotional_vocab_low,
      disclosure_calibration,
      mentalizing_overcertainty_count,
      emotion_recognition_raw_score,
      emotion_recognition_score,
      emotion_recognition_responses,
      uncertainty_score,
      requires_clarification_battery,
      post_clarification_uncertainty_score,
      uncertainty_pending_admin_review
    ` as const;

export const INTERVIEW_ATTEMPTS_SUMMARY_SELECT = `${INTERVIEW_ATTEMPTS_SUMMARY_SELECT_BASE},
      override_status,
      override_set_at` as const;
