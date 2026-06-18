import type { MarkerScoreSlice } from './aggregateMarkerScoresFromSlices';
import { PILLAR_ROLLUP_ALGORITHM_VERSION } from './aggregateMarkerScoresFromSlices';
import { isPersonalMomentTranscriptTurn } from './defensePatternsDetection';
import {
  aggregatePillarScoresWithCommitmentMergeDetailed,
  extractEgoDevelopmentLevel,
  type DefensePatternsJson,
} from './aggregateMarkerScoresFromSlices';
import { enrichScenarioSliceWithContemptHeuristic } from './contemptExpressionScenarioHeuristic';
import type { ComputeGateResultOptions, GateResult } from './computeGateResultCore';
import { computeGateResultCore } from './computeGateResultCore';
import type { CompletionGateFailure } from './interviewCompletionGate';
import {
  buildIncompleteInterviewGateResult,
  evaluateInterviewCompletionGate,
} from './interviewCompletionGate';
import { INTERVIEW_MARKER_IDS } from './interviewMarkers';
import {
  sanitizeMoment5PersonalScoresForAggregate,
  sanitizePersonalMomentScoresForAggregate,
} from './personalMomentSliceSanitize';
import { fullScenarioReconciliation, type ReconcilableScenarioSlice } from './reconcileScenarioScoresTranscript';
import { scenarioCompositesToStorageJson } from './scenarioCompositeFloor';
import { personalMomentWordCountsForDisclosure } from './aggregateMarkerScoresFromSlices';
import { computeSkipPenaltyGateComputation } from './interviewSkipPenalties';
import { normalizeResponseConcreteness, normalizeMoment4Concreteness } from './personalMomentConcreteness';
import {
  extractPersonalMomentEmotionalVocabFromSlice,
  scenarioEmotionalVocabDensityPercentFromTranscript,
} from './personalMomentEmotionalVocab';

function parseObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return typeof p === 'object' && p != null && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

type TranscriptMsg = { role?: string; content?: string; scenarioNumber?: number; interviewMoment?: number };

function userTextForScenario(transcript: unknown, scenarioNum: 1 | 2 | 3): string {
  if (!Array.isArray(transcript)) return '';
  return (transcript as TranscriptMsg[])
    .filter(
      (m) =>
        m.role === 'user' &&
        m.scenarioNumber === scenarioNum &&
        typeof m.content === 'string' &&
        !isPersonalMomentTranscriptTurn(m),
    )
    .map((m) => String(m.content).trim())
    .filter(Boolean)
    .join(' ');
}

function extractSlice(raw: unknown): {
  pillarScores?: Record<string, number | null>;
  keyEvidence?: Record<string, string>;
  pillarConfidence?: Record<string, string>;
  mentalizing_overcertainty?: boolean;
} | null {
  const obj = parseObject(raw);
  if (!obj) return null;
  const ps = obj.pillarScores ?? obj.pillar_scores;
  const ke = obj.keyEvidence ?? obj.key_evidence;
  const pc = obj.pillarConfidence ?? obj.pillar_confidence;
  if (ps == null && ke == null) return null;
  return {
    pillarScores:
      typeof ps === 'object' && ps != null && !Array.isArray(ps) ? (ps as Record<string, number | null>) : undefined,
    keyEvidence:
      typeof ke === 'object' && ke != null && !Array.isArray(ke) ? (ke as Record<string, string>) : undefined,
    pillarConfidence:
      typeof pc === 'object' && pc != null && !Array.isArray(pc) ? (pc as Record<string, string>) : undefined,
    mentalizing_overcertainty: obj.mentalizing_overcertainty === true,
  };
}

function toReconcilableSlice(
  raw: unknown,
  scenarioNumber: 1 | 2 | 3
): ReconcilableScenarioSlice | null {
  const ex = extractSlice(raw);
  if (!ex?.pillarScores && !ex?.keyEvidence) return null;
  return {
    scenarioNumber,
    pillarScores: ex.pillarScores ?? {},
    pillarConfidence: ex.pillarConfidence ?? {},
    keyEvidence: ex.keyEvidence ?? {},
  };
}

