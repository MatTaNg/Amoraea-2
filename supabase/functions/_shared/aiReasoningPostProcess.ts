/**
 * Canonical AI interview reasoning post-process helpers (app + edge).
 * @see src/features/aria/aiReasoningPostProcess.ts
 */

import type { AIReasoningResult } from './generateAIReasoning.ts';

export type PrepareAIReasoningForPersistenceOptions = {
  onClaimMapAudit?: (claimMap: Record<string, string[] | string>) => void;
};

export const PILLAR_CONSTRUCT_KEYS = [
  'mentalizing',
  'accountability',
  'contempt',
  'repair',
  'regulation',
  'attunement',
  'appreciation',
  'commitment_threshold',
] as const;

const REASONING_FAILURE_META_KEYS = [
  '_generationFailed',
  '_narrativeFailed',
  '_reasoningPending',
  'last_error',
  'failed_at',
  'note',
] as const;

const NO_GROWTH_EDGE_PATTERN =
  /not directly assessed|no direct evidence|insufficient direct data|if you want this area evaluated/i;

export function buildScoreAnchorBlock(
  pillarScores: Record<string, number>,
  weightedScore: number | null,
  passed: boolean
): string {
  const ws =
    weightedScore != null && Number.isFinite(weightedScore) ? String(weightedScore) : 'N/A';
  const line = (k: string) => `${k}: ${pillarScores[k] ?? 'N/A'}`;
  return `
AUTHORITATIVE SCORES — YOU MUST USE THESE EXACT VALUES THROUGHOUT YOUR RESPONSE.
DO NOT CALCULATE, ESTIMATE, OR MODIFY THESE SCORES.
Any score you write must match the corresponding value below exactly.

weighted_score: ${ws}
passed: ${passed ? 'true' : 'false'}

PILLAR SCORES (use these exact values in construct_breakdown):
${PILLAR_CONSTRUCT_KEYS.map(line).join('\n')}

THESE SCORES ARE FINAL. Do not round, adjust, or independently reassess them.
Referring to any score not listed above is a critical error.
`.trim();
}

export function buildPillarScoreBlock(
  pillarScores: Record<string, number>,
  weightedScore: number | null,
  passed: boolean
): string {
  const line = (k: string) => `${k}: ${pillarScores[k] ?? 'N/A'}`;
  return `
PILLAR SCORES (use these exactly in construct_breakdown.score):
${PILLAR_CONSTRUCT_KEYS.map(line).join('\n')}
weighted_score: ${weightedScore ?? 'N/A'}
passed: ${passed}
`.trim();
}

const REASONING_SCORE_TEXT_FIELDS = [
  'overall_summary',
  'readiness_assessment',
  'consistency_note',
  'cross_scenario_patterns',
  'what_a_partner_would_experience',
] as const;

export function validateAndCorrectReasoningScores(
  reasoning: AIReasoningResult,
  weightedScore: number,
  pillarScores: Record<string, number>
): { corrected: AIReasoningResult; hadErrors: boolean } {
  let hadErrors = false;

  for (const field of REASONING_SCORE_TEXT_FIELDS) {
    const text = reasoning[field];
    if (typeof text !== 'string' || !text.trim()) continue;

    const scorePattern = /score of (\d+\.?\d*)/gi;
    const matches = [...text.matchAll(scorePattern)];
    let updated = text;

    for (const match of matches) {
      const mentionedScore = parseFloat(match[1] ?? '');
      if (!Number.isFinite(mentionedScore)) continue;
      if (Math.abs(mentionedScore - weightedScore) > 0.1) {
        console.error(
          `[ReasoningScore] fabricated score detected in ${field}: mentioned ${mentionedScore}, actual ${weightedScore}`
        );
        updated = updated.replace(match[0], `score of ${weightedScore}`);
        hadErrors = true;
      }
    }

    if (updated !== text) {
      reasoning[field] = updated;
    }
  }

  if (anchorConstructBreakdownScores(reasoning, pillarScores)) {
    hadErrors = true;
  }

  if (hadErrors) {
    console.log('[ReasoningScore] corrections applied — saving corrected reasoning');
  }

  return { corrected: reasoning, hadErrors };
}

export function buildAuthoritativeScoreRule(pillarScores: Record<string, number>): string {
  const lines = PILLAR_CONSTRUCT_KEYS.map((k) => `- ${k}: ${pillarScores[k] ?? 'N/A'}`).join('\n');
  return `CRITICAL SCORE RULE: The "score" field in each construct must use EXACTLY the computed score provided below. Do not assess, estimate, or modify these scores. They are pre-computed and authoritative. Using a different score is a generation error.

AUTHORITATIVE COMPUTED SCORES — use these exactly:
${lines}

In construct_breakdown, the score field for each pillar must match the corresponding value above exactly. Do not round, adjust, or independently assess these scores.`;
}

