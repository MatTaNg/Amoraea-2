import { analyzeLanguageMarkers, buildScenarioBoundaries } from '@features/aria/alphaAssessmentUtils';
import { computeAlphaModeGateAndPillars } from '@features/aria/alphaModeCompletionGateAggregate';
import { generateAlphaModeCompletionReasoning } from '@features/aria/alphaModeCompletionReasoning';
import {
  alphaSkipPenaltyGateOptions,
  buildAlphaMarkerSlicesForAggregate,
  countAlphaMentalizingOvercertainty,
  evaluateAlphaCompletionGate,
  logAlphaCompletionGateFailure,
  prepareAlphaScenarioScoresAtCompletion,
} from '@features/aria/alphaModeCompletionScenarioPrep';
import type { RunAlphaModeCompletionParams } from '@features/aria/alphaModeCompletionTypes';
import { buildAlphaModeAttemptInsertPayload } from '@features/aria/buildAlphaModeAttemptInsertPayload';
import { saveInterviewProgress } from '@features/aria/interviewLocalPersistence';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  buildAlphaModeUsersUpdatePayload,
  persistAlphaModeCompletionSave,
  resolveAlphaModeAttemptNumber,
} from '@features/aria/persistAlphaModeCompletionSave';
import { rescoreMissingAlphaScenarioScores } from '@features/aria/rescoreMissingAlphaScenarioScores';
import { scoreAlphaPersonalMoments } from '@features/aria/scoreAlphaPersonalMoments';
import { inferPersonalMomentSlices } from '@features/aria/personalMomentSlices';
import { remoteLog } from '@utilities/remoteLog';
import {
  fetchAttemptScoringBaseline,
  logScorePipelineBaseline,
} from '@utilities/persistPersonalMomentScoresIncremental';
import { loadInterviewFromStorage } from '@utilities/storage/InterviewStorage';
import { getSessionLogRuntime, logSupabaseWriteFailed } from '@utilities/sessionLogging/writeSessionLog';

export type { RunAlphaModeCompletionParams } from '@features/aria/alphaModeCompletionTypes';

