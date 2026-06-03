/**
 * Soft compatibility signal from sexual communication comfort scores (1–5 mean).
 * diff ≤ 0.5 → small boost; diff > 1.5 → small penalty.
 */
export function sexualCommunicationPairAdjustment(
  scoreA: number | null | undefined,
  scoreB: number | null | undefined,
): { adjustment: number; label: 'boost' | 'penalty' | 'neutral' | 'missing' } {
  if (scoreA == null || scoreB == null || !Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
    return { adjustment: 0, label: 'missing' };
  }
  const diff = Math.abs(scoreA - scoreB);
  if (diff <= 0.5) return { adjustment: 0.03, label: 'boost' };
  if (diff > 1.5) return { adjustment: -0.05, label: 'penalty' };
  return { adjustment: 0, label: 'neutral' };
}
