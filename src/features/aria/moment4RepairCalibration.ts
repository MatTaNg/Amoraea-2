export type PersonalMomentScoreLike = {
  momentNumber: 4 | 5;
  pillarScores: Record<string, number | null>;
  pillarConfidence?: Record<string, string>;
  keyEvidence?: Record<string, string>;
  summary?: string;
  specificity?: string;
};

function hasActiveAntiRepairBehavior(text: string): boolean {
  const t = (text ?? '').toLowerCase();
  return /\b(escalat(ed|ing)|made it worse|refus(ed|ing) to reconcile|reconciliation was offered and i refused|sabotag(ed|ing)|retaliat(ed|ing)|punish(ed|ing) them|deliberately hurt)\b/.test(t);
}

function hasDistancingWithoutConfrontation(text: string): boolean {
  const t = (text ?? '').toLowerCase();
  return /\b(stepped back|distanc(ed|ing)|pulled away|kept my distance|stopped talking|never confronted|didn'?t confront|avoided the conversation|just moved on)\b/.test(t);
}

/**
 * MOMENT4_REPAIR_ANTI_REPAIR_RULE (permanent scoring safeguard):
 * Repair <= 2 is valid ONLY for active anti-repair behavior:
 * - deliberate escalation,
 * - explicit refusal of reconciliation when offered,
 * - or actions that made repair less possible.
 *
 * Distancing/stepping back without confrontation is avoidant-neutral,
 * and must be calibrated into 4.0-5.0 for Moment 4 Repair.
 */
export function applyMoment4RepairCalibrationRule(
  scored: PersonalMomentScoreLike,
  userAnswerText: string
): PersonalMomentScoreLike {
  if (scored.momentNumber !== 4) return scored;
  const rawRepair = scored.pillarScores?.repair;
  if (typeof rawRepair !== 'number' || !Number.isFinite(rawRepair)) return scored;
  if (hasActiveAntiRepairBehavior(userAnswerText)) return scored;
  if (!hasDistancingWithoutConfrontation(userAnswerText)) return scored;
  if (rawRepair > 2) return scored;
  return {
    ...scored,
    pillarScores: {
      ...scored.pillarScores,
      repair: 4.5,
    },
  };
}

