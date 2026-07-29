import type { AlphaPersonalMomentAggregate } from '@features/aria/alphaModeCompletionScenarioPrep';
import type { AlphaGateAggregateResult } from '@features/aria/alphaModeCompletionGateAggregate';
import { calculateConstructAsymmetry } from '@features/aria/alphaAssessmentUtils';
import { communicationFloorFieldsFromTranscript } from '@features/aria/communicationFloorFromTranscript';
import { scenarioCompositesToStorageJson } from '@features/aria/computeGateResult';
import type { InterviewCompletionGateResult } from '@features/aria/interviewCompletionGate';
import { emotionRecognitionPersistSpreadIfComplete } from '@features/aria/emotionRecognitionInterview';
import { resolveMoment5ClientScoringMeta } from '@features/aria/moment5ClientScoringMetaUtils';
import { computeSkipPenaltyGateComputation } from '@features/aria/interviewSkipPenalties';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import { generateAIReasoningSafe, logWeightedModifierInvariant } from '@features/aria/scoreInterviewModuleConstants';
import { normalizeGateFailDetailForPersist } from '@features/psychometrics/gateFailDetailForPersist';
import type { AttemptScoringBaseline } from '@utilities/persistPersonalMomentScoresIncremental';
import {
  buildMoment4ScoresRecord,
  buildMoment5ScoresRecord,
  resolveMomentScoresForFinalPersist,
} from '@utilities/persistPersonalMomentScoresIncremental';

