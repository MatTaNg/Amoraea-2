/**
 * Granular experimental slices under conservative final pillars.
 * Persisted for analysis; not independently gated.
 */

export const RESPONSIVENESS_SUPPORT_SLICE_IDS = [
  'need_recognition',
  'attunement',
  'support_response',
  'adaptability',
] as const;

export const COMMITMENT_PERSISTENCE_SLICE_IDS = [
  'commitment_orientation',
  'persistence_exit_judgment',
] as const;

export const DESTRUCTIVE_CONFLICT_SLICE_IDS = [
  'contempt_recognition',
  'contempt_expression',
] as const;

export const EXPERIMENTAL_INTERVIEW_SLICE_IDS = [
  ...RESPONSIVENESS_SUPPORT_SLICE_IDS,
  ...COMMITMENT_PERSISTENCE_SLICE_IDS,
  ...DESTRUCTIVE_CONFLICT_SLICE_IDS,
] as const;

export type ExperimentalInterviewSliceId = (typeof EXPERIMENTAL_INTERVIEW_SLICE_IDS)[number];

export const EXPERIMENTAL_SLICE_PAIR_CORRELATIONS = [
  {
    id: 'commitment_orientation_vs_persistence_exit_judgment',
    a: 'commitment_orientation',
    b: 'persistence_exit_judgment',
  },
  {
    id: 'need_recognition_vs_support_response',
    a: 'need_recognition',
    b: 'support_response',
  },
  {
    id: 'attunement_vs_adaptability',
    a: 'attunement',
    b: 'adaptability',
  },
] as const;

/** Review flag only — not a psychometric merge rule. */
export const EXPERIMENTAL_SLICE_CORRELATION_REVIEW_ABS_R = 0.7;

export const MENTALIZING_EARLY_REVIEW_TODO =
  'Evaluate mentalizing for early review: inter-rater/scoring consistency, relationship with other interview slices, incremental prediction of downstream outcomes, and whether reducing/removing/redefining the pillar improves model performance. Do not change the 7% weight automatically.';
