import type { SupabaseClient } from '@supabase/supabase-js';

import {
  aggregatePillarScoresWithCommitmentMergeDetailed,
  disclosureCalibrationFromMarkerSlices,
  extractEgoDevelopmentLevel,
  personalMomentWordCountsForDisclosure,
  type MarkerScoreSlice,
} from '@features/aria/aggregateMarkerScoresFromSlices';
import type { AlphaPersonalMomentAggregate } from '@features/aria/alphaModeCompletionScenarioPrep';
import {
  computeGateResult,
  computeInterviewWeightedCompositeFromPillars,
  type GateResult,
} from '@features/aria/computeGateResult';
import {
  DEFAULT_DEFENSE_PATTERNS,
  type DefensePatternsJson,
} from '@features/aria/defensePatternsDetection';
import {
  buildIncompleteInterviewGateResult,
  type InterviewCompletionGateResult,
} from '@features/aria/interviewCompletionGate';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { resolveMoment5ClientScoringMeta } from '@features/aria/moment5ClientScoringMetaUtils';
import { aggregatePersonalMomentEmotionalVocab } from '@features/aria/personalMomentEmotionalVocab';
import type { ResponseConcretenessLevel } from '@features/aria/personalMomentConcreteness';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import type { AttemptScoringBaseline } from '@utilities/persistPersonalMomentScoresIncremental';
import {
  persistHolisticModifiersImmediate,
  persistMoment5ScoresImmediate,
} from '@utilities/persistPersonalMomentScoresIncremental';

export type AlphaGateAggregateResult = {
  finalGateResult: GateResult;
  pillarScores: Record<string, number>;
  pillarContributorCounts: Record<string, number>;
  egoLevelForAttempt: number | null;
  weightedScoreForAttempt: number | null;
  disclosureCalibrationForAttempt: 'underdisclosure' | 'calibrated' | 'overdisclosure';
  defensePatternsForAttempt: DefensePatternsJson;
  moment4ConcretenessForAttempt: ResponseConcretenessLevel | null;
  moment5ConcretenessForAttempt: ResponseConcretenessLevel | null;
  personalMomentEmotionalVocabDensityForAttempt: number | null;
  personalMomentEmotionalVocabLowForAttempt: boolean;
  mentalizingOvercertaintyCountForAttempt: number;
  scoringBaseline: AttemptScoringBaseline;
};

