/** Final compatibility score from pillar scores (pure — no I/O). */
export function computeFinalCompatibilityScore(params: {
  attachmentScore: number; // 0..1
  valuesScore: number; // 0..1
  semanticScore: number; // 0..1
  styleScore: number; // 0..1
  styleConfidence: number; // 0..1
  dealbreakerMultiplier: number; // 0..1
  /** Soft signal from sexual communication comfort score alignment. */
  sexualCommunicationAdjustment?: number;
}): number {
  const styleConfidence = Math.max(0, Math.min(1, params.styleConfidence));
  const weightedStyleScore = params.styleScore * styleConfidence + 0.5 * (1 - styleConfidence);
  const softAdj = params.sexualCommunicationAdjustment ?? 0;
  const finalScore =
    (params.attachmentScore * 0.35 +
      params.valuesScore * 0.3 +
      weightedStyleScore * 0.2 +
      params.semanticScore * 0.15 +
      softAdj) *
    params.dealbreakerMultiplier;
  return Math.max(0, Math.min(1, finalScore));
}
