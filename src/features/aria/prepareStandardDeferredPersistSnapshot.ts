import {
  disclosureCalibrationFromMarkerSlices,
  extractEgoDevelopmentLevel,
} from '@features/aria/aggregateMarkerScoresFromSlices';
import type { MarkerScoreSlice } from '@features/aria/aggregateMarkerScoresFromSlices';
import { buildDeferredPersistGateModifierSnapshot } from '@features/aria/buildDeferredPersistGateModifierSnapshot';
import { buildDeferredPersistRowPayload } from '@features/aria/buildDeferredPersistRowPayload';
import { resolveMoment5ClientScoringMeta } from '@features/aria/moment5ClientScoringMetaUtils';
import {
  DEFAULT_DEFENSE_PATTERNS,
  detectDefensePatterns,
  normalizeDefensePatternsForPersist,
} from '@features/aria/defensePatternsDetection';
import { evaluateInterviewCompletionGate } from '@features/aria/interviewCompletionGate';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import { countMentalizingOvercertaintyInMarkerSlices } from '@features/aria/mentalizingOvercertaintyFromTranscript';
import { normalizeResponseConcreteness } from '@features/aria/personalMomentConcreteness';
import type { ScoreStandardDeferredPersistGateParams } from '@features/aria/standardDeferredPersistGateTypes';
import { scenarioBundleForDeferred } from '@features/aria/standardDeferredPersistGateTypes';
import {
  persistHolisticModifiersImmediate,
  persistMoment5ScoresImmediate,
} from '@utilities/persistPersonalMomentScoresIncremental';
import type { AttemptScoringBaseline } from '@utilities/persistPersonalMomentScoresIncremental';
import type { InterviewResponseTimingEntry } from '@utilities/persistResponseTimingsIncremental';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import { withRetry } from '@utilities/withRetry';

export type StandardDeferredPersistSnapshot = {
  rowPayload: Record<string, unknown>;
  scoringBaseline: AttemptScoringBaseline;
  standardDeferredHolisticForEgoCache: InterviewResults | null;
  completionGateOk: boolean;
  completionGateIncompleteReason: string | null;
  existingAttemptId: string | null;
};

