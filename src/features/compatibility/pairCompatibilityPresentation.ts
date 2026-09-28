import type { PairCompatibilityResult } from './computePairCompatibilityScore';

/** Score before dealbreaker multiplier is applied (always 0–1). */
export function computePreDealbreakerFinalScore(result: PairCompatibilityResult): number {
  if (result.subscores.dealbreakerMultiplier === 1) {
    return result.finalScore;
  }
  const contributions = result.contributionBreakdown;
  if (contributions) {
    const core =
      contributions.core.concreteLifeFit.contribution +
      contributions.core.lifeDomainImportanceAlignment.contribution +
      contributions.core.finance.contribution +
      contributions.core.attachmentSimilarity.contribution +
      contributions.core.valuesSimilarity.contribution;
    const adjustments =
      contributions.adjustments.anxiousAvoidant +
      contributions.adjustments.sexualDiscrepancy +
      contributions.adjustments.conflictStyle +
      contributions.adjustments.politics +
      contributions.adjustments.psychometricSoft +
      contributions.adjustments.preferenceMismatch;
    return Math.max(0, Math.min(1, core + adjustments));
  }
  const b = result.breakdown;
  return Math.max(
    0,
    Math.min(
      1,
      b.lifeDomain +
        b.concreteLifeFit +
        b.semantic +
        b.finance +
        b.attachment +
        b.values +
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
  const { subscores, adjustments } = result;

  if (subscores.dealbreakerMultiplier === 0) {
    insights.push({
      kind: 'concern',
      text: 'Pair is ineligible due to a hard dealbreaker mismatch.',
    });
  }

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

  if (adjustments.conflictStyle < -0.015) {
    insights.push({ kind: 'concern', text: 'Conflict style friction (demand–withdraw pattern).' });
  } else if (adjustments.conflictStyle > 0.01) {
    insights.push({ kind: 'strength', text: 'Collaborative conflict style synergy.' });
  }

  if (adjustments.politics < 0) {
    insights.push({ kind: 'concern', text: 'Different politics (soft penalty).' });
  }

  if (adjustments.psychometricSoft < -0.02) {
    insights.push({ kind: 'concern', text: 'Psychometric soft flags on live instruments.' });
  }

  if (insights.length === 0) {
    insights.push({ kind: 'neutral', text: 'Moderate fit across dimensions — no dominant flags.' });
  }

  return insights;
}
