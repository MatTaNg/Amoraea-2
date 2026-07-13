import { parseContemptTierBreakdown } from '@features/aria/contemptExpressionScoringRubric';
import type { ContemptTierBreakdown } from '@features/aria/contemptExpressionScoringRubric';
import type { ResponseConcretenessLevel } from '@features/aria/personalMomentConcreteness';
import { coerceMentalizingOvercertaintyFromModelJson } from '@features/aria/personalMomentScoringPrompt';

export type MentalizingInferenceSource =
  | 'scenario_restatement'
  | 'surface_addition'
  | 'independent_inference';

export interface ScenarioScoreResult {
  scenarioNumber: number;
  scenarioName: string;
  pillarScores: Record<string, number | null>;
  pillarConfidence: Record<string, string>;
  keyEvidence: Record<string, string>;
  specificity: string;
  repairCoherenceIssue: string | null;
  mentalizing_inference_source?: MentalizingInferenceSource;
  mentalizing_overcertainty?: boolean;
  contempt_tier_breakdown: ContemptTierBreakdown | null;
  scoringMetadata?: Record<string, unknown> | null;
}

export interface PersonalMomentScoreResult {
  momentNumber: 4 | 5;
  momentName: string;
  pillarScores: Record<string, number | null>;
  pillarConfidence: Record<string, string>;
  keyEvidence: Record<string, string>;
  summary: string;
  specificity: string;
  contempt_tier_breakdown?: ContemptTierBreakdown | null;
  mentalizing_overcertainty?: boolean;
  response_concreteness?: ResponseConcretenessLevel;
  emotional_vocab_count?: number | null;
  emotional_vocab_words?: string[];
  user_slice_word_count?: number | null;
  scoringMetadata?: Record<string, unknown> | null;
}

function applyMentalizingOvercertaintyScoreCap(pillarScores: Record<string, number | null>): void {
  const m = pillarScores.mentalizing;
  if (typeof m !== 'number' || !Number.isFinite(m) || m <= 7) return;
  pillarScores.mentalizing = 7;
}

export function normalizeMentalizingInferenceSource(raw: unknown): MentalizingInferenceSource | undefined {
  return raw === 'scenario_restatement' || raw === 'surface_addition' || raw === 'independent_inference'
    ? raw
    : undefined;
}

export function finalizeScenarioMentalizingOvercertaintyFromModel(parsed: ScenarioScoreResult): void {
  const flag = coerceMentalizingOvercertaintyFromModelJson(
    parsed as {
      mentalizing_overcertainty?: unknown;
      keyEvidence?: Record<string, unknown> | null;
      scoringMetadata?: Record<string, unknown> | null;
    },
  );
  parsed.mentalizing_overcertainty = flag;
  if (flag) {
    applyMentalizingOvercertaintyScoreCap(parsed.pillarScores);
  }
}

export function scenarioDbBundleToScenarioScoreResult(
  scenarioNumber: 1 | 2 | 3,
  raw: unknown,
): ScenarioScoreResult {
  const o = (raw ?? {}) as Record<string, unknown>;
  const ps = (o.pillarScores ?? {}) as Record<string, number | null>;
  const pc = (o.pillarConfidence ?? {}) as Record<string, string>;
  const ke = (o.keyEvidence ?? {}) as Record<string, string>;
  const out: ScenarioScoreResult = {
    scenarioNumber,
    scenarioName: typeof o.scenarioName === 'string' ? o.scenarioName : `Scenario ${scenarioNumber}`,
    pillarScores: ps,
    pillarConfidence: pc,
    keyEvidence: ke,
    specificity: typeof o.specificity === 'string' ? o.specificity : 'high',
    repairCoherenceIssue: typeof o.repairCoherenceIssue === 'string' ? o.repairCoherenceIssue : null,
    mentalizing_inference_source: normalizeMentalizingInferenceSource(o.mentalizing_inference_source),
    mentalizing_overcertainty: coerceMentalizingOvercertaintyFromModelJson({
      mentalizing_overcertainty: o.mentalizing_overcertainty,
      keyEvidence: ke as unknown as Record<string, unknown>,
      scoringMetadata:
        o.scoringMetadata != null && typeof o.scoringMetadata === 'object' && !Array.isArray(o.scoringMetadata)
          ? (o.scoringMetadata as Record<string, unknown>)
          : null,
    }),
    contempt_tier_breakdown: parseContemptTierBreakdown(o.contempt_tier_breakdown),
  };
  if (out.mentalizing_overcertainty) {
    const capped = { ...out.pillarScores };
    applyMentalizingOvercertaintyScoreCap(capped);
    out.pillarScores = capped;
  }
  return out;
}

export function finalizePersonalMomentMentalizingOvercertaintyFromModel(parsed: PersonalMomentScoreResult): void {
  const flag = coerceMentalizingOvercertaintyFromModelJson(
    parsed as {
      mentalizing_overcertainty?: unknown;
      keyEvidence?: Record<string, unknown> | null;
      scoringMetadata?: Record<string, unknown> | null;
    },
  );
  parsed.mentalizing_overcertainty = flag;
  if (flag) {
    applyMentalizingOvercertaintyScoreCap(parsed.pillarScores);
  }
}

export function normalizePersonalMomentContemptTierBreakdown(result: PersonalMomentScoreResult): void {
  if (result.pillarScores?.contempt_expression == null) {
    result.contempt_tier_breakdown = null;
  } else {
    result.contempt_tier_breakdown = parseContemptTierBreakdown(result.contempt_tier_breakdown);
  }
}