export async function computeAlphaModeGateAndPillars(params: {
  deps: ScoreInterviewDeps;
  supabase: SupabaseClient;
  finalMessages: MessageWithScenario[];
  parsed: InterviewResults;
  weightedMin: number;
  gateBlockedAlpha: boolean;
  completionGateAlpha: InterviewCompletionGateResult;
  moment4ForAggregate: AlphaPersonalMomentAggregate;
  moment5ForAggregate: AlphaPersonalMomentAggregate;
  markerSlicesForAggregate: MarkerScoreSlice[];
  languageMarkers: { scenario_emotional_vocab_density: number | null };
  skipOptsAlpha: ReturnType<
    typeof import('@features/aria/interviewSessionUtilities').attachSkipPenaltyGateOptions
  >;
  alphaAttemptIdForIncremental: string | null;
  scoringBaseline: AttemptScoringBaseline;
  mentalizingOvercertaintyCountForAttempt: number;
  emotionRawScoreForGate: () => number | null;
  emotionResponsesForGate: () => string[];
}): Promise<AlphaGateAggregateResult> {
  const {
    deps,
    supabase,
    finalMessages,
    parsed,
    weightedMin,
    gateBlockedAlpha,
    completionGateAlpha,
    moment4ForAggregate,
    moment5ForAggregate,
    markerSlicesForAggregate,
    languageMarkers,
    skipOptsAlpha,
    alphaAttemptIdForIncremental,
    scoringBaseline: initialBaseline,
    mentalizingOvercertaintyCountForAttempt: initialMentalizingCount,
    emotionRawScoreForGate,
    emotionResponsesForGate,
  } = params;

  const parsedPillarScores = parsed.pillarScores ?? {};
  let scoringBaseline = initialBaseline;
  let mentalizingOvercertaintyCountForAttempt = initialMentalizingCount;
  let defensePatternsForAttempt: DefensePatternsJson = { ...DEFAULT_DEFENSE_PATTERNS };
  let moment4ConcretenessForAttempt: ResponseConcretenessLevel | null = null;
  let moment5ConcretenessForAttempt: ResponseConcretenessLevel | null = null;
  let personalMomentEmotionalVocabDensityForAttempt: number | null = null;
  let personalMomentEmotionalVocabLowForAttempt = false;
  let disclosureCalibrationForAttempt: 'underdisclosure' | 'calibrated' | 'overdisclosure' = 'calibrated';
  let egoLevelForAttempt: number | null = null;
  let weightedScoreForAttempt: number | null = null;
  let finalGateResult: GateResult;
  let pillarScores: Record<string, number>;
  let pillarContributorCounts: Record<string, number>;

  if (!gateBlockedAlpha) {
    const mergedPillar = aggregatePillarScoresWithCommitmentMergeDetailed(markerSlicesForAggregate, {
      egoDevelopmentLevel: extractEgoDevelopmentLevel(parsed),
      defensePatternTranscript: finalMessages,
      disclosureCalibrationTranscript: finalMessages,
      scenarioEmotionalVocabDensityPercent: languageMarkers.scenario_emotional_vocab_density,
      communicationStyleEmotionalVocabDensityPercent: null,
    });
    defensePatternsForAttempt = mergedPillar.defensePatterns;
    moment4ConcretenessForAttempt = mergedPillar.moment4Concreteness ?? null;
    moment5ConcretenessForAttempt = mergedPillar.moment5Concreteness ?? null;
    personalMomentEmotionalVocabDensityForAttempt = mergedPillar.personal_moment_emotional_vocab_density;
    personalMomentEmotionalVocabLowForAttempt = mergedPillar.personal_moment_emotional_vocab_low;
    disclosureCalibrationForAttempt = mergedPillar.disclosureCalibration;
    const aggregatedPillarScores = mergedPillar.scores;
    egoLevelForAttempt = mergedPillar.egoDevelopmentLevel ?? extractEgoDevelopmentLevel(parsed) ?? null;
    mentalizingOvercertaintyCountForAttempt = mergedPillar.mentalizingOvercertaintyCount;
    if (alphaAttemptIdForIncremental && deps.userId) {
      scoringBaseline = await persistHolisticModifiersImmediate(
        supabase,
        alphaAttemptIdForIncremental,
        deps.userId,
        {
          egoDevelopmentLevel: egoLevelForAttempt,
          mentalizingOvercertaintyCount: mentalizingOvercertaintyCountForAttempt,
          defensePatterns: defensePatternsForAttempt as Record<string, unknown>,
        },
        scoringBaseline,
      );
      if (moment5ForAggregate) {
        scoringBaseline = await persistMoment5ScoresImmediate(
          supabase,
          alphaAttemptIdForIncremental,
          deps.userId,
          moment5ForAggregate,
          scoringBaseline,
          resolveMoment5ClientScoringMeta(deps.moment5ClientScoringMetaRef, deps.moment5AccountabilityProbeFiredRef) as Record<
            string,
            unknown
          >,
          {
            personal_moment_emotional_vocab_low: personalMomentEmotionalVocabLowForAttempt,
            personal_moment_emotional_vocab_density: personalMomentEmotionalVocabDensityForAttempt,
            disclosure_calibration: disclosureCalibrationForAttempt,
            probe_log: [...deps.probeLogRef.current],
          },
        );
      }
    }
    pillarContributorCounts = mergedPillar.contributorCounts;
    pillarScores =
      Object.keys(aggregatedPillarScores).length > 0
        ? { ...aggregatedPillarScores }
        : { ...(parsedPillarScores as Record<string, number>) };
    const scoreForGateAlpha = computeInterviewWeightedCompositeFromPillars(
      pillarScores,
      parsed.skepticismModifier ?? null,
      skipOptsAlpha.skipPenaltyTotal,
      skipOptsAlpha.skipAutoFail,
    );
    weightedScoreForAttempt =
      typeof scoreForGateAlpha === 'number' && Number.isFinite(scoreForGateAlpha) ? scoreForGateAlpha : null;
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[ModifierBase] score being passed to gate:', scoreForGateAlpha);
      console.log('[ModifierInputs] before gate call:', {
        egoDevelopmentLevel: egoLevelForAttempt,
        defensePatterns: defensePatternsForAttempt,
        moment4Concreteness: moment4ConcretenessForAttempt,
        moment5Concreteness: moment5ConcretenessForAttempt,
      });
      console.log(
        '[ConcretenessModifier] passing to gate — m4:',
        moment4ConcretenessForAttempt,
        'm5:',
        moment5ConcretenessForAttempt,
      );
      console.log('[BaseScore] weightedScoreForAttempt at call site:', weightedScoreForAttempt);
      console.log('[BaseScore] passing precomputedWeightedScore:', weightedScoreForAttempt);
      console.log('[Gate call] options:', {
        precomputedWeightedScore: scoreForGateAlpha,
        egoDevelopmentLevel: egoLevelForAttempt,
        defensePatterns: defensePatternsForAttempt,
        moment4Concreteness: moment4ConcretenessForAttempt,
        moment5Concreteness: moment5ConcretenessForAttempt,
        emotionRecognitionRawScore: emotionRawScoreForGate(),
        emotionRecognitionResponses: emotionResponsesForGate(),
        mentalizingOvercertaintyCount: mentalizingOvercertaintyCountForAttempt ?? 0,
      });
    }
    const personalWordCountsForGate = personalMomentWordCountsForDisclosure(
      markerSlicesForAggregate,
      finalMessages,
    );
    finalGateResult = computeGateResult(pillarScores, parsed.skepticismModifier ?? null, {
      weightedPassMin: weightedMin,
      scenarioPillarScoresByScenario: {
        1: deps.scenarioScoresRef.current[1]?.pillarScores,
        2: deps.scenarioScoresRef.current[2]?.pillarScores,
        3: deps.scenarioScoresRef.current[3]?.pillarScores,
      },
      skipPenaltyTotal: skipOptsAlpha.skipPenaltyTotal,
      skipAutoFail: skipOptsAlpha.skipAutoFail,
      egoDevelopmentLevel: egoLevelForAttempt,
      defensePatterns: mergedPillar.defensePatterns,
      moment4Concreteness: moment4ConcretenessForAttempt,
      moment5Concreteness: moment5ConcretenessForAttempt,
      mentalizingOvercertaintyCount: mentalizingOvercertaintyCountForAttempt ?? 0,
      disclosureCalibration: mergedPillar.disclosureCalibration,
      moment4WordCount: personalWordCountsForGate.moment4WordCount,
      moment5WordCount: personalWordCountsForGate.moment5WordCount,
      personalMomentEmotionalVocabDensity: personalMomentEmotionalVocabDensityForAttempt,
      personalMomentEmotionalVocabLow: personalMomentEmotionalVocabLowForAttempt,
      moment4AccountabilitySituationallyExempt: mergedPillar.moment4AccountabilitySituationallyExempt === true,
      moment4AccountabilityExemptReason: mergedPillar.moment4AccountabilityExemptReason ?? null,
      emotionRecognitionRawScore: emotionRawScoreForGate(),
      emotionRecognitionResponses: emotionResponsesForGate(),
      ...(typeof scoreForGateAlpha === 'number' && Number.isFinite(scoreForGateAlpha)
        ? { precomputedWeightedScore: scoreForGateAlpha }
        : {}),
    });
    if (
      typeof finalGateResult.weightedScore === 'number' &&
      Number.isFinite(finalGateResult.weightedScore)
    ) {
      weightedScoreForAttempt = finalGateResult.weightedScore;
    }
  } else {
    pillarContributorCounts = {};
    pillarScores = {};
    finalGateResult = buildIncompleteInterviewGateResult(completionGateAlpha);
    const pevBlocked = aggregatePersonalMomentEmotionalVocab(moment4ForAggregate, moment5ForAggregate, {
      scenarioEmotionalVocabDensityPercent: languageMarkers.scenario_emotional_vocab_density,
      communicationStyleEmotionalVocabDensityPercent: null,
    });
    personalMomentEmotionalVocabDensityForAttempt = pevBlocked.personal_moment_emotional_vocab_density;
    personalMomentEmotionalVocabLowForAttempt = pevBlocked.personal_moment_emotional_vocab_low;
    disclosureCalibrationForAttempt = disclosureCalibrationFromMarkerSlices(
      markerSlicesForAggregate,
      finalMessages,
    );
  }

  return {
    finalGateResult,
    pillarScores,
    pillarContributorCounts,
    egoLevelForAttempt,
    weightedScoreForAttempt,
    disclosureCalibrationForAttempt,
    defensePatternsForAttempt,
    moment4ConcretenessForAttempt,
    moment5ConcretenessForAttempt,
    personalMomentEmotionalVocabDensityForAttempt,
    personalMomentEmotionalVocabLowForAttempt,
    mentalizingOvercertaintyCountForAttempt,
    scoringBaseline,
  };
}