/** ALPHA_MODE completion: rescore gaps, M4/M5, aggregate, reasoning, DB insert, navigation. */
export async function runAlphaModeCompletion(params: RunAlphaModeCompletionParams): Promise<boolean> {
  const {
    deps,
    supabase,
    finalMessages,
    parsed,
    gateResult,
    weightedMin,
    apiUrl,
    headers,
    isStandardOnboardingApplicant,
    hydrateScenarioScoresFromAttemptIfNeeded,
    emotionRawScoreForGate,
    emotionResponsesForGate,
  } = params;

  await hydrateScenarioScoresFromAttemptIfNeeded();
  await rescoreMissingAlphaScenarioScores(deps, finalMessages);

  let alphaSaveOk = false;
  let insertPayload: Record<string, unknown> | null = null;
  let updatePayload: Record<string, unknown> | null = null;
  let attemptNum = 1;

  try {
    await deps.ensureValidSession();
    const existingAttemptId = deps.interviewSessionAttemptIdRef.current;
    const txForCompletion = finalMessages as MessageWithScenario[];
    const scenarioBoundaries = buildScenarioBoundaries(
      finalMessages,
      Array.from(deps.scoredScenariosRef.current),
    );
    const languageMarkers = analyzeLanguageMarkers(finalMessages, scenarioBoundaries);
    const personalSlices = inferPersonalMomentSlices(finalMessages);
    const alphaAttemptIdForIncremental = existingAttemptId;
    let alphaScoringBaseline = {
      patterns: {},
      moment_4_concreteness: null,
      moment_5_concreteness: null,
      ego_development_level: null,
      personal_moment_emotional_vocab_low: false,
      personal_moment_emotional_vocab_density: null,
      disclosure_calibration: null,
      defense_patterns: null,
      mentalizing_overcertainty_count: 0,
    };
    if (alphaAttemptIdForIncremental && deps.userId) {
      alphaScoringBaseline = await fetchAttemptScoringBaseline(
        supabase,
        alphaAttemptIdForIncremental,
        deps.userId,
      );
      logScorePipelineBaseline(alphaScoringBaseline);
    }

    const alphaPersonal = await scoreAlphaPersonalMoments({
      apiUrl,
      headers,
      finalMessages: txForCompletion,
      userId: deps.userId,
      attemptIdForIncremental: alphaAttemptIdForIncremental,
      scoringBaseline: alphaScoringBaseline,
      supabase,
      deferredMoment4NarrativeRef: deps.deferredMoment4NarrativeRef,
      moment4SpecificityScoringRef: deps.moment4SpecificityScoringRef,
      moment5ClientScoringMetaRef: deps.moment5ClientScoringMetaRef,
      moment5AccountabilityProbeFiredRef: deps.moment5AccountabilityProbeFiredRef,
      probeLogRef: deps.probeLogRef,
      personalSlices,
    });
    const moment4ForAggregate = alphaPersonal.moment4ForAggregate;
    const moment5ForAggregate = alphaPersonal.moment5ForAggregate;
    alphaScoringBaseline = alphaPersonal.scoringBaseline;

    void remoteLog('[MOMENT4_SCORING_PIPELINE]', {
      m4Start: personalSlices.m4Start,
      moment4SliceTurns: personalSlices.moment4.length,
      moment4UserTurns: personalSlices.moment4.filter((m) => m.role === 'user').length,
      scored: alphaPersonal.moment4Scored,
    });

    const { scoreConsistency } = prepareAlphaScenarioScoresAtCompletion(deps, txForCompletion);
    const completionGateAlpha = evaluateAlphaCompletionGate(
      deps,
      moment4ForAggregate,
      moment5ForAggregate,
      txForCompletion,
    );
    const gateBlockedAlpha = !completionGateAlpha.ok;
    if (gateBlockedAlpha) {
      await logAlphaCompletionGateFailure(completionGateAlpha);
    }

    const skipOptsAlpha = alphaSkipPenaltyGateOptions(deps);
    parsed.skipBreakdown = skipOptsAlpha.skipBreakdown;

    const markerSlicesForAggregate = buildAlphaMarkerSlicesForAggregate(
      deps,
      moment4ForAggregate,
      moment5ForAggregate,
    );
    const mentalizingOvercertaintyCountForAttempt = countAlphaMentalizingOvercertainty(
      markerSlicesForAggregate,
      txForCompletion,
    );

    const gateAggregate = await computeAlphaModeGateAndPillars({
      deps,
      supabase,
      finalMessages: txForCompletion,
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
      scoringBaseline: alphaScoringBaseline,
      mentalizingOvercertaintyCountForAttempt,
      emotionRawScoreForGate,
      emotionResponsesForGate,
    });
    alphaScoringBaseline = gateAggregate.scoringBaseline;

    parsed.pillarScores = gateAggregate.pillarScores;
    parsed.gateResult = gateAggregate.finalGateResult;
    deps.setResults({ ...parsed });

    const { reasoning, reasoningPending } = await generateAlphaModeCompletionReasoning({
      deps,
      gateBlockedAlpha,
      completionGateAlpha,
      finalMessages,
      finalGateResult: gateAggregate.finalGateResult,
      pillarScores: gateAggregate.pillarScores,
    });

    attemptNum = await resolveAlphaModeAttemptNumber(deps.userId, existingAttemptId);
    insertPayload = buildAlphaModeAttemptInsertPayload({
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
    });
    updatePayload = await buildAlphaModeUsersUpdatePayload(
      supabase,
      deps.userId,
      gateAggregate.finalGateResult,
      attemptNum,
    );

    const attemptId = await persistAlphaModeCompletionSave({
      deps,
      supabase,
      insertPayload,
      updatePayload,
      finalGateResult: gateAggregate.finalGateResult,
      pillarScores: gateAggregate.pillarScores,
      parsed,
      attemptNum,
      existingAttemptId,
      isStandardOnboardingApplicant,
      gateBlockedAlpha,
      disclosureCalibrationForAttempt: gateAggregate.disclosureCalibrationForAttempt,
    });
    if (attemptId) {
      alphaSaveOk = true;
    }
  } catch (err) {
    if (deps.userId) {
      logSupabaseWriteFailed({
        userId: deps.userId,
        attemptId: getSessionLogRuntime().attemptId,
        platform: getSessionLogRuntime().platform,
        table: 'interview_attempts / users',
        operation: 'alpha_completion_save',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
    await remoteLog('[ERROR] Completion handler threw', {
      message: err instanceof Error ? err.message : String(err),
      name: err instanceof Error ? err.name : 'unknown',
      stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
    });
    if (__DEV__) {
      console.error('=== [4] Alpha save failed ===', err);
    }
    deps.setAnalysisAttemptId(null);
    deps.setPendingScoringSyncAttemptId(null);
    deps.setInterviewLastCommittedAttemptId(null);
    const saved = await loadInterviewFromStorage(deps.userId);
    if (saved && insertPayload != null && updatePayload != null) {
      await saveInterviewProgress(deps.userId, {
        ...saved,
        pendingDatabaseSave: true,
        saveFailedAt: new Date().toISOString(),
        pendingAttemptPayload: {
          insert: insertPayload,
          update: { ...updatePayload, latest_attempt_id: null },
          attemptNum,
        },
      });
    }
    await deps.saveInterviewResults(parsed, gateResult, deps.userId);
  }

  return alphaSaveOk;
}