export type AdminRecalculateOptions = {
  /**
   * Stored scenario_*_scores were persisted after contempt heuristic + transcript reconciliation
   * at interview completion; re-applying those steps double-processes slices.
   * @default true
   */
  skipScenarioTranscriptMutations?: boolean;
  /** Use persisted gate aux fields (defense, disclosure, skip penalties) for baseline parity. */
  usePersistedGateContext?: boolean;
};

export type AdminRecalculateAttemptInput = {
  transcript: unknown;
  scenario_1_scores: unknown;
  scenario_2_scores: unknown;
  scenario_3_scores: unknown;
  scenario_specific_patterns: unknown;
  skip_count?: number | string | null;
  ego_development_level?: unknown;
  /** Stored `interview_attempts.language_markers` — optional `emotional_vocab_density` for divergence vs personal moments. */
  language_markers?: unknown;
  /** Persisted gate context (used when `usePersistedGateContext`). */
  defense_patterns?: unknown;
  disclosure_calibration?: unknown;
  mentalizing_overcertainty_count?: number | null;
  skip_penalty_total?: number | null;
  auto_failed?: boolean | null;
  moment_4_concreteness?: unknown;
  moment_5_concreteness?: unknown;
  personal_moment_emotional_vocab_density?: number | null;
  personal_moment_emotional_vocab_low?: boolean | null;
  /** When `usePersistedGateContext`, use as gate `precomputedWeightedScore` for baseline parity. */
  persisted_weighted_score?: number | null;
};

export type AdminRecalculateSuccess = {
  kind: 'success';
  pillar_scores: Record<string, number>;
  gate: GateResult;
  notes: string[];
  scenarioCompositesJson: Record<string, unknown> | null;
  mentalizingOvercertaintyCount: number;
  defense_patterns: DefensePatternsJson;
  disclosure_calibration: string;
  personal_moment_emotional_vocab_density: number | null;
  personal_moment_emotional_vocab_low: boolean;
  moment_4_concreteness: string | null;
  moment_5_concreteness: string | null;
  ego_development_level: number | null;
};

export type AdminRecalculateIncomplete = {
  kind: 'incomplete';
  gate: GateResult;
  notes: string[];
  completionFailure: CompletionGateFailure;
};

export type AdminRecalculateResult = AdminRecalculateSuccess | AdminRecalculateIncomplete;

function buildGateNotes(gate: GateResult): string[] {
  const notes: string[] = [];
  if (gate.failReason) notes.push(`gate: ${gate.failReason}`);
  const d = gate.failReasonDetail;
  if (d?.mentalizing_floor?.lowScenarios?.length) {
    notes.push(
      `mentalizing floor: scenarios ${d.mentalizing_floor.lowScenarios.map((x) => x.scenario).join(', ')}`
    );
  }
  if (d?.repair_floor?.lowScenarios?.length) {
    notes.push(`repair floor: scenarios ${d.repair_floor.lowScenarios.map((x) => x.scenario).join(', ')}`);
  }
  if (d?.ego_development_floor) {
    const e = d.ego_development_floor;
    notes.push(`ego development floor: level ${e.level}, weighted ${e.weightedScore.toFixed(1)}`);
  }
  if (d?.scenario_floor?.breaches?.length) {
    notes.push(
      `scenario composite floor: ${d.scenario_floor.breaches.map((b) => `S${b.scenario}=${b.composite.toFixed(2)}`).join('; ')}`
    );
  }
  return notes;
}

function scenarioSliceFromStored(
  raw: ReconcilableScenarioSlice,
  txArr: TranscriptMsg[],
  scenarioNumber: 1 | 2 | 3,
  skipMutations: boolean,
): { pillarScores?: Record<string, number | null>; keyEvidence?: Record<string, string> } | null {
  if (skipMutations) {
    return {
      pillarScores: raw.pillarScores as Record<string, number | null>,
      keyEvidence: raw.keyEvidence,
    };
  }
  const reco = fullScenarioReconciliation(raw, txArr);
  return enrichScenarioSliceWithContemptHeuristic(
    { pillarScores: reco.pillarScores, keyEvidence: reco.keyEvidence },
    userTextForScenario(txArr, scenarioNumber),
  );
}

