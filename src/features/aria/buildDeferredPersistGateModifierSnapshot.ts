import {
  aggregatePillarScoresWithCommitmentMergeDetailed,
} from '@features/aria/aggregateMarkerScoresFromSlices';
import type { MarkerScoreSlice } from '@features/aria/aggregateMarkerScoresFromSlices';
import { analyzeLanguageMarkers, buildScenarioBoundaries } from '@features/aria/alphaAssessmentUtils';
import { attachSkipPenaltyGateOptions } from '@features/aria/interviewSessionUtilities';
import {
  computeGateResult,
  computeInterviewWeightedCompositeFromPillars,
} from '@features/aria/computeGateResult';
import { normalizeResponseConcreteness } from '@features/aria/personalMomentConcreteness';
import { logWeightedModifierInvariant } from '@features/aria/scoreInterviewModuleConstants';
import { interviewModifierFieldsFromGateResult } from '@features/aria/interviewModifierPersist';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import type { scenarioBundleForDeferred } from '@features/aria/standardDeferredPersistGateTypes';
import {
  sanitizeMoment5PersonalScoresForAggregate,
  sanitizePersonalMomentScoresForAggregate,
} from '@features/aria/personalMomentSliceSanitize';
import { normalizeGateFailDetailForPersist } from '@features/psychometrics/gateFailDetailForPersist';
import { resolveWeightedPassMinAfterReferralEffects } from '@features/referrals/referralInterview';
import type { AttemptScoringBaseline } from '@utilities/persistPersonalMomentScoresIncremental';
import { remoteLog } from '@utilities/remoteLog';

type ScenarioBundle = NonNullable<ReturnType<typeof scenarioBundleForDeferred>>;

export type BuildDeferredPersistGateModifierSnapshotParams = {
  completionGateOk: boolean;
  bundle1: ScenarioBundle | null;
  bundle2: ScenarioBundle | null;
  bundle3: ScenarioBundle | null;
  moment4ForAggregate: ReturnType<typeof sanitizePersonalMomentScoresForAggregate> | null;
  moment5ForAggregate: ReturnType<typeof sanitizeMoment5PersonalScoresForAggregate> | null;
  msgsDeferred: import('@features/aria/interviewScenarioScoringSlice').MessageWithScenario[];
  deps: ScoreInterviewDeps;
  egoLevelForDeferredAggregate: number | null;
  scoringBaseline: AttemptScoringBaseline;
  emotionRawScoreForGate: () => number | null;
  emotionResponsesForGate: () => string[];
};