export function buildAlphaModeAttemptInsertPayload(params: {
  deps: ScoreInterviewDeps;
  finalMessages: { role: string; content: string }[];
  parsed: InterviewResults;
  gateBlockedAlpha: boolean;
  completionGateAlpha: InterviewCompletionGateResult;
  gateAggregate: AlphaGateAggregateResult;
  scoreConsistency: ReturnType<
    typeof import('@features/aria/alphaAssessmentUtils').calculateScoreConsistency
  >;
  languageMarkers: Record<string, unknown>;
  moment4ForAggregate: AlphaPersonalMomentAggregate;
  moment5ForAggregate: AlphaPersonalMomentAggregate;
  scoringBaseline: AttemptScoringBaseline;
  reasoning: Awaited<ReturnType<typeof generateAIReasoningSafe>>;
  reasoningPending: boolean;
  attemptNum: number;
}): Record<string, unknown> {
  const {
    deps,
    finalMessages,
    parsed,
    gateBlockedAlpha,
    completionGateAlpha,
    gateAggregate,
    scoreConsistency,
    languageMarkers,
    moment4ForAggregate,
    moment5ForAggregate,
    scoringBaseline: alphaScoringBaseline,
    reasoning,
    reasoningPending,
    attemptNum,
  } = params;

  const {
    finalGateResult,
    pillarScores,
    pillarContributorCounts,
    egoLevelForAttempt,
    weightedScoreForAttempt,
    disclosureCalibrationForAttempt,
    defensePatternsForAttempt,
    moment4ConcretenessForAttempt,
    moment5ConcretenessForAttempt,
    mentalizingOvercertaintyCountForAttempt,
  } = gateAggregate;

  const emotionPersistAlpha = emotionRecognitionPersistSpreadIfComplete([
    ...deps.emotionItemResponsesRef.current,
  ]);

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(
      '[Modifier] persisting score_modifier:',
      finalGateResult.scoreModifier,
      'modified_weighted_score:',
      finalGateResult.modifiedWeightedScore,
    );
    const wPersist = weightedScoreForAttempt ?? finalGateResult.weightedScore;
    console.log('[ModifierBase] weighted_score being persisted:', wPersist);
    console.log(
      '[ModifierBase] modified_weighted_score being persisted:',
      finalGateResult.modifiedWeightedScore,
    );
    console.log('[ModifierBase] score_modifier being persisted:', finalGateResult.scoreModifier);
    if (wPersist != null && Number.isFinite(wPersist) && finalGateResult.modifiedWeightedScore != null) {
      const expectedMod = Math.round((wPersist + (finalGateResult.scoreModifier ?? 0)) * 100) / 100;
      console.log(
        '[ModifierBase] invariant check — expected:',
        expectedMod,
        'actual:',
        finalGateResult.modifiedWeightedScore,
      );
    }
    console.log('[ReviewFlags] persisting review_flags:', finalGateResult.reviewFlags);
  }
  logWeightedModifierInvariant('alpha_interview_attempts', finalGateResult.weightedScore, finalGateResult);

  const constructAsymmetry = calculateConstructAsymmetry(
    pillarScores,
    finalGateResult.excludedMarkers ?? [],
    { contributorCounts: pillarContributorCounts },
  );

  const insertPayload: Record<string, unknown> = {
    user_id: deps.userId,
    attempt_number: attemptNum,
    completed_at: new Date().toISOString(),
    weighted_score: finalGateResult.weightedScore,
    passed: finalGateResult.pass,
    gate_fail_reasons: finalGateResult.failReasonCodes ?? [],
    gate_fail_detail: normalizeGateFailDetailForPersist(finalGateResult.failReasonDetail),
    scenario_composites: scenarioCompositesToStorageJson(finalGateResult.scenarioComposites),
    pillar_scores: pillarScores,
    ...(gateBlockedAlpha ? { incomplete_reason: completionGateAlpha.incomplete_reason } : {}),
    scenario_1_scores: deps.scenarioScoresRef.current[1]
      ? {
          pillarScores: deps.scenarioScoresRef.current[1].pillarScores,
          pillarConfidence: deps.scenarioScoresRef.current[1].pillarConfidence,
          keyEvidence: deps.scenarioScoresRef.current[1].keyEvidence,
          scenarioName: deps.scenarioScoresRef.current[1].scenarioName,
          mentalizing_inference_source: deps.scenarioScoresRef.current[1].mentalizing_inference_source,
          mentalizing_overcertainty: deps.scenarioScoresRef.current[1].mentalizing_overcertainty === true,
        }
      : null,
    scenario_2_scores: deps.scenarioScoresRef.current[2]
      ? {
          pillarScores: deps.scenarioScoresRef.current[2].pillarScores,
          pillarConfidence: deps.scenarioScoresRef.current[2].pillarConfidence,
          keyEvidence: deps.scenarioScoresRef.current[2].keyEvidence,
          scenarioName: deps.scenarioScoresRef.current[2].scenarioName,
          mentalizing_inference_source: deps.scenarioScoresRef.current[2].mentalizing_inference_source,
          mentalizing_overcertainty: deps.scenarioScoresRef.current[2].mentalizing_overcertainty === true,
        }
      : null,
    scenario_3_scores: deps.scenarioScoresRef.current[3]
      ? {
          pillarScores: deps.scenarioScoresRef.current[3].pillarScores,
          pillarConfidence: deps.scenarioScoresRef.current[3].pillarConfidence,
          keyEvidence: deps.scenarioScoresRef.current[3].keyEvidence,
          scenarioName: deps.scenarioScoresRef.current[3].scenarioName,
          mentalizing_inference_source: deps.scenarioScoresRef.current[3].mentalizing_inference_source,
          mentalizing_overcertainty: deps.scenarioScoresRef.current[3].mentalizing_overcertainty === true,
        }
      : null,
    transcript: finalMessages,
    response_timings: deps.responseTimingsRef.current,
    probe_log: deps.probeLogRef.current,
    score_consistency: scoreConsistency,
    construct_asymmetry: constructAsymmetry,
    ...(() => {
      const snap = computeSkipPenaltyGateComputation(deps.scenarioSkipConfirmedCountRef.current);
      return {
        skip_count: snap.skips_taken,
        skip_penalties: snap.skip_penalties,
        skip_penalty_total: snap.skip_penalty_total,
        auto_failed: snap.skipAutoFail,
        auto_fail_reason: snap.skipAutoFail ? 'exceeded_skip_limit' : null,
      };
    })(),
    language_markers: languageMarkers,
    scenario_specific_patterns: {
      moment_4_scores: resolveMomentScoresForFinalPersist(
        moment4ForAggregate
          ? buildMoment4ScoresRecord(moment4ForAggregate, deps.moment4SpecificityScoringRef.current)
          : null,
        alphaScoringBaseline,
        'moment_4_scores',
      ),
      moment_5_scores: resolveMomentScoresForFinalPersist(
        moment5ForAggregate
          ? buildMoment5ScoresRecord(
              moment5ForAggregate,
              resolveMoment5ClientScoringMeta(
                deps.moment5ClientScoringMetaRef,
                deps.moment5AccountabilityProbeFiredRef,
              ) as Record<string, unknown>,
            )
          : null,
        alphaScoringBaseline,
        'moment_5_scores',
      ),
    },
    reasoning_pending: gateBlockedAlpha,
    ai_reasoning: gateBlockedAlpha
      ? {
          _reasoningPending: true,
          _completionHeld: true,
          incomplete_reason: completionGateAlpha.incomplete_reason,
          detail: completionGateAlpha.detail,
          pillar_scores: pillarScores,
          weighted_score: finalGateResult.weightedScore,
          passed: finalGateResult.pass,
          note: 'Interview scoring gate blocked completion; narrative was not generated.',
        }
      : reasoningPending
        ? {
            _reasoningPending: false,
            _narrativeFailed: true,
            pillar_scores: pillarScores,
            weighted_score: finalGateResult.weightedScore,
            passed: finalGateResult.pass,
            last_error: (reasoning as { _error?: string })._error ?? null,
            note:
              'Narrative AI reasoning was not generated in this session. Scores and transcript are saved; retry from the admin panel (Tab 2).',
          }
        : reasoning,
    ...communicationFloorFieldsFromTranscript(finalMessages),
    ego_development_level: egoLevelForAttempt ?? alphaScoringBaseline.ego_development_level,
    review_flags: finalGateResult.reviewFlags,
    depth_signal_modifier: finalGateResult.depthSignalModifier ?? finalGateResult.scoreModifier ?? 0,
    score_modifier: finalGateResult.depthSignalModifier ?? finalGateResult.scoreModifier ?? 0,
    modified_weighted_score:
      finalGateResult.modifiedWeightedScore ?? weightedScoreForAttempt ?? finalGateResult.weightedScore ?? null,
    mentalizing_overcertainty_count:
      mentalizingOvercertaintyCountForAttempt ?? alphaScoringBaseline.mentalizing_overcertainty_count,
    defense_patterns: defensePatternsForAttempt ?? alphaScoringBaseline.defense_patterns,
    moment_4_concreteness: moment4ConcretenessForAttempt ?? alphaScoringBaseline.moment_4_concreteness,
    moment_5_concreteness: moment5ConcretenessForAttempt ?? alphaScoringBaseline.moment_5_concreteness,
    personal_moment_emotional_vocab_density: null,
    personal_moment_emotional_vocab_low: false,
    ...emotionPersistAlpha,
    disclosure_calibration: disclosureCalibrationForAttempt ?? alphaScoringBaseline.disclosure_calibration,
  };

  return insertPayload;
}
