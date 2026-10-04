/**
 * Soft uncertainty contribution for the pre-interview sexual communication comfort mean.
 *
 * TODO: This is a soft, low-confidence modifier on an unvalidated Amoraea-original
 * instrument. Revisit the magnitude, and whether it should remain soft-only, once
 * real outcome data exists. It must not become a gate floor or a weighted-score penalty.
 */

/** Mean (1–5) at or below this adds the soft uncertainty contribution. */
export const SEXUAL_COMMUNICATION_SOFT_MODIFIER_MEAN_THRESHOLD = 2.0;

/**
 * Same order of magnitude as the smallest existing depth-signal concern
 * (overdisclosure adds 0.05 in computeUncertaintyScore).
 */
export const SEXUAL_COMMUNICATION_SOFT_MODIFIER_MAGNITUDE = 0.05;

export const SEXUAL_COMMUNICATION_SOFT_MODIFIER_FLAG = 'sexual_communication_soft_modifier';

export function sexualCommunicationSoftModifier(mean: number | null | undefined): number {
  if (mean == null || !Number.isFinite(mean)) return 0;
  if (mean <= SEXUAL_COMMUNICATION_SOFT_MODIFIER_MEAN_THRESHOLD) {
    return SEXUAL_COMMUNICATION_SOFT_MODIFIER_MAGNITUDE;
  }
  return 0;
}

function finiteOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Historical post-interview typology (`psychometrics_sexual_communication_score` /
 * `psychometrics_sexual_communication_completed_at`). A new pre-interview battery leaves
 * both null on purpose. That null is not an incomplete comfort assessment.
 */
export function hasHistoricalSexualCommunicationTypology(row: {
  psychometrics_sexual_communication_score?: number | null;
  psychometrics_sexual_communication_completed_at?: string | null;
}): boolean {
  return (
    row.psychometrics_sexual_communication_completed_at != null ||
    (typeof row.psychometrics_sexual_communication_score === 'number' &&
      Number.isFinite(row.psychometrics_sexual_communication_score))
  );
}

/**
 * Reads only the pre-interview comfort columns.
 * `psychometrics_sexual_communication_score` is the historical typology mean and is ignored.
 */
export function sexualCommunicationComfortUncertaintyFields(user: {
  psychometrics_sexual_communication_comfort_score?: unknown;
  psychometrics_sexual_communication_comfort_soft_modifier?: unknown;
  psychometrics_sexual_communication_score?: unknown;
}): {
  psychometrics_sexual_communication_comfort_score: number | null;
  psychometrics_sexual_communication_comfort_soft_modifier: number | null;
} {
  void user.psychometrics_sexual_communication_score;
  return {
    psychometrics_sexual_communication_comfort_score: finiteOrNull(
      user.psychometrics_sexual_communication_comfort_score,
    ),
    psychometrics_sexual_communication_comfort_soft_modifier: finiteOrNull(
      user.psychometrics_sexual_communication_comfort_soft_modifier,
    ),
  };
}

/** Amount folded into depthSignalConcerns. Prefers the persisted modifier when present. */
export function sexualCommunicationUncertaintyContribution(input: {
  psychometrics_sexual_communication_comfort_score?: number | null;
  psychometrics_sexual_communication_comfort_soft_modifier?: number | null;
}): number {
  const stored = input.psychometrics_sexual_communication_comfort_soft_modifier;
  if (typeof stored === 'number' && Number.isFinite(stored)) {
    return Math.min(Math.max(stored, 0), SEXUAL_COMMUNICATION_SOFT_MODIFIER_MAGNITUDE);
  }
  return sexualCommunicationSoftModifier(input.psychometrics_sexual_communication_comfort_score);
}