export function anchorConstructBreakdownScores(
  reasoning: AIReasoningResult,
  pillarScores: Record<string, number>
): boolean {
  let scoresMismatch = false;
  const breakdown = reasoning.construct_breakdown ?? {};
  for (const pillar of PILLAR_CONSTRUCT_KEYS) {
    const computed = pillarScores[pillar];
    if (computed == null || !Number.isFinite(computed)) continue;
    const construct = breakdown[pillar];
    if (!construct) continue;
    const narrativeScore = construct.score;
    if (narrativeScore != null && Math.abs(narrativeScore - computed) > 0.5) {
      console.warn(
        `[Reasoning] score mismatch on ${pillar} — narrative: ${narrativeScore}, computed: ${computed}`
      );
      construct.score = computed;
      scoresMismatch = true;
    } else if (narrativeScore == null) {
      construct.score = computed;
      scoresMismatch = true;
    }
  }
  if (scoresMismatch) {
    console.log('[Reasoning] corrected mismatched construct scores to computed values');
  }
  return scoresMismatch;
}

function extractAssessedGrowthEdges(
  reasoning: AIReasoningResult,
  unassessedMarkers: string[]
): string[] {
  const unassessed = new Set(unassessedMarkers);
  const edges: string[] = [];
  for (const [pillar, data] of Object.entries(reasoning.construct_breakdown ?? {})) {
    if (unassessed.has(pillar)) continue;
    const ge = (data?.growth_edge ?? '').trim();
    if (ge && !NO_GROWTH_EDGE_PATTERN.test(ge)) {
      edges.push(ge);
    }
  }
  return edges;
}

export function ensureOverallGrowthAreas(
  reasoning: AIReasoningResult,
  unassessedMarkers: string[] = []
): boolean {
  const existing = reasoning.overall_growth_areas ?? [];
  const populated = existing.filter((x) => typeof x === 'string' && x.trim().length > 0);
  if (populated.length >= 2) {
    reasoning.overall_growth_areas = populated;
    return false;
  }

  console.error('[Reasoning] overall_growth_areas is empty — synthesizing from pillar growth edges');
  const growthEdges = extractAssessedGrowthEdges(reasoning, unassessedMarkers);
  if (growthEdges.length === 0) {
    return false;
  }

  const unique = [...new Set(growthEdges)];
  reasoning.overall_growth_areas = unique.slice(0, 3);
  console.log(
    '[Reasoning] growth areas synthesized from pillar edges:',
    reasoning.overall_growth_areas.length
  );
  return true;
}

export function stripReasoningFailureMeta(reasoning: Record<string, unknown>): Record<string, unknown> {
  const out = { ...reasoning };
  for (const key of REASONING_FAILURE_META_KEYS) {
    delete out[key];
  }
  return out;
}

/** Remove false failure flags when substantive narrative fields are present. */
export function recoverFailedReasoningPayload(
  reasoning: Record<string, unknown> | null | undefined
): Record<string, unknown> | null {
  if (!reasoning || typeof reasoning !== 'object') return null;
  const failed =
    reasoning._generationFailed === true || reasoning._narrativeFailed === true;
  const overall = reasoning.overall_summary;
  const hasContent = typeof overall === 'string' && overall.trim().length > 0;
  if (!failed || !hasContent) return null;
  const cleaned = stripReasoningFailureMeta(reasoning);
  cleaned._reasoningPending = false;
  return cleaned;
}

export function prepareAIReasoningForPersistence(
  reasoning: AIReasoningResult,
  pillarScores: Record<string, number>,
  unassessedMarkers: string[] = [],
  weightedScore: number | null = null,
  options?: PrepareAIReasoningForPersistenceOptions,
): Record<string, unknown> {
  if (weightedScore != null && Number.isFinite(weightedScore)) {
    validateAndCorrectReasoningScores(reasoning, weightedScore, pillarScores);
  } else {
    anchorConstructBreakdownScores(reasoning, pillarScores);
  }
  ensureOverallGrowthAreas(reasoning, unassessedMarkers);
  const asRecord = reasoning as unknown as Record<string, unknown>;
  const claimMap = asRecord._narrative_evidence_map;
  if (claimMap && typeof claimMap === 'object') {
    const typedClaimMap = claimMap as Record<string, string[] | string>;
    if (options?.onClaimMapAudit) {
      options.onClaimMapAudit(typedClaimMap);
    } else {
      console.log('[NarrativeEvidence] model claim map', claimMap);
    }
    delete asRecord._narrative_evidence_map;
  }
  const recovered = recoverFailedReasoningPayload(asRecord);
  return recovered ?? stripReasoningFailureMeta(asRecord);
}

/** Failure patch that does not set _generationFailed when substantive content already exists. */
export function buildReasoningFailurePatch(
  existing: Record<string, unknown> | null,
  error: string,
  opts?: { generationFailed?: boolean }
): Record<string, unknown> {
  const hasSubstantive =
    typeof existing?.overall_summary === 'string' &&
    (existing.overall_summary as string).trim().length > 0;
  if (hasSubstantive) {
    console.log('[Reasoning] failure with substantive content — preserving narrative, not setting failure flags');
    return {
      ...stripReasoningFailureMeta(existing!),
      _reasoningPending: false,
      _lastRetryError: error,
      _lastRetryFailedAt: new Date().toISOString(),
    };
  }
  return {
    ...(existing ?? {}),
    _reasoningPending: false,
    _narrativeFailed: true,
    ...(opts?.generationFailed ? { _generationFailed: true } : {}),
    last_error: error,
    failed_at: new Date().toISOString(),
  };
}
