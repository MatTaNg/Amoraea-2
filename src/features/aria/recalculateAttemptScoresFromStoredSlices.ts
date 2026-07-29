import {
  isDefensePatternsShapeIncomplete,
  normalizeDefensePatternsForPersist,
} from './defensePatternsDetection';
import { PILLAR_ROLLUP_ALGORITHM_VERSION } from './aggregateMarkerScoresFromSlices';
import {
  aggregatePillarScoresWithCommitmentMergeDetailed,
  extractEgoDevelopmentLevel,
  type DefensePatternsJson,
  type MarkerScoreSlice,
} from './aggregateMarkerScoresFromSlices';
import { normalizeMoment4Concreteness, mergeMoment4ConcretenessForGate } from './moment4ConcretenessClassification';
import type { ComputeGateResultOptions } from './computeGateResultCore';
import { computeGateResultCore } from './computeGateResultCore';
import type { CompletionGateFailure } from './interviewCompletionGate';
import {
  buildIncompleteInterviewGateResult,
  evaluateInterviewCompletionGate,
} from './interviewCompletionGate';
import {
  sanitizeMoment5PersonalScoresForAggregate,
  sanitizePersonalMomentScoresForAggregate,
} from './personalMomentSliceSanitize';
import { buildScenarioPillarMapsFromStoredBundles, scenarioCompositesToStorageJson } from './scenarioCompositeFloor';
import { personalMomentWordCountsForDisclosure } from './aggregateMarkerScoresFromSlices';
import { computeSkipPenaltyGateComputation } from './interviewSkipPenalties';
import {
  countConfirmedScenarioSkipsFromTranscript,
  parseStoredScenarioSkipCount,
} from './scenarioSkipCountHydration';
import {
  emotionRecognitionCorrectCount,
  hydrateEmotionResponsesFromStorage,
  resolveEmotionRecognitionRawScoreForGate,
} from './emotionRecognitionInterview';
import {
  mergeMomentConcretenessForGate,
  normalizeResponseConcreteness,
} from './personalMomentConcreteness';
import { resolveMoment4UserTextForGate } from './personalMomentSliceEnrichment';
import type {
  AdminRecalculateAttemptInput,
  AdminRecalculateOptions,
  AdminRecalculateResult,
} from './adminRecalculateAttemptTypes';
import {
  buildGateNotes,
  extractSlice,
  parseObject,
  scenarioSliceFromStored,
  toReconcilableSlice,
  type TranscriptMsg,
} from './adminRecalculateAttemptSliceParsing';

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
    moment5: m5Raw,
    transcript: tx,
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
      missingMoment5: false,
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
          scoringMetadata:
            m4Raw != null &&
            typeof m4Raw === 'object' &&
            !Array.isArray(m4Raw) &&
            (m4Raw as Record<string, unknown>).scoringMetadata != null &&
            typeof (m4Raw as Record<string, unknown>).scoringMetadata === 'object' &&
            !Array.isArray((m4Raw as Record<string, unknown>).scoringMetadata)
              ? ((m4Raw as Record<string, unknown>).scoringMetadata as Record<string, unknown>)
              : null,
          user_slice_word_count: m4ForAgg.user_slice_word_count ?? undefined,
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
          user_slice_word_count: m5ForAgg.user_slice_word_count ?? undefined,
        }
      : null,
  ];
  const egoFromRow = extractEgoDevelopmentLevel({ ego_development_level: input.ego_development_level });
  const moment4UserTextForGate = resolveMoment4UserTextForGate(txArr);
  const agg = aggregatePillarScoresWithCommitmentMergeDetailed(slices, {
    egoDevelopmentLevel: egoFromRow,
    defensePatternTranscript: txArr,
    disclosureCalibrationTranscript: txArr as Array<{ role?: string; content?: string; interviewMoment?: number }>,
    moment4UserText: moment4UserTextForGate,
  });
  const { scores: pillar_scores, mentalizingOvercertaintyCount, defensePatterns } = agg;

  const scenarioPillarScoresByScenario = buildScenarioPillarMapsFromStoredBundles(
    input.scenario_1_scores,
    input.scenario_2_scores,
    input.scenario_3_scores,
  );

  const skipCountRaw = input.skip_count;
  const skipCountParsed =
    typeof skipCountRaw === 'number' && Number.isFinite(skipCountRaw)
      ? skipCountRaw
      : typeof skipCountRaw === 'string' && skipCountRaw.trim() !== ''
        ? Number.parseInt(skipCountRaw, 10)
        : NaN;
  const skipCountFromTranscript = countConfirmedScenarioSkipsFromTranscript(
    Array.isArray(input.transcript)
      ? (input.transcript as Array<{
          role: string;
          content?: string;
          scenarioNumber?: number;
          interviewMoment?: number;
        }>)
      : [],
  );
  const skipCount = Math.max(
    Number.isFinite(skipCountParsed) ? parseStoredScenarioSkipCount(skipCountParsed) : 0,
    skipCountFromTranscript,
  );
  const skipGate = (() => {
    if (usePersistedGateContext) {
      const persistedTotal =
        typeof input.skip_penalty_total === 'number' && Number.isFinite(input.skip_penalty_total)
          ? input.skip_penalty_total
          : null;
      const recomputed = computeSkipPenaltyGateComputation(skipCount);
      return {
        skipPenaltyTotal:
          persistedTotal != null && persistedTotal !== 0
            ? persistedTotal
            : recomputed.skipPenaltyTotal,
        skipAutoFail: input.auto_failed === true || recomputed.skipAutoFail,
      };
    }
    if (skipCount > 0) {
      const computed = computeSkipPenaltyGateComputation(skipCount);
      return { skipPenaltyTotal: computed.skipPenaltyTotal, skipAutoFail: computed.skipAutoFail };
    }
    if (typeof input.skip_penalty_total === 'number' && Number.isFinite(input.skip_penalty_total)) {
      return {
        skipPenaltyTotal: input.skip_penalty_total,
        skipAutoFail: input.auto_failed === true,
      };
    }
    return computeSkipPenaltyGateComputation(0);
  })();

  const personalWordCounts = personalMomentWordCountsForDisclosure(slices, txArr);
  const egoForGate = agg.egoDevelopmentLevel ?? extractEgoDevelopmentLevel(input);
  const gateDefensePatterns =
    usePersistedGateContext &&
    input.defense_patterns != null &&
    typeof input.defense_patterns === 'object' &&
    !isDefensePatternsShapeIncomplete(input.defense_patterns as Record<string, unknown>)
      ? normalizeDefensePatternsForPersist(input.defense_patterns as DefensePatternsJson)
      : normalizeDefensePatternsForPersist(defensePatterns);
  const gateDisclosureCalibration =
    usePersistedGateContext && typeof input.disclosure_calibration === 'string'
      ? input.disclosure_calibration
      : agg.disclosureCalibration;
  const gateMoment4Concreteness =
    mergeMoment4ConcretenessForGate(
      m4Raw,
      input.moment_4_concreteness,
      moment4UserTextForGate,
    ) ?? agg.moment4Concreteness;
  const gateMoment5Concreteness =
    usePersistedGateContext && typeof input.moment_5_concreteness === 'string'
      ? normalizeResponseConcreteness(input.moment_5_concreteness)
      : mergeMomentConcretenessForGate(m5Raw, input.moment_5_concreteness) ?? agg.moment5Concreteness;
  const gateMentalizingOvercertainty =
    usePersistedGateContext &&
    typeof input.mentalizing_overcertainty_count === 'number' &&
    Number.isFinite(input.mentalizing_overcertainty_count)
      ? input.mentalizing_overcertainty_count
      : agg.mentalizingOvercertaintyCount;
  const emotionResponses = hydrateEmotionResponsesFromStorage(input.emotion_recognition_responses);
  const emotionCorrectCount = emotionRecognitionCorrectCount(emotionResponses);
  const emotionRawScore = resolveEmotionRecognitionRawScoreForGate({
    emotionRecognitionRawScore: input.emotion_recognition_raw_score,
    emotionRecognitionCorrectCount: emotionCorrectCount,
    emotionRecognitionResponses: input.emotion_recognition_responses,
  });

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
    moment4AccountabilitySituationallyExempt: agg.moment4AccountabilitySituationallyExempt === true,
    moment4AccountabilityExemptReason: agg.moment4AccountabilityExemptReason ?? null,
    emotionRecognitionRawScore: emotionRawScore ?? undefined,
    emotionRecognitionCorrectCount: emotionCorrectCount ?? undefined,
    emotionRecognitionResponses: input.emotion_recognition_responses,
    closingIntegration: input.closing_integration ?? null,
    ...(usePersistedGateContext &&
    typeof input.persisted_weighted_score === 'number' &&
    Number.isFinite(input.persisted_weighted_score)
      ? { precomputedWeightedScore: input.persisted_weighted_score }
      : {}),
  });

  const notes: string[] = [`rollup_algorithm:${PILLAR_ROLLUP_ALGORITHM_VERSION}`, ...buildGateNotes(gate)];
  if (agg.accountabilityReweightMeta) {
    const rw = agg.accountabilityReweightMeta;
    notes.push(
      `accountability_reweight:m4_situational_exempt:${rw.scenarioOnlyAccountability ?? '—'}->${rw.reweightedAccountability} (${rw.reason})`,
    );
  }
  if (notes.length === 1) notes.push('gate: pass — all current rubric checks satisfied');

  return {
    kind: 'success',
    pillar_scores,
    gate,
    notes,
    scenarioCompositesJson: scenarioCompositesToStorageJson(gate.scenarioComposites),
    mentalizingOvercertaintyCount,
    defense_patterns: normalizeDefensePatternsForPersist(defensePatterns),
    disclosure_calibration: agg.disclosureCalibration,
    personal_moment_emotional_vocab_density: null,
    personal_moment_emotional_vocab_low: false,
    moment_4_concreteness: gateMoment4Concreteness,
    moment_5_concreteness: gateMoment5Concreteness,
    ego_development_level: egoForGate,
  };
}
