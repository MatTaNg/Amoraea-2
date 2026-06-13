import type { PairCompatibilityResult } from './computePairCompatibilityScore';

/** Score before dealbreaker multiplier is applied (always 0–1). */
export function computePreDealbreakerFinalScore(result: PairCompatibilityResult): number {
  if (result.subscores.dealbreakerMultiplier === 1) {
    return result.finalScore;
  }
  const b = result.breakdown;
  return Math.max(
    0,
    Math.min(
      1,
      b.attachment +
        b.values +
        b.semantic +
        b.finance +
        b.interviewProcess +
        b.baseline -
        b.capacityDiscount +
        b.adjustments,
    ),
  );
}

export function formatCompatibilityPercent(score: number): string {
  return `${Math.round(score * 1000) / 10}%`;
}

export type MatchInsight = {
  kind: 'strength' | 'concern' | 'neutral';
  text: string;
};

export function buildMatchInsights(result: PairCompatibilityResult): MatchInsight[] {
  const insights: MatchInsight[] = [];
  const { subscores, adjustments, breakdown } = result;

  if (subscores.attachment >= 0.8) {
    insights.push({ kind: 'strength', text: 'Strong attachment fit (secure or complementary styles).' });
  } else if (subscores.attachment < 0.55) {
    insights.push({
      kind: 'concern',
      text: 'Attachment friction (anxious–avoidant, avoidant homogamy, or dual insecurity).',
    });
  }

  if (subscores.values >= 0.8) {
    insights.push({ kind: 'strength', text: 'Values profiles align well.' });
  } else if (subscores.values < 0.55) {
    insights.push({ kind: 'concern', text: 'Values mismatch on high-salience dimensions.' });
  }

  if (subscores.finance >= 0.75) {
    insights.push({ kind: 'strength', text: 'Finance philosophy and risk tolerance align.' });
  } else if (subscores.finance < 0.55) {
    insights.push({ kind: 'concern', text: 'Finance misalignment (pooling, risk, or income bracket).' });
  }

  if (breakdown.capacityDiscount >= 0.05) {
    insights.push({
      kind: 'concern',
      text: `Relational capacity discount (−${(breakdown.capacityDiscount * 100).toFixed(1)} pts).`,
    });
  }

  if (adjustments.conflictStyle < -0.015) {
    insights.push({ kind: 'concern', text: 'Conflict style friction (demand–withdraw pattern).' });
  } else if (adjustments.conflictStyle > 0.01) {
    insights.push({ kind: 'strength', text: 'Collaborative conflict style synergy.' });
  }

  if (adjustments.politics < 0) {
    insights.push({ kind: 'concern', text: 'Different politics (soft penalty).' });
  }

  if (adjustments.psychometricSoft < -0.02) {
    insights.push({ kind: 'concern', text: 'Psychometric soft flags (NPI / entitlement divergence).' });
  }

  if (subscores.interviewProcess >= 0.85) {
    insights.push({ kind: 'strength', text: 'Interview process pillars align (repair/accountability).' });
  } else if (subscores.interviewProcess < 0.6) {
    insights.push({ kind: 'concern', text: 'Interview process mismatch or elevated contempt risk.' });
  }

  if (insights.length === 0) {
    insights.push({ kind: 'neutral', text: 'Moderate fit across dimensions — no dominant flags.' });
  }

  return insights;
}
