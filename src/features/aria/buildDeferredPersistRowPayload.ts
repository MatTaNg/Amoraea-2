import { emotionRecognitionPersistSpreadIfComplete } from '@features/aria/emotionRecognitionInterview';
import { resolveMoment5ClientScoringMeta } from '@features/aria/moment5ClientScoringMetaUtils';
import { transcriptEligibleForMoment5Scoring } from '@features/aria/moment5ScoringGuard';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import type { scenarioBundleForDeferred } from '@features/aria/standardDeferredPersistGateTypes';
import {
  sanitizeMoment5PersonalScoresForAggregate,
  sanitizePersonalMomentScoresForAggregate,
} from '@features/aria/personalMomentSliceSanitize';
import { sanitizeScenarioScoreBundleForPersist } from '@features/aria/sanitizeScenarioKeyEvidenceForPersist';
import type { AttemptScoringBaseline } from '@utilities/persistPersonalMomentScoresIncremental';
import {
  resolveResponseTimingsForPersist,
  type InterviewResponseTimingEntry,
} from '@utilities/persistResponseTimingsIncremental';
import { normalizeDefensePatternsForPersist } from '@features/aria/defensePatternsDetection';
import {
  buildMoment4ScoresRecord,
  buildMoment5ScoresRecord,
  coalesceConcretenessForFinalPersist,
  resolveMomentScoresForFinalPersist,
} from '@utilities/persistPersonalMomentScoresIncremental';

type ScenarioBundle = NonNullable<ReturnType<typeof scenarioBundleForDeferred>>;

export type BuildDeferredPersistRowPayloadParams = {
  deps: ScoreInterviewDeps;
  nextAttemptNumber: number;
  finalMessages: unknown[];
  completionGateOk: boolean;
  completionGateIncompleteReason: string | null;
  bundle1: ScenarioBundle | null;
  bundle2: ScenarioBundle | null;
  bundle3: ScenarioBundle | null;
  moment4ForAggregate: ReturnType<typeof sanitizePersonalMomentScoresForAggregate> | null;
  moment5ForAggregate: ReturnType<typeof sanitizeMoment5PersonalScoresForAggregate> | null;
  scoringBaseline: AttemptScoringBaseline;
  defensePatternsForDeferredRow: Record<string, unknown>;
  pevDeferred: {
    personal_moment_emotional_vocab_density: number | null;
    personal_moment_emotional_vocab_low: boolean;
  };
  disclosureCalibrationForDeferredRow: number | null;
  mentalizingOvercertaintyCountDeferred: number;
  typologyContext: string;
  deferredModifierPayload: Record<string, unknown>;
  responseTimingsForPersist?: InterviewResponseTimingEntry[] | null;
};

export function buildDeferredPersistRowPayload(
  params: BuildDeferredPersistRowPayloadParams,
): Record<string, unknown> {
  const {
    deps,
    nextAttemptNumber,
    finalMessages,
    completionGateOk,
    completionGateIncompleteReason,
    bundle1,
    bundle2,
    bundle3,
    moment4ForAggregate,
    moment5ForAggregate,
    scoringBaseline,
    defensePatternsForDeferredRow,
    pevDeferred,
    disclosureCalibrationForDeferredRow,
    mentalizingOvercertaintyCountDeferred,
    typologyContext,
    deferredModifierPayload,
  } = params;

  const moment5EligibleForPersist = transcriptEligibleForMoment5Scoring(
    finalMessages as Parameters<typeof transcriptEligibleForMoment5Scoring>[0],
  );
  const moment5ForPersist = moment5EligibleForPersist ? moment5ForAggregate : null;
  const suppressMoment5BaselineBackfill = moment5EligibleForPersist && moment5ForPersist == null;

  let responseTimings: InterviewResponseTimingEntry[] | null = null;
  try {
    responseTimings = resolveResponseTimingsForPersist(
      deps.responseTimingsRef.current as InterviewResponseTimingEntry[],
      params.responseTimingsForPersist,
    );
  } catch (err) {
    console.error(
      `[Amoraea] deferred response_timings assembly failed for attempt ${deps.interviewSessionAttemptIdRef.current ?? 'pending'}:`,
      err,
    );
  }

  return {
    user_id: deps.userId,
    attempt_number: nextAttemptNumber,
    transcript: finalMessages,
    ...(responseTimings ? { response_timings: responseTimings } : {}),
    probe_log: deps.probeLogRef.current,
    scenario_1_scores: bundle1 ? sanitizeScenarioScoreBundleForPersist(bundle1) : null,
    scenario_2_scores: bundle2 ? sanitizeScenarioScoreBundleForPersist(bundle2) : null,
    scenario_3_scores: bundle3 ? sanitizeScenarioScoreBundleForPersist(bundle3) : null,
    ...(completionGateOk
      ? {}
      : {
          incomplete_reason: completionGateIncompleteReason,
          weighted_score: null,
          passed: false,
        }),
    scenario_specific_patterns: {
      moment_4_scores: resolveMomentScoresForFinalPersist(
        moment4ForAggregate
          ? buildMoment4ScoresRecord(moment4ForAggregate, deps.moment4SpecificityScoringRef.current)
          : null,
        scoringBaseline,
        'moment_4_scores',
      ),
      moment_5_scores: resolveMomentScoresForFinalPersist(
        moment5ForPersist
          ? buildMoment5ScoresRecord(
              moment5ForPersist,
              resolveMoment5ClientScoringMeta(
                deps.moment5ClientScoringMetaRef,
                deps.moment5AccountabilityProbeFiredRef,
              ) as Record<string, unknown>,
            )
          : null,
        scoringBaseline,
        'moment_5_scores',
        { suppressBaselineBackfill: suppressMoment5BaselineBackfill },
      ),
    },
    defense_patterns: normalizeDefensePatternsForPersist(defensePatternsForDeferredRow),
    moment_4_concreteness: coalesceConcretenessForFinalPersist(
      moment4ForAggregate,
      scoringBaseline.moment_4_concreteness,
    ),
    moment_5_concreteness: coalesceConcretenessForFinalPersist(
      moment5ForPersist,
      scoringBaseline.moment_5_concreteness,
      suppressMoment5BaselineBackfill,
    ),
    personal_moment_emotional_vocab_density: suppressMoment5BaselineBackfill
      ? pevDeferred.personal_moment_emotional_vocab_density
      : pevDeferred.personal_moment_emotional_vocab_density ??
        scoringBaseline.personal_moment_emotional_vocab_density,
    personal_moment_emotional_vocab_low: suppressMoment5BaselineBackfill
      ? pevDeferred.personal_moment_emotional_vocab_low
      : pevDeferred.personal_moment_emotional_vocab_low ??
        scoringBaseline.personal_moment_emotional_vocab_low,
    disclosure_calibration: suppressMoment5BaselineBackfill
      ? disclosureCalibrationForDeferredRow
      : disclosureCalibrationForDeferredRow ?? scoringBaseline.disclosure_calibration,
    mentalizing_overcertainty_count:
      mentalizingOvercertaintyCountDeferred ?? scoringBaseline.mentalizing_overcertainty_count,
    completed_at: new Date().toISOString(),
    scoring_deferred: true,
    interview_typology_context: typologyContext,
    ...emotionRecognitionPersistSpreadIfComplete([...deps.emotionItemResponsesRef.current]),
    ...deferredModifierPayload,
  };
}
