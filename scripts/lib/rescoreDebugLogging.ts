/**
 * Debug logging for LLM rescore calibration (M5 conflict validity + scenario slice scores).
 */
import type { Moment5ClientScoringMetadata } from '../../src/features/aria/moment5AccountabilityScoringPrompt';
import {
  analyzeConflictValidityClassification,
  classifyConflictValidity,
  extractPriorM5TranscriptBeforeClarification,
  looksLikeMoment5ConflictValidityClarificationPrompt,
  type ConflictValidityResult,
} from '../../src/features/aria/probeAndScoringUtils';

export type TranscriptTurnLike = {
  role: string;
  content: string;
  interviewMoment?: number;
};

function extractStoredPillarScores(stored: unknown): Record<string, number | null | undefined> {
  if (stored == null || typeof stored !== 'object' || Array.isArray(stored)) return {};
  const ps =
    (stored as { pillarScores?: unknown }).pillarScores ??
    (stored as { pillar_scores?: unknown }).pillar_scores;
  if (ps == null || typeof ps !== 'object' || Array.isArray(ps)) return {};
  return ps as Record<string, number | null | undefined>;
}

function extractStoredKeyEvidence(stored: unknown): Record<string, string> {
  if (stored == null || typeof stored !== 'object' || Array.isArray(stored)) return {};
  const ke =
    (stored as { keyEvidence?: unknown }).keyEvidence ??
    (stored as { key_evidence?: unknown }).key_evidence;
  if (ke == null || typeof ke !== 'object' || Array.isArray(ke)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(ke as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

function scoreLine(label: string, score: unknown): string {
  return typeof score === 'number' && Number.isFinite(score) ? String(score) : '-';
}

/** Locate the user turn answering the conflict-validity clarification (if present). */
export function findMoment5ConflictValidityClarificationAnswer(m5Slice: TranscriptTurnLike[]): {
  clarificationAssistantIdx: number;
  clarificationResponse: string | null;
  priorTranscriptBeforeAnswer: TranscriptTurnLike[];
} {
  let clarificationAssistantIdx = -1;
  for (let i = m5Slice.length - 1; i >= 0; i--) {
    const m = m5Slice[i];
    if (m.role !== 'assistant') continue;
    if (looksLikeMoment5ConflictValidityClarificationPrompt(m.content)) {
      clarificationAssistantIdx = i;
      break;
    }
  }
  if (clarificationAssistantIdx < 0) {
    return { clarificationAssistantIdx: -1, clarificationResponse: null, priorTranscriptBeforeAnswer: m5Slice };
  }
  const after = m5Slice.slice(clarificationAssistantIdx + 1);
  const firstUser = after.find((m) => m.role === 'user' && m.content.trim().length > 0);
  return {
    clarificationAssistantIdx,
    clarificationResponse: firstUser?.content?.trim() ?? null,
    priorTranscriptBeforeAnswer: m5Slice.slice(0, clarificationAssistantIdx + 1),
  };
}

export function logMoment5ConflictValidityDebug(opts: {
  m5Slice: TranscriptTurnLike[];
  storedMeta: Moment5ClientScoringMetadata | null;
}): ConflictValidityResult | null {
  const { m5Slice, storedMeta } = opts;
  const storedValidity: ConflictValidityResult | null =
    storedMeta?.conflictValidity ??
    (storedMeta?.conflictValidityLow === true ? 'no_conflict' : null);

  console.log('');
  console.log('[M5_DEBUG] Conflict validity analysis');
  console.log(`  stored scoringMetadata.conflictValidity: ${storedValidity ?? '(null → prompt defaults TYPE C)'}`);
  console.log(`  stored conflictValidityClarificationAsked: ${storedMeta?.conflictValidityClarificationAsked === true}`);
  console.log(`  stored conflictValidityClarificationFired: ${storedMeta?.conflictValidityClarificationFired === true}`);

  const { clarificationAssistantIdx, clarificationResponse, priorTranscriptBeforeAnswer } =
    findMoment5ConflictValidityClarificationAnswer(m5Slice);

  if (clarificationAssistantIdx < 0 || !clarificationResponse) {
    console.log('  transcript: no conflict-validity clarification Q+A found in M5 slice');
    console.log('  rescore uses stored metadata only (classifyConflictValidity not re-run)');
    return storedValidity;
  }

  const priorM5 = extractPriorM5TranscriptBeforeClarification(
    priorTranscriptBeforeAnswer.filter((m) => m.role === 'user'),
  );
  const analysis = analyzeConflictValidityClassification(clarificationResponse, priorM5);

  console.log(`  clarification answer (preview): ${clarificationResponse.slice(0, 240).replace(/\s+/g, ' ')}${clarificationResponse.length > 240 ? '…' : ''}`);
  console.log(`  prior M5 user text length: ${priorM5.length} chars`);
  console.log(`  prior M5 preview: ${priorM5.slice(0, 320).replace(/\s+/g, ' ')}${priorM5.length > 320 ? '…' : ''}`);
  console.log(`  matched no_conflict phrases: ${analysis.matchedNoConflictPhrases.length ? analysis.matchedNoConflictPhrases.join(', ') : '(none)'}`);
  console.log(`  matched resolved_well phrases: ${analysis.matchedResolvedWellPhrases.length ? analysis.matchedResolvedWellPhrases.join(', ') : '(none)'}`);
  console.log(`  prior tension tokens: ${analysis.priorTensionMatches.length ? analysis.priorTensionMatches.join(', ') : '(none)'}`);
  console.log(`  recomputed classifyConflictValidity: ${analysis.result}`);
  if (storedValidity != null && storedValidity !== analysis.result) {
    console.log(`  WARN: stored (${storedValidity}) != recomputed (${analysis.result})`);
  } else if (storedValidity == null) {
    console.log(`  NOTE: stored null — live prompt would default TYPE C`);
  }
  console.log('  rescore LLM path uses recomputed conflictValidity for M5 prompt (see line above)');
  console.log('');

  return analysis.result;
}

/** Recompute conflict_validity from transcript (calibration rescore — not used in live app). */
export function recomputeMoment5ConflictValidityMeta(
  m5Slice: TranscriptTurnLike[],
  storedMeta: Moment5ClientScoringMetadata | null,
): Moment5ClientScoringMetadata | null {
  const { clarificationResponse, priorTranscriptBeforeAnswer } =
    findMoment5ConflictValidityClarificationAnswer(m5Slice);
  if (!clarificationResponse) return storedMeta;
  const priorM5 = extractPriorM5TranscriptBeforeClarification(
    priorTranscriptBeforeAnswer.filter((m) => m.role === 'user'),
  );
  const recomputed = classifyConflictValidity(clarificationResponse, priorM5);
  return {
    ...(storedMeta ?? { accountabilityProbeFired: false }),
    conflictValidityClarificationAsked: true,
    conflictValidity: recomputed,
  };
}

export function logScenarioSliceDebug(opts: {
  scenarioNumber: 1 | 2 | 3;
  parsed: Record<string, unknown>;
  storedScenarioScores: unknown;
}): void {
  const { scenarioNumber, parsed, storedScenarioScores } = opts;
  const ps = (parsed.pillarScores as Record<string, number | null | undefined>) ?? {};
  const ke = (parsed.keyEvidence as Record<string, string>) ?? {};
  const storedPs = extractStoredPillarScores(storedScenarioScores);
  const storedKe = extractStoredKeyEvidence(storedScenarioScores);

  const markers =
    scenarioNumber === 1
      ? (['mentalizing', 'contempt_recognition', 'contempt_expression'] as const)
      : scenarioNumber === 2
        ? (['mentalizing', 'contempt_expression'] as const)
        : (['mentalizing', 'contempt_expression'] as const);

  console.log('');
  console.log(`[S${scenarioNumber}_DEBUG] Scenario ${scenarioNumber} LLM scores (new vs stored)`);
  for (const id of markers) {
    const newScore = ps[id];
    const oldScore = storedPs[id];
    const delta =
      typeof newScore === 'number' &&
      typeof oldScore === 'number' &&
      Number.isFinite(newScore) &&
      Number.isFinite(oldScore)
        ? newScore - oldScore
        : null;
    const deltaStr = delta != null ? (delta >= 0 ? `+${delta}` : String(delta)) : '';
    console.log(
      `  ${id}: new=${scoreLine('n', newScore)} stored=${scoreLine('s', oldScore)}${deltaStr ? ` (${deltaStr})` : ''}`,
    );
    const evidence = ke[id]?.trim();
    if (evidence) {
      const excerpt = evidence.length > 420 ? `${evidence.slice(0, 420)}…` : evidence;
      console.log(`    new evidence: ${excerpt.replace(/\s+/g, ' ')}`);
    }
    const storedEvidence = storedKe[id]?.trim();
    if (storedEvidence && storedEvidence !== evidence) {
      const excerpt = storedEvidence.length > 280 ? `${storedEvidence.slice(0, 280)}…` : storedEvidence;
      console.log(`    stored evidence: ${excerpt.replace(/\s+/g, ' ')}`);
    }
  }
  const infSource = parsed.mentalizing_inference_source;
  if (typeof infSource === 'string' && infSource.trim()) {
    console.log(`  mentalizing_inference_source: ${infSource}`);
  }
  if (parsed.mentalizing_overcertainty === true) {
    console.log('  mentalizing_overcertainty: true');
  }
  console.log('');
}