export async function prepareStandardDeferredPersistSnapshot(
  params: ScoreStandardDeferredPersistGateParams,
): Promise<StandardDeferredPersistSnapshot> {
  const {
    deps,
    supabase,
    msgsDeferred,
    finalMessages,
    moment4ForAggregate,
    moment5ForAggregate,
    attemptIdForIncremental,
    nextAttemptNumber,
    apiUrl,
    typologyContext,
    fetchHolisticOnceBound,
    emotionRawScoreForGate,
    emotionResponsesForGate,
  } = params;
  let scoringBaseline = params.scoringBaseline;
  let standardDeferredHolisticForEgoCache: InterviewResults | null = null;

  const bundle = (n: 1 | 2 | 3) => scenarioBundleForDeferred(deps, n);
  const bundle1 = bundle(1);
  const bundle2 = bundle(2);
  const bundle3 = bundle(3);

  const completionGateStandard = evaluateInterviewCompletionGate({
    scenario1: bundle1,
    scenario2: bundle2,
    scenario3: bundle3,
    moment4: moment4ForAggregate,
    moment5: moment5ForAggregate,
    transcript: finalMessages,
  });
  let egoLevelForDeferredAggregate: number | null = null;
  if (!completionGateStandard.ok) {
    await remoteLog('[COMPLETION_GATE_FAIL]', {
      path: 'standard_deferred',
      incomplete_reason: completionGateStandard.incomplete_reason,
      missingScenarioNumbers: completionGateStandard.missingScenarioNumbers,
      missingMoment4: completionGateStandard.missingMoment4,
      missingMoment5: completionGateStandard.missingMoment5,
      detail: completionGateStandard.detail,
      why: 'Deferred persist: withhold weighted scoring and pass until all scenarios and personal moments are scored',
    });
  }
  if (
    completionGateStandard.ok &&
    apiUrl &&
    bundle1?.pillarScores &&
    bundle2?.pillarScores &&
    bundle3?.pillarScores
  ) {
    try {
      const ho = await withRetry(fetchHolisticOnceBound, {
        retries: 3,
        baseDelay: 12000,
        maxDelay: 45000,
        context: 'standard_deferred_holistic_ego',
        sessionLog: deps.userId
          ? {
              userId: deps.userId,
              attemptId: getSessionLogRuntime().attemptId,
              platform: getSessionLogRuntime().platform,
            }
          : undefined,
      });
      standardDeferredHolisticForEgoCache = ho;
      egoLevelForDeferredAggregate = extractEgoDevelopmentLevel(ho);
      if (attemptIdForIncremental && deps.userId && egoLevelForDeferredAggregate != null) {
        scoringBaseline = await persistHolisticModifiersImmediate(
          supabase,
          attemptIdForIncremental,
          deps.userId,
          { egoDevelopmentLevel: egoLevelForDeferredAggregate },
          scoringBaseline,
        );
      }
    } catch (holisticEgoErr) {
      await remoteLog('[STANDARD] deferred holistic prefetch failed (non-fatal for ego/modifiers)', {
        message: holisticEgoErr instanceof Error ? holisticEgoErr.message : String(holisticEgoErr),
      });
    }
  }
  const defensePatternsForDeferredRow = normalizeDefensePatternsForPersist(
    completionGateStandard.ok
      ? detectDefensePatterns(
          [
            bundle1 ? { pillarScores: bundle1.pillarScores, keyEvidence: bundle1.keyEvidence } : null,
            bundle2 ? { pillarScores: bundle2.pillarScores, keyEvidence: bundle2.keyEvidence } : null,
            bundle3 ? { pillarScores: bundle3.pillarScores, keyEvidence: bundle3.keyEvidence } : null,
          ],
          moment4ForAggregate
            ? {
                pillarScores: moment4ForAggregate.pillarScores,
                keyEvidence: moment4ForAggregate.keyEvidence,
              }
            : null,
          moment5ForAggregate
            ? {
                pillarScores: moment5ForAggregate.pillarScores,
                keyEvidence: moment5ForAggregate.keyEvidence,
              }
            : null,
          msgsDeferred,
        )
      : { ...DEFAULT_DEFENSE_PATTERNS },
  );
  const existingAttemptId = deps.interviewSessionAttemptIdRef.current;
  const disclosureSlicesForDeferredRow: MarkerScoreSlice[] = [
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
          user_slice_word_count: moment4ForAggregate.user_slice_word_count ?? undefined,
        }
      : null,
    moment5ForAggregate
      ? {
          pillarScores: moment5ForAggregate.pillarScores,
          keyEvidence: moment5ForAggregate.keyEvidence,
          mentalizing_overcertainty: moment5ForAggregate.mentalizing_overcertainty === true,
          response_concreteness: normalizeResponseConcreteness(moment5ForAggregate.response_concreteness),
          user_slice_word_count: moment5ForAggregate.user_slice_word_count ?? undefined,
        }
      : null,
  ];
  const disclosureCalibrationForDeferredRow = disclosureCalibrationFromMarkerSlices(
    disclosureSlicesForDeferredRow,
    msgsDeferred,
  );
  console.log('[Disclosure] persisting disclosure_calibration:', disclosureCalibrationForDeferredRow);
  const mentalizingOvercertaintyCountDeferred = countMentalizingOvercertaintyInMarkerSlices(
    disclosureSlicesForDeferredRow,
    msgsDeferred,
  );
  if (attemptIdForIncremental && deps.userId) {
    scoringBaseline = await persistHolisticModifiersImmediate(
      supabase,
      attemptIdForIncremental,
      deps.userId,
      {
        egoDevelopmentLevel: egoLevelForDeferredAggregate,
        mentalizingOvercertaintyCount: mentalizingOvercertaintyCountDeferred,
        defensePatterns: defensePatternsForDeferredRow as Record<string, unknown>,
      },
      scoringBaseline,
    );
    if (moment5ForAggregate) {
      scoringBaseline = await persistMoment5ScoresImmediate(
        supabase,
        attemptIdForIncremental,
        deps.userId,
        moment5ForAggregate,
        scoringBaseline,
        resolveMoment5ClientScoringMeta(deps.moment5ClientScoringMetaRef, deps.moment5AccountabilityProbeFiredRef) as Record<
          string,
          unknown
        >,
        {
          disclosure_calibration: disclosureCalibrationForDeferredRow,
          probe_log: [...deps.probeLogRef.current],
        },
      );
    }
  }
  const deferredModifierPayload = await buildDeferredPersistGateModifierSnapshot({
    completionGateOk: completionGateStandard.ok,
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
  });
  let responseTimingsForPersist: InterviewResponseTimingEntry[] | null = null;
  if (existingAttemptId && deps.userId) {
    const { data: timingRow } = await supabase
      .from('interview_attempts')
      .select('response_timings')
      .eq('id', existingAttemptId)
      .eq('user_id', deps.userId)
      .maybeSingle();
    responseTimingsForPersist =
      (timingRow?.response_timings as InterviewResponseTimingEntry[] | null | undefined) ?? null;
  }
  const rowPayload = buildDeferredPersistRowPayload({
    deps,
    nextAttemptNumber,
    finalMessages,
    completionGateOk: completionGateStandard.ok,
    completionGateIncompleteReason: completionGateStandard.ok ? null : completionGateStandard.incomplete_reason,
    bundle1,
    bundle2,
    bundle3,
    moment4ForAggregate,
    moment5ForAggregate,
    scoringBaseline,
    defensePatternsForDeferredRow: defensePatternsForDeferredRow as Record<string, unknown>,
    disclosureCalibrationForDeferredRow,
    mentalizingOvercertaintyCountDeferred,
    typologyContext,
    deferredModifierPayload,
    responseTimingsForPersist,
  });

  return {
    rowPayload,
    scoringBaseline,
    standardDeferredHolisticForEgoCache,
    completionGateOk: completionGateStandard.ok,
    completionGateIncompleteReason: completionGateStandard.ok ? null : completionGateStandard.incomplete_reason,
    existingAttemptId,
  };
}
