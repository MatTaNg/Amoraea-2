/**
 * Outcome instrumentation for matching — collection only.
 * Do not auto-train or reweight compatibility from these events yet.
 */

export const MATCH_OUTCOME_STAGES = [
  'match_shown',
  'mutual_interest',
  'conversation_started',
  'date_scheduled',
  'first_date_occurred',
  'wanted_second_date',
  'second_date_occurred',
  'continued_dating',
  'relationship_started',
  'exclusivity',
  'followup_3_month',
  'followup_6_month',
  'followup_12_month',
  'relationship_ended',
] as const;

export type MatchOutcomeStage = (typeof MATCH_OUTCOME_STAGES)[number];

export const POST_DATE_FEEDBACK_FIELDS = [
  'attraction',
  'chemistry',
  'conversation_ease',
  'felt_understood',
  'comfort_safety',
  'curiosity_to_know_more',
  'romantic_interest',
  'desire_for_another_date',
] as const;

export type PostDateFeedbackField = (typeof POST_DATE_FEEDBACK_FIELDS)[number];

export const MATCH_OUTCOME_INSTRUMENTATION_VERSION = 'outcome_v1_2026_08';

export const MATCH_OUTCOME_NO_AUTOTRAIN_TODO =
  'Collect match funnel and post-date feedback for later evaluation. Do not automatically train or reweight compatibility coefficients from these outcomes yet.';
