import type { GateResult } from '@features/aria/computeGateResult';

export type InterviewModifierPersistFields = {
  depth_signal_modifier: number;
  score_modifier: number;
  modified_weighted_score: number | null;
};

export function interviewModifierFieldsFromGateResult(
  gate: Pick<
    GateResult,
    'weightedScore' | 'scoreModifier' | 'depthSignalModifier' | 'modifiedWeightedScore'
  >,
): InterviewModifierPersistFields {
  const depthMod = gate.depthSignalModifier ?? gate.scoreModifier ?? 0;
  const scoreMod = gate.scoreModifier ?? gate.depthSignalModifier ?? 0;
  const weighted = gate.weightedScore;
  const modified =
    gate.modifiedWeightedScore ??
    (typeof weighted === 'number' && Number.isFinite(weighted)
      ? Math.round((weighted + depthMod) * 100) / 100
      : null);
  return {
    depth_signal_modifier: depthMod,
    score_modifier: scoreMod,
    modified_weighted_score: modified,
  };
}

export function defaultModifierFieldsFromWeightedScore(
  weightedScore: number,
): InterviewModifierPersistFields & { modified_weighted_score: number } {
  return {
    depth_signal_modifier: 0,
    score_modifier: 0,
    modified_weighted_score: weightedScore,
  };
}

export function attemptRowMissingInterviewModifiers(row: {
  score_modifier?: unknown;
  depth_signal_modifier?: unknown;
  modified_weighted_score?: unknown;
}): boolean {
  const depth = row.depth_signal_modifier;
  const score = row.score_modifier;
  const modified = row.modified_weighted_score;
  return (
    typeof depth !== 'number' ||
    !Number.isFinite(depth) ||
    typeof score !== 'number' ||
    !Number.isFinite(score) ||
    typeof modified !== 'number' ||
    !Number.isFinite(modified)
  );
}