export async function buildDeferredPersistGateModifierSnapshot(
  params: BuildDeferredPersistGateModifierSnapshotParams,
): Promise<Record<string, unknown>> {
  const {
    completionGateOk,
    bundle1,
    bundle2,
    bundle3,
    moment4ForAggregate,
    moment5ForAggregate,
    msgsDeferred,
    deps,
    egoLevelForDeferredAggregate,
    scoringBaseline,
    emotionRawScoreForGate,
    emotionResponsesForGate,
  } = params;

  const weightedMinDeferred = await resolveWeightedPassMinAfterReferralEffects(deps.userId);
  const skipOptsDeferred = attachSkipPenaltyGateOptions(deps.scenarioSkipConfirmedCountRef.current);
  let deferredModifierPayload: Record<string, unknown> = {};
  if (!completionGateOk) {
    return deferredModifierPayload;
  }

  try {
    if (!bundle1?.pillarScores || !bundle2?.pillarScores || !bundle3?.pillarScores) {
      console.warn('[Modifier] deferred snapshot skipped — scenario pillar scores incomplete');
      return deferredModifierPayload;
    }
    const markerSlicesDeferredGate: MarkerScoreSlice[] = [
        bundle1
          ? {
              pillarScores: bundle1.pillarScores,
              keyEvidence: bundle1.keyEvidence,
              mentalizing_overcertainty: bundle1.mentalizing_overcertainty === true,
            }
          : null,
        bundle2
          ? {
              pillarScores: bundle2.pillarScores,
              keyEvidence: bundle2.keyEvidence,
              mentalizing_overcertainty: bundle2.mentalizing_overcertainty === true,
            }
          : null,
        bundle3
          ? {
              pillarScores: bundle3.pillarScores,
              keyEvidence: bundle3.keyEvidence,
              mentalizing_overcertainty: bundle3.mentalizing_overcertainty === true,
            }
          : null,
        moment4ForAggregate
          ? {
              pillarScores: moment4ForAggregate.pillarScores,
              keyEvidence: moment4ForAggregate.keyEvidence,
              mentalizing_overcertainty: moment4ForAggregate.mentalizing_overcertainty === true,
              response_concreteness: normalizeResponseConcreteness(moment4ForAggregate.response_concreteness),
            }
          : null,
        moment5ForAggregate
          ? {
              pillarScores: moment5ForAggregate.pillarScores,
              keyEvidence: moment5ForAggregate.keyEvidence,
              mentalizing_overcertainty: moment5ForAggregate.mentalizing_overcertainty === true,
              response_concreteness: normalizeResponseConcreteness(moment5ForAggregate.response_concreteness),
            }
          : null,
      ];
      const scenarioBoundariesDeferred = buildScenarioBoundaries(
        msgsDeferred,
        Array.from(deps.scoredScenariosRef.current),
      );
      const lmDeferred = analyzeLanguageMarkers(msgsDeferred, scenarioBoundariesDeferred);
      const mergedDeferredGate = aggregatePillarScoresWithCommitmentMergeDetailed(markerSlicesDeferredGate, {
        egoDevelopmentLevel: egoLevelForDeferredAggregate,
        defensePatternTranscript: msgsDeferred,
        disclosureCalibrationTranscript: msgsDeferred,
        scenarioEmotionalVocabDensityPercent: lmDeferred.scenario_emotional_vocab_density,
        communicationStyleEmotionalVocabDensityPercent: null,
      });
      const scoreForGateDeferred = computeInterviewWeightedCompositeFromPillars(
        mergedDeferredGate.scores,
        null,
        skipOptsDeferred.skipPenaltyTotal,
        skipOptsDeferred.skipAutoFail,
      );
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[ModifierBase] score being passed to gate (deferred):', scoreForGateDeferred);
      }
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[ModifierInputs] before gate call:', {
          egoDevelopmentLevel: mergedDeferredGate.egoDevelopmentLevel,
          defensePatterns: mergedDeferredGate.defensePatterns,
          moment4Concreteness: mergedDeferredGate.moment4Concreteness,
          moment5Concreteness: mergedDeferredGate.moment5Concreteness,
        });
      }
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log(
          '[ConcretenessModifier] passing to gate — m4:',
          mergedDeferredGate.moment4Concreteness ?? null,
          'm5:',
          mergedDeferredGate.moment5Concreteness ?? null,
        );
      }
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[BaseScore] passing precomputedWeightedScore:', scoreForGateDeferred);
      }
      const gateDeferredSnap = computeGateResult(mergedDeferredGate.scores, null, {
        weightedPassMin: weightedMinDeferred,
        scenarioPillarScoresByScenario: {
          1: bundle1.pillarScores,
          2: bundle2.pillarScores,
          3: bundle3.pillarScores,
        },
        skipPenaltyTotal: skipOptsDeferred.skipPenaltyTotal,
        skipAutoFail: skipOptsDeferred.skipAutoFail,
        egoDevelopmentLevel: mergedDeferredGate.egoDevelopmentLevel,
        defensePatterns: mergedDeferredGate.defensePatterns,
        moment4Concreteness: mergedDeferredGate.moment4Concreteness ?? null,
        moment5Concreteness: mergedDeferredGate.moment5Concreteness ?? null,
        mentalizingOvercertaintyCount: mergedDeferredGate.mentalizingOvercertaintyCount ?? 0,
        disclosureCalibration: mergedDeferredGate.disclosureCalibration,
        personalMomentEmotionalVocabLow: mergedDeferredGate.personal_moment_emotional_vocab_low ?? false,
        emotionRecognitionRawScore: emotionRawScoreForGate(),
        emotionRecognitionResponses: emotionResponsesForGate(),
        ...(typeof scoreForGateDeferred === 'number' && Number.isFinite(scoreForGateDeferred)
          ? { precomputedWeightedScore: scoreForGateDeferred }
          : {}),
      });
      logWeightedModifierInvariant('deferred_snapshot', gateDeferredSnap.weightedScore, gateDeferredSnap);
      const modifierFields = interviewModifierFieldsFromGateResult(gateDeferredSnap);
      deferredModifierPayload = {
        weighted_score: gateDeferredSnap.weightedScore,
        ...modifierFields,
        passed: gateDeferredSnap.pass,
        gate_fail_reasons: gateDeferredSnap.failReasonCodes ?? [],
        gate_fail_detail: normalizeGateFailDetailForPersist(gateDeferredSnap.failReasonDetail),
        review_flags: gateDeferredSnap.reviewFlags,
        ego_development_level:
          mergedDeferredGate.egoDevelopmentLevel ??
          egoLevelForDeferredAggregate ??
          scoringBaseline.ego_development_level,
      };
      console.log('[Modifier] persisting (deferred attempt row):', deferredModifierPayload);
  } catch (e) {
    const attemptId = deps.interviewSessionAttemptIdRef.current ?? 'pending';
    console.error(`[Modifier] deferred gate modifier snapshot failed for attempt ${attemptId}:`, e);
    void remoteLog('[STANDARD] deferred gate modifier snapshot failed', {
      attemptId,
      message: e instanceof Error ? e.message : String(e),
    });
  }
  return deferredModifierPayload;
}