/**
 * Re-run pillar aggregation + weighted gate from stored scenario/moment JSON and transcript (reconciliation + heuristics only — no LLM/TTS/audio).
 */
export function recalculateAttemptScoresFromStoredSlices(
  input: AdminRecalculateAttemptInput,
  options?: AdminRecalculateOptions,
): AdminRecalculateResult {
  const skipScenarioTranscriptMutations = options?.skipScenarioTranscriptMutations !== false;
  const usePersistedGateContext = options?.usePersistedGateContext === true;
  const patterns = parseObject(input.scenario_specific_patterns);
  const m4Raw = parseObject(patterns?.moment_4_scores);
  const m5Raw = parseObject(patterns?.moment_5_scores);
  const tx = input.transcript;
  const txArr = (Array.isArray(tx) ? tx : []) as TranscriptMsg[];

  const completionGate = evaluateInterviewCompletionGate({
    scenario1: input.scenario_1_scores,
    scenario2: input.scenario_2_scores,
    scenario3: input.scenario_3_scores,
    moment4: m4Raw,
  });

  if (!completionGate.ok) {
    const gate = buildIncompleteInterviewGateResult(completionGate);
    const notes: string[] = [
      `completion gate: ${completionGate.detail}`,
      `weighted score withheld — incomplete data`,
    ];
    return { kind: 'incomplete', gate, notes, completionFailure: completionGate };
  }

  const raw1 = toReconcilableSlice(input.scenario_1_scores, 1);
  const raw2 = toReconcilableSlice(input.scenario_2_scores, 2);
  const raw3 = toReconcilableSlice(input.scenario_3_scores, 3);
  if (!raw1 || !raw2 || !raw3) {
    const failure: CompletionGateFailure = {
      ok: false,
      incomplete_reason: 'missing_scenario_bundle',
      missingScenarioNumbers: [!raw1 ? 1 : !raw2 ? 2 : 3],
      missingMoment4: false,
      detail: 'scenario slice could not be parsed for reconciliation',
    };
    return {
      kind: 'incomplete',
      gate: buildIncompleteInterviewGateResult(failure),
      notes: ['completion gate: scenario bundle unparsed — weighted score withheld'],
      completionFailure: failure,
    };
  }

  const s1 = scenarioSliceFromStored(raw1, txArr, 1, skipScenarioTranscriptMutations);
  const s2 = scenarioSliceFromStored(raw2, txArr, 2, skipScenarioTranscriptMutations);
  const s3 = scenarioSliceFromStored(raw3, txArr, 3, skipScenarioTranscriptMutations);

  const m4Input =
    m4Raw != null
      ? {
          momentNumber: 4 as const,
          pillarScores: (m4Raw.pillarScores as Record<string, number | null>) ?? {},
          keyEvidence:
            typeof m4Raw.keyEvidence === 'object' && m4Raw.keyEvidence != null && !Array.isArray(m4Raw.keyEvidence)
              ? (m4Raw.keyEvidence as Record<string, string>)
              : undefined,
          response_concreteness:
            typeof m4Raw.response_concreteness === 'string'
              ? (m4Raw.response_concreteness as string)
              : typeof m4Raw.specificity === 'string'
                ? (m4Raw.specificity as string)
                : undefined,
          emotional_vocab_count:
            typeof m4Raw.emotional_vocab_count === 'number' ? (m4Raw.emotional_vocab_count as number) : undefined,
          emotional_vocab_words: Array.isArray(m4Raw.emotional_vocab_words)
            ? (m4Raw.emotional_vocab_words as string[])
            : undefined,
          user_slice_word_count:
            typeof m4Raw.user_slice_word_count === 'number' ? (m4Raw.user_slice_word_count as number) : undefined,
        }
      : null;
  const m5Input =
    m5Raw != null
      ? {
          momentNumber: 5 as const,
          pillarScores: (m5Raw.pillarScores as Record<string, number | null>) ?? {},
          keyEvidence:
            typeof m5Raw.keyEvidence === 'object' && m5Raw.keyEvidence != null && !Array.isArray(m5Raw.keyEvidence)
              ? (m5Raw.keyEvidence as Record<string, string>)
              : undefined,
          response_concreteness:
            typeof m5Raw.response_concreteness === 'string'
              ? (m5Raw.response_concreteness as string)
              : typeof m5Raw.specificity === 'string'
                ? (m5Raw.specificity as string)
                : undefined,
          emotional_vocab_count:
            typeof m5Raw.emotional_vocab_count === 'number' ? (m5Raw.emotional_vocab_count as number) : undefined,
          emotional_vocab_words: Array.isArray(m5Raw.emotional_vocab_words)
            ? (m5Raw.emotional_vocab_words as string[])
            : undefined,
          user_slice_word_count:
            typeof m5Raw.user_slice_word_count === 'number' ? (m5Raw.user_slice_word_count as number) : undefined,
        }
      : null;

  const m4ForAgg = skipScenarioTranscriptMutations
    ? m4Input
    : m4Input
      ? sanitizePersonalMomentScoresForAggregate(m4Input)
      : null;
  const m5ForAgg = skipScenarioTranscriptMutations
    ? m5Input
    : m5Input
      ? sanitizeMoment5PersonalScoresForAggregate(m5Input)
      : null;
  const m4Ev = m4ForAgg ? extractPersonalMomentEmotionalVocabFromSlice(m4ForAgg) : null;
  const m5Ev = m5ForAgg ? extractPersonalMomentEmotionalVocabFromSlice(m5ForAgg) : null;

  const ex1 = extractSlice(input.scenario_1_scores);
  const ex2 = extractSlice(input.scenario_2_scores);
  const ex3 = extractSlice(input.scenario_3_scores);

  const slices: MarkerScoreSlice[] = [
    s1
      ? {
          pillarScores: s1.pillarScores,
          keyEvidence: s1.keyEvidence,
          mentalizing_overcertainty: ex1?.mentalizing_overcertainty === true,
        }
      : null,
    s2
      ? {
          pillarScores: s2.pillarScores,
          keyEvidence: s2.keyEvidence,
          mentalizing_overcertainty: ex2?.mentalizing_overcertainty === true,
        }
      : null,
    s3
      ? {
          pillarScores: s3.pillarScores,
          keyEvidence: s3.keyEvidence,
          mentalizing_overcertainty: ex3?.mentalizing_overcertainty === true,
        }
      : null,
    m4ForAgg
      ? {
          pillarScores: m4ForAgg.pillarScores,
          keyEvidence: m4ForAgg.keyEvidence,
          mentalizing_overcertainty:
            m4Raw != null && typeof m4Raw === 'object' && !Array.isArray(m4Raw)
              ? (m4Raw as Record<string, unknown>).mentalizing_overcertainty === true
              : false,
          response_concreteness: normalizeMoment4Concreteness(m4ForAgg.response_concreteness),
          ...(m4Ev
            ? {
                emotional_vocab_count: m4Ev.emotional_vocab_count ?? undefined,
                emotional_vocab_words: m4Ev.emotional_vocab_words.length > 0 ? m4Ev.emotional_vocab_words : undefined,
                user_slice_word_count: m4Ev.user_slice_word_count ?? undefined,
              }
            : {}),
        }
      : null,
    m5ForAgg
      ? {
          pillarScores: m5ForAgg.pillarScores,
          keyEvidence: m5ForAgg.keyEvidence,
          mentalizing_overcertainty:
            m5Raw != null && typeof m5Raw === 'object' && !Array.isArray(m5Raw)
              ? (m5Raw as Record<string, unknown>).mentalizing_overcertainty === true
              : false,
          response_concreteness: normalizeResponseConcreteness(m5ForAgg.response_concreteness),
          ...(m5Ev
            ? {
                emotional_vocab_count: m5Ev.emotional_vocab_count ?? undefined,
                emotional_vocab_words: m5Ev.emotional_vocab_words.length > 0 ? m5Ev.emotional_vocab_words : undefined,
                user_slice_word_count: m5Ev.user_slice_word_count ?? undefined,
              }
            : {}),
        }
      : null,
  ];
  const lang = parseObject(input.language_markers);
  const storedScenarioEv =
    lang && typeof lang.scenario_emotional_vocab_density === 'number' && Number.isFinite(lang.scenario_emotional_vocab_density)
      ? (lang.scenario_emotional_vocab_density as number)
      : null;
  const scenarioEvDensity =
    storedScenarioEv ?? scenarioEmotionalVocabDensityPercentFromTranscript(txArr);
  const egoFromRow = extractEgoDevelopmentLevel({ ego_development_level: input.ego_development_level });
  const agg = aggregatePillarScoresWithCommitmentMergeDetailed(slices, {
    egoDevelopmentLevel: egoFromRow,
    defensePatternTranscript: txArr,
    disclosureCalibrationTranscript: txArr as Array<{ role?: string; content?: string; interviewMoment?: number }>,
    scenarioEmotionalVocabDensityPercent: scenarioEvDensity,
    /** Live completion aggregate used null here; stored communication-style density is gate-only context. */
    communicationStyleEmotionalVocabDensityPercent: null,
  });
  const { scores: pillar_scores, mentalizingOvercertaintyCount, defensePatterns } = agg;

  const scenarioPillarScoresByScenario: NonNullable<ComputeGateResultOptions['scenarioPillarScoresByScenario']> = {
    1: s1?.pillarScores,
    2: s2?.pillarScores,
    3: s3?.pillarScores,
  };

  const skipCountRaw = input.skip_count;
  const skipCount =
    typeof skipCountRaw === 'number' && Number.isFinite(skipCountRaw)
      ? skipCountRaw
      : typeof skipCountRaw === 'string' && skipCountRaw.trim() !== ''
        ? Number.parseInt(skipCountRaw, 10)
        : 0;
  const skipGate = usePersistedGateContext
    ? {
        skipPenaltyTotal:
          typeof input.skip_penalty_total === 'number' && Number.isFinite(input.skip_penalty_total)
            ? input.skip_penalty_total
            : computeSkipPenaltyGateComputation(Number.isFinite(skipCount) ? skipCount : 0).skipPenaltyTotal,
        skipAutoFail: input.auto_failed === true,
      }
    : computeSkipPenaltyGateComputation(Number.isFinite(skipCount) ? skipCount : 0);

  const personalWordCounts = personalMomentWordCountsForDisclosure(slices, txArr);
  const egoForGate = agg.egoDevelopmentLevel ?? extractEgoDevelopmentLevel(input);
  const gateDefensePatterns =
    usePersistedGateContext && input.defense_patterns != null && typeof input.defense_patterns === 'object'
      ? (input.defense_patterns as DefensePatternsJson)
      : defensePatterns;
  const gateDisclosureCalibration =
    usePersistedGateContext && typeof input.disclosure_calibration === 'string'
      ? input.disclosure_calibration
      : agg.disclosureCalibration;
  const gateMoment4Concreteness =
    usePersistedGateContext && typeof input.moment_4_concreteness === 'string'
      ? normalizeMoment4Concreteness(input.moment_4_concreteness)
      : agg.moment4Concreteness;
  const gateMoment5Concreteness =
    usePersistedGateContext && typeof input.moment_5_concreteness === 'string'
      ? normalizeResponseConcreteness(input.moment_5_concreteness)
      : agg.moment5Concreteness;
  const gateMentalizingOvercertainty =
    usePersistedGateContext &&
    typeof input.mentalizing_overcertainty_count === 'number' &&
    Number.isFinite(input.mentalizing_overcertainty_count)
      ? input.mentalizing_overcertainty_count
      : agg.mentalizingOvercertaintyCount;
  const gatePersonalEvDensity =
    usePersistedGateContext &&
    typeof input.personal_moment_emotional_vocab_density === 'number' &&
    Number.isFinite(input.personal_moment_emotional_vocab_density)
      ? input.personal_moment_emotional_vocab_density
      : agg.personal_moment_emotional_vocab_density;
  const gatePersonalEvLow =
    usePersistedGateContext && input.personal_moment_emotional_vocab_low != null
      ? input.personal_moment_emotional_vocab_low === true
      : agg.personal_moment_emotional_vocab_low;

  const gate = computeGateResultCore(pillar_scores, null, {
    scenarioPillarScoresByScenario,
    skipPenaltyTotal: skipGate.skipPenaltyTotal,
    skipAutoFail: skipGate.skipAutoFail,
    egoDevelopmentLevel: egoForGate,
    defensePatterns: gateDefensePatterns,
    moment4Concreteness: gateMoment4Concreteness,
    moment5Concreteness: gateMoment5Concreteness,
    disclosureCalibration: gateDisclosureCalibration,
    mentalizingOvercertaintyCount: gateMentalizingOvercertainty,
    moment4WordCount: personalWordCounts.moment4WordCount,
    moment5WordCount: personalWordCounts.moment5WordCount,
    personalMomentEmotionalVocabDensity: gatePersonalEvDensity,
    personalMomentEmotionalVocabLow: gatePersonalEvLow,
    ...(usePersistedGateContext &&
    typeof input.persisted_weighted_score === 'number' &&
    Number.isFinite(input.persisted_weighted_score)
      ? { precomputedWeightedScore: input.persisted_weighted_score }
      : {}),
  });

  const notes: string[] = [`rollup_algorithm:${PILLAR_ROLLUP_ALGORITHM_VERSION}`, ...buildGateNotes(gate)];
  if (notes.length === 1) notes.push('gate: pass — all current rubric checks satisfied');

  return {
    kind: 'success',
    pillar_scores,
    gate,
    notes,
    scenarioCompositesJson: scenarioCompositesToStorageJson(gate.scenarioComposites),
    mentalizingOvercertaintyCount,
    defense_patterns: defensePatterns,
    disclosure_calibration: agg.disclosureCalibration,
    personal_moment_emotional_vocab_density: agg.personal_moment_emotional_vocab_density,
    personal_moment_emotional_vocab_low: agg.personal_moment_emotional_vocab_low,
    moment_4_concreteness: agg.moment4Concreteness,
    moment_5_concreteness: agg.moment5Concreteness,
    ego_development_level: egoForGate,
  };
}

