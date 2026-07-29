import type { SupabaseClient } from '@supabase/supabase-js';

import {
  aggregatePillarScoresWithCommitmentMergeDetailed,
  disclosureCalibrationFromMarkerSlices,
  extractEgoDevelopmentLevel,
  markerSliceFromStoredScenarioMoment,
} from '@features/aria/aggregateMarkerScoresFromSlices';
import type { MarkerScoreSlice } from '@features/aria/aggregateMarkerScoresFromSlices';
import { attachSkipPenaltyGateOptions } from '@features/aria/interviewSessionUtilities';
import {
  computeGateResult,
  computeInterviewWeightedCompositeFromPillars,
} from '@features/aria/computeGateResult';
import type { GateResult } from '@features/aria/computeGateResult';
import {
  detectDefensePatterns,
  defensePatternScoreSliceFromMarkerSlice,
  normalizeDefensePatternsForPersist,
} from '@features/aria/defensePatternsDetection';
import {
  buildIncompleteInterviewGateResult,
  evaluateInterviewCompletionGate,
} from '@features/aria/interviewCompletionGate';
import type { InterviewCompletionGateResult } from '@features/aria/interviewCompletionGate';
import {
  EMPTY_HOLISTIC_RESULT,
  type ComputeHolisticClientScoringParams,
  type HolisticClientScoringState,
} from '@features/aria/holisticClientFallbackTypes';
import { countMentalizingOvercertaintyInMarkerSlices } from '@features/aria/mentalizingOvercertaintyFromTranscript';
import {
  mergeMoment4ConcretenessForGate,
  mergeMomentConcretenessForGate,
  type Moment4ConcretenessLevel,
} from '@features/aria/personalMomentConcreteness';
import { resolveMoment4UserTextForGate } from '@features/aria/personalMomentSliceEnrichment';
import type { ResponseConcretenessLevel } from '@features/aria/personalMomentConcreteness';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { resolveWeightedPassMinAfterReferralEffects } from '@features/referrals/referralInterview';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import { withRetry } from '@utilities/withRetry';
export async function computeHolisticClientScoring(
  params: ComputeHolisticClientScoringParams,
): Promise<HolisticClientScoringState> {
  const {
    deps,
    supabase,
    finalMessages,
    standardDeferredHolisticCache,
    fetchHolisticOnceBound,
    emotionRawScoreForGate,
    emotionResponsesForGate,
    hydrateScenarioScoresFromAttemptIfNeeded,
  } = params;
  const msgs = finalMessages as MessageWithScenario[];

  let holisticParsed: InterviewResults | null = standardDeferredHolisticCache;
  if (!holisticParsed) {
    try {
      holisticParsed = await withRetry(fetchHolisticOnceBound, {
        retries: 3,
        baseDelay: 12000,
        maxDelay: 45000,
        context: 'scoring',
        sessionLog: deps.userId
          ? {
              userId: deps.userId,
              attemptId: getSessionLogRuntime().attemptId,
              platform: getSessionLogRuntime().platform,
            }
          : undefined,
      });
    } catch (holisticErr) {
      await remoteLog('[WARN] holistic interview scoring fetch failed; continuing with per-scenario pillars', {
        message: holisticErr instanceof Error ? holisticErr.message : String(holisticErr),
      });
    }
  }
  await hydrateScenarioScoresFromAttemptIfNeeded();

  let holisticStoredPatterns: Record<string, unknown> | null = null;
  let moment4FromAttemptRow: unknown = null;
  let moment4ConcretenessHolisticGate: Moment4ConcretenessLevel | null = null;
  let moment5ConcretenessHolisticGate: ResponseConcretenessLevel | null = null;
  let completionGateHolistic: InterviewCompletionGateResult | null = null;

  if (deps.userId && deps.interviewSessionAttemptIdRef.current) {
    const { data: attRowHolistic } = await supabase
      .from('interview_attempts')
      .select('scenario_specific_patterns, moment_4_concreteness, moment_5_concreteness')
      .eq('id', deps.interviewSessionAttemptIdRef.current)
      .maybeSingle();
    holisticStoredPatterns = (attRowHolistic?.scenario_specific_patterns as Record<string, unknown>) ?? null;
    moment4FromAttemptRow = holisticStoredPatterns?.moment_4_scores ?? null;
    const m4StoredHolistic = holisticStoredPatterns?.moment_4_scores;
    const m5StoredHolistic = holisticStoredPatterns?.moment_5_scores;
    moment4ConcretenessHolisticGate = mergeMoment4ConcretenessForGate(
      m4StoredHolistic,
      (attRowHolistic as Record<string, unknown> | null | undefined)?.moment_4_concreteness,
      resolveMoment4UserTextForGate(finalMessages),
    );
    moment5ConcretenessHolisticGate = mergeMomentConcretenessForGate(
      m5StoredHolistic,
      (attRowHolistic as Record<string, unknown> | null | undefined)?.moment_5_concreteness,
    );
  }

  if (deps.userId) {
    completionGateHolistic = evaluateInterviewCompletionGate({
      scenario1: deps.scenarioScoresRef.current[1],
      scenario2: deps.scenarioScoresRef.current[2],
      scenario3: deps.scenarioScoresRef.current[3],
      moment4: moment4FromAttemptRow,
      moment5: holisticStoredPatterns?.moment_5_scores,
      transcript: finalMessages,
    });
    if (!completionGateHolistic.ok) {
      await remoteLog('[COMPLETION_GATE_FAIL]', {
        path: 'client_holistic_prereq',
        incomplete_reason: completionGateHolistic.incomplete_reason,
        missingScenarioNumbers: completionGateHolistic.missingScenarioNumbers,
        missingMoment4: completionGateHolistic.missingMoment4,
        missingMoment5: completionGateHolistic.missingMoment5,
        detail: completionGateHolistic.detail,
        why: 'Holistic path: scoring continues; incomplete_reason may be stored on attempt',
      });
    }
  }

  let parsed: InterviewResults = holisticParsed ?? EMPTY_HOLISTIC_RESULT;
  const weightedMin = await resolveWeightedPassMinAfterReferralEffects(deps.userId);
  const gateBlockedHolistic = false;

  const m4HolisticSlEarly = markerSliceFromStoredScenarioMoment(holisticStoredPatterns?.moment_4_scores);
  const m5HolisticSlEarly = markerSliceFromStoredScenarioMoment(holisticStoredPatterns?.moment_5_scores);
  const scenarioDefenseSlice = (n: 1 | 2 | 3) => {
    const s = deps.scenarioScoresRef.current[n];
    return s?.pillarScores
      ? { pillarScores: s.pillarScores, keyEvidence: s.keyEvidence }
      : null;
  };
  const holisticDefensePatterns = normalizeDefensePatternsForPersist(
    detectDefensePatterns(
      [
        scenarioDefenseSlice(1),
        scenarioDefenseSlice(2),
        scenarioDefenseSlice(3),
      ],
      defensePatternScoreSliceFromMarkerSlice(m4HolisticSlEarly),
      defensePatternScoreSliceFromMarkerSlice(m5HolisticSlEarly),
      msgs,
    ),
  );

  if (
    !gateBlockedHolistic &&
    deps.scenarioScoresRef.current[1]?.pillarScores &&
    deps.scenarioScoresRef.current[2]?.pillarScores &&
    deps.scenarioScoresRef.current[3]?.pillarScores
  ) {
    const m4RollupSl = markerSliceFromStoredScenarioMoment(holisticStoredPatterns?.moment_4_scores);
    const m5RollupSl = markerSliceFromStoredScenarioMoment(holisticStoredPatterns?.moment_5_scores);
    const markerSlicesForPillars: MarkerScoreSlice[] = [
      {
        pillarScores: deps.scenarioScoresRef.current[1]!.pillarScores,
        keyEvidence: deps.scenarioScoresRef.current[1]!.keyEvidence,
        mentalizing_overcertainty: deps.scenarioScoresRef.current[1]!.mentalizing_overcertainty === true,
      },
      {
        pillarScores: deps.scenarioScoresRef.current[2]!.pillarScores,
        keyEvidence: deps.scenarioScoresRef.current[2]!.keyEvidence,
        mentalizing_overcertainty: deps.scenarioScoresRef.current[2]!.mentalizing_overcertainty === true,
      },
      {
        pillarScores: deps.scenarioScoresRef.current[3]!.pillarScores,
        keyEvidence: deps.scenarioScoresRef.current[3]!.keyEvidence,
        mentalizing_overcertainty: deps.scenarioScoresRef.current[3]!.mentalizing_overcertainty === true,
      },
      m4RollupSl,
      m5RollupSl,
    ];
    const mergedPillars = aggregatePillarScoresWithCommitmentMergeDetailed(markerSlicesForPillars, {
      egoDevelopmentLevel: extractEgoDevelopmentLevel(parsed),
      defensePatternTranscript: msgs,
      disclosureCalibrationTranscript: msgs,
    });
    if (Object.keys(mergedPillars.scores).length > 0) {
      parsed = { ...parsed, pillarScores: mergedPillars.scores };
    }
  }

  const m4HolisticSl = markerSliceFromStoredScenarioMoment(holisticStoredPatterns?.moment_4_scores);
  const m5HolisticSl = markerSliceFromStoredScenarioMoment(holisticStoredPatterns?.moment_5_scores);
  const markerSlicesHolisticForDisclosure: MarkerScoreSlice[] = [
    deps.scenarioScoresRef.current[1]
      ? {
          pillarScores: deps.scenarioScoresRef.current[1]!.pillarScores,
          keyEvidence: deps.scenarioScoresRef.current[1]!.keyEvidence,
          mentalizing_overcertainty: deps.scenarioScoresRef.current[1]!.mentalizing_overcertainty === true,
        }
      : null,
    deps.scenarioScoresRef.current[2]
      ? {
          pillarScores: deps.scenarioScoresRef.current[2]!.pillarScores,
          keyEvidence: deps.scenarioScoresRef.current[2]!.keyEvidence,
          mentalizing_overcertainty: deps.scenarioScoresRef.current[2]!.mentalizing_overcertainty === true,
        }
      : null,
    deps.scenarioScoresRef.current[3]
      ? {
          pillarScores: deps.scenarioScoresRef.current[3]!.pillarScores,
          keyEvidence: deps.scenarioScoresRef.current[3]!.keyEvidence,
          mentalizing_overcertainty: deps.scenarioScoresRef.current[3]!.mentalizing_overcertainty === true,
        }
      : null,
    m4HolisticSl,
    m5HolisticSl,
  ];
  const holisticDisclosureCalibration = disclosureCalibrationFromMarkerSlices(
    markerSlicesHolisticForDisclosure,
    msgs,
  );
  console.log('[Disclosure] holistic disclosure_calibration:', holisticDisclosureCalibration);

  const skipOptsHolistic = attachSkipPenaltyGateOptions(deps.scenarioSkipConfirmedCountRef.current);
  parsed.skipBreakdown = skipOptsHolistic.skipBreakdown;

  const mentalizingMarkerSlicesHolistic: Array<MarkerScoreSlice | null> = [
    deps.scenarioScoresRef.current[1]
      ? {
          pillarScores: deps.scenarioScoresRef.current[1]!.pillarScores,
          keyEvidence: deps.scenarioScoresRef.current[1]!.keyEvidence,
          mentalizing_overcertainty: deps.scenarioScoresRef.current[1]!.mentalizing_overcertainty === true,
        }
      : null,
    deps.scenarioScoresRef.current[2]
      ? {
          pillarScores: deps.scenarioScoresRef.current[2]!.pillarScores,
          keyEvidence: deps.scenarioScoresRef.current[2]!.keyEvidence,
          mentalizing_overcertainty: deps.scenarioScoresRef.current[2]!.mentalizing_overcertainty === true,
        }
      : null,
    deps.scenarioScoresRef.current[3]
      ? {
          pillarScores: deps.scenarioScoresRef.current[3]!.pillarScores,
          keyEvidence: deps.scenarioScoresRef.current[3]!.keyEvidence,
          mentalizing_overcertainty: deps.scenarioScoresRef.current[3]!.mentalizing_overcertainty === true,
        }
      : null,
    null,
    null,
  ];
  const mentalizingOvercertaintyCountHolistic = countMentalizingOvercertaintyInMarkerSlices(
    mentalizingMarkerSlicesHolistic,
    msgs,
  );

  let holisticWeightedScoreForPersist: number | null = null;

  let gateResult: GateResult;
  if (gateBlockedHolistic && completionGateHolistic && !completionGateHolistic.ok) {
    gateResult = buildIncompleteInterviewGateResult(completionGateHolistic);
    parsed.pillarScores = parsed.pillarScores ?? {};
  } else {
    const scoreForGateHolistic = computeInterviewWeightedCompositeFromPillars(
      parsed.pillarScores ?? {},
      parsed.skepticismModifier ?? null,
      skipOptsHolistic.skipPenaltyTotal,
      skipOptsHolistic.skipAutoFail,
    );
    holisticWeightedScoreForPersist =
      typeof scoreForGateHolistic === 'number' && Number.isFinite(scoreForGateHolistic)
        ? scoreForGateHolistic
        : null;
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[ModifierBase] score being passed to gate:', scoreForGateHolistic);
      console.log('[ModifierInputs] before gate call:', {
        egoDevelopmentLevel: extractEgoDevelopmentLevel(parsed),
        defensePatterns: holisticDefensePatterns,
        moment4Concreteness: moment4ConcretenessHolisticGate,
        moment5Concreteness: moment5ConcretenessHolisticGate,
      });
      console.log(
        '[ConcretenessModifier] passing to gate — m4:',
        moment4ConcretenessHolisticGate ?? null,
        'm5:',
        moment5ConcretenessHolisticGate ?? null,
      );
      console.log(
        '[BaseScore] passing precomputedWeightedScore:',
        holisticWeightedScoreForPersist ?? scoreForGateHolistic,
      );
      console.log('[Gate call] options:', {
        precomputedWeightedScore: scoreForGateHolistic,
        egoDevelopmentLevel: extractEgoDevelopmentLevel(parsed),
        defensePatterns: holisticDefensePatterns,
        moment4Concreteness: moment4ConcretenessHolisticGate ?? null,
        moment5Concreteness: moment5ConcretenessHolisticGate ?? null,
        emotionRecognitionRawScore: emotionRawScoreForGate(),
        emotionRecognitionResponses: emotionResponsesForGate(),
        mentalizingOvercertaintyCount: mentalizingOvercertaintyCountHolistic ?? 0,
      });
    }
    gateResult = computeGateResult(parsed.pillarScores ?? {}, parsed.skepticismModifier ?? null, {
      weightedPassMin: weightedMin,
      scenarioPillarScoresByScenario: {
        1: deps.scenarioScoresRef.current[1]?.pillarScores,
        2: deps.scenarioScoresRef.current[2]?.pillarScores,
        3: deps.scenarioScoresRef.current[3]?.pillarScores,
      },
      skipPenaltyTotal: skipOptsHolistic.skipPenaltyTotal,
      skipAutoFail: skipOptsHolistic.skipAutoFail,
      egoDevelopmentLevel: extractEgoDevelopmentLevel(parsed),
      defensePatterns: holisticDefensePatterns,
      moment4Concreteness: moment4ConcretenessHolisticGate ?? null,
      moment5Concreteness: moment5ConcretenessHolisticGate ?? null,
      disclosureCalibration: holisticDisclosureCalibration,
      mentalizingOvercertaintyCount: mentalizingOvercertaintyCountHolistic ?? 0,
      emotionRecognitionRawScore: emotionRawScoreForGate(),
      emotionRecognitionResponses: emotionResponsesForGate(),
      ...(typeof scoreForGateHolistic === 'number' && Number.isFinite(scoreForGateHolistic)
        ? { precomputedWeightedScore: scoreForGateHolistic }
        : {}),
    });
  }

  parsed.gateResult = gateResult;

  return {
    parsed,
    gateResult,
    holisticStoredPatterns,
    moment4ConcretenessHolisticGate,
    moment5ConcretenessHolisticGate,
    completionGateHolistic,
    holisticDisclosureCalibration,
    mentalizingOvercertaintyCountHolistic,
    holisticDefensePatterns,
    holisticWeightedScoreForPersist,
    weightedPassMin: weightedMin,
  };
}