/** Per-pillar deltas (new minus old), only where both exist; omit zeros to keep payload small. */
export function computePillarScoreDelta(
  oldMap: Record<string, number | null | undefined>,
  newMap: Record<string, number | null | undefined>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of INTERVIEW_MARKER_IDS) {
    const o = oldMap[id];
    const n = newMap[id];
    if (typeof o === 'number' && Number.isFinite(o) && typeof n === 'number' && Number.isFinite(n)) {
      const d = Math.round((n - o) * 10) / 10;
      if (d !== 0) out[id] = d;
    }
  }
  return out;
}

export function snapshotAttemptScoresForAudit(row: {
  pillar_scores?: unknown;
  weighted_score?: unknown;
  passed?: unknown;
  gate_fail_reasons?: unknown;
  gate_fail_detail?: unknown;
  scenario_composites?: unknown;
  incomplete_reason?: unknown;
  ego_development_level?: unknown;
  review_flags?: unknown;
  mentalizing_overcertainty_count?: unknown;
  defense_patterns?: unknown;
  depth_signal_modifier?: unknown;
  score_modifier?: unknown;
  modified_weighted_score?: unknown;
  disclosure_calibration?: unknown;
}): Record<string, unknown> {
  return {
    pillar_scores: row.pillar_scores ?? null,
    weighted_score: row.weighted_score ?? null,
    passed: row.passed ?? null,
    gate_fail_reasons: row.gate_fail_reasons ?? null,
    gate_fail_detail: row.gate_fail_detail ?? null,
    scenario_composites: row.scenario_composites ?? null,
    incomplete_reason: row.incomplete_reason ?? null,
    ego_development_level: row.ego_development_level ?? null,
    review_flags: row.review_flags ?? null,
    mentalizing_overcertainty_count: row.mentalizing_overcertainty_count ?? null,
    defense_patterns: row.defense_patterns ?? null,
    depth_signal_modifier: row.depth_signal_modifier ?? null,
    score_modifier: row.score_modifier ?? null,
    modified_weighted_score: row.modified_weighted_score ?? null,
    disclosure_calibration: row.disclosure_calibration ?? null,
    captured_at: new Date().toISOString(),
  };
}
