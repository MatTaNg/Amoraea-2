import { communicationFloorFieldsFromTranscript } from '@features/aria/communicationFloorFromTranscript';
import { scenarioCompositesToStorageJson } from '@features/aria/computeGateResult';
import { extractEgoDevelopmentLevel } from '@features/aria/aggregateMarkerScoresFromSlices';
import { emotionRecognitionPersistSpreadIfComplete } from '@features/aria/emotionRecognitionInterview';
import type { FinalizeStandardHolisticClientFallbackParams } from '@features/aria/holisticClientFallbackTypes';
import { skipPenaltyPersistFieldsFromConfirmedCount } from '@features/aria/scenarioSkipCountHydration';
import { commitStandardOnboardingUsersAfterAttempt } from '@features/aria/scoreInterviewOnboardingCommit';
import {
  ALPHA_MODE,
  generateAIReasoningSafe,
  logWeightedModifierInvariant,
} from '@features/aria/scoreInterviewModuleConstants';
import { triggerAsyncAiReasoningPipeline } from '@features/onboarding/triggerAsyncAiReasoningPipeline';
import { applyPsychometricModifierToAttempt } from '@features/psychometrics/applyPsychometricModifier';
import { buildDefenseCrossReferenceForAttempt } from '@features/psychometrics/crossReferenceDefenseDetection';
import { normalizeDefensePatternsForPersist } from '@features/aria/defensePatternsDetection';
import { markScoringStageComplete } from '@features/psychometrics/ensureInterviewRollupArtifacts';
import { normalizeGateFailDetailForPersist } from '@features/psychometrics/gateFailDetailForPersist';
import { PSYCHOMETRICS_ENABLED } from '@features/psychometrics/interviewCompletionStatus';
import {
  fetchAttemptScoringBaseline,
  logScorePipelineBaseline,
  persistHolisticModifiersImmediate,
} from '@utilities/persistPersonalMomentScoresIncremental';
import {
  resolveResponseTimingsForPersist,
  type InterviewResponseTimingEntry,
} from '@utilities/persistResponseTimingsIncremental';
import { remoteLog } from '@utilities/remoteLog';
import { runCommunicationStylePipelineAfterSave } from '@utilities/runCommunicationStylePipeline';
import { getSessionLogRuntime, logGateAnalyticsToSession } from '@utilities/sessionLogging';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';

/** Persist standard onboarding attempt row and finish non-alpha holistic path. */
export async function finalizeStandardHolisticClientFallback(
  params: FinalizeStandardHolisticClientFallbackParams,
): Promise<void> {
  const { deps, supabase, finalMessages, isStandardOnboardingApplicant, state } = params;
  const {
    parsed,
    gateResult,
    holisticStoredPatterns,
    holisticDisclosureCalibration,
    mentalizingOvercertaintyCountHolistic,
    holisticDefensePatterns,
    completionGateHolistic,
    moment4ConcretenessHolisticGate,
    moment5ConcretenessHolisticGate,
    holisticWeightedScoreForPersist,
  } = state;
  const deferredForHolistic = deps.interviewSessionAttemptIdRef.current;

  if (isStandardOnboardingApplicant && deferredForHolistic && deps.userId) {
    const emotionPersistStandard = emotionRecognitionPersistSpreadIfComplete([
      ...deps.emotionItemResponsesRef.current,
    ]);
    console.log('[Disclosure] persisting disclosure_calibration:', holisticDisclosureCalibration);
    const holisticPatterns = (holisticStoredPatterns ?? {}) as {
      moment_4_scores?: unknown;
      moment_5_scores?: unknown;
    };
    const egoForStandardHolisticUpdate = extractEgoDevelopmentLevel(parsed);
    let holisticScoringBaseline = await fetchAttemptScoringBaseline(supabase, deferredForHolistic, deps.userId);
    logScorePipelineBaseline(holisticScoringBaseline);
    const { data: userPsychForCrossRef } = await supabase
      .from('users')
      .select(
        'psychometrics_gasp_score, psychometrics_aaq2_score, psychometrics_rses_score, psychometrics_scs_sf_score, psychometrics_sd3_narcissism_score, psychometrics_rfq_score',
      )
      .eq('id', deps.userId)
      .maybeSingle();
    const preCrossRefDepthModifier =
      gateResult.depthSignalModifier ?? gateResult.scoreModifier ?? 0;
    const defenseCrossReference = buildDefenseCrossReferenceForAttempt({
      defensePatterns: holisticDefensePatterns as Record<string, unknown>,
      userPsychometrics: (userPsychForCrossRef as Record<string, unknown> | null) ?? null,
      depthSignalModifierApplied: preCrossRefDepthModifier,
    });
    const crossRefAdjustedDepthModifier =
      Math.round((preCrossRefDepthModifier + defenseCrossReference.modifierAdjustment) * 100) / 100;
    const crossRefAdjustedModifiedWeighted =
      gateResult.modifiedWeightedScore != null && Number.isFinite(gateResult.modifiedWeightedScore)
        ? Math.round((gateResult.modifiedWeightedScore + defenseCrossReference.modifierAdjustment) * 100) / 100
        : gateResult.modifiedWeightedScore;
    const reviewFlagsForHolisticPersist = [...(gateResult.reviewFlags ?? [])];
    if (defenseCrossReference.recommendAdminReview) {
      reviewFlagsForHolisticPersist.push(...defenseCrossReference.flags.map((f) => f.flagName));
    }
    holisticScoringBaseline = await persistHolisticModifiersImmediate(
      supabase,
      deferredForHolistic,
      deps.userId,
      {
        egoDevelopmentLevel: egoForStandardHolisticUpdate,
        mentalizingOvercertaintyCount: mentalizingOvercertaintyCountHolistic,
        defensePatterns: holisticDefensePatterns as Record<string, unknown>,
        defenseCrossReference,
      },
      holisticScoringBaseline,
    );
    if (__DEV__) {
      console.log(
        '[Modifier] persisting score_modifier (client holistic):',
        gateResult.scoreModifier,
        'modified_weighted_score:',
        gateResult.modifiedWeightedScore,
      );
      console.log('[ModifierBase] weighted_score being persisted:', gateResult.weightedScore);
      console.log('[ModifierBase] modified_weighted_score being persisted:', gateResult.modifiedWeightedScore);
      console.log('[ModifierBase] score_modifier being persisted:', gateResult.scoreModifier);
      const wH = gateResult.weightedScore;
      if (wH != null && Number.isFinite(wH) && gateResult.modifiedWeightedScore != null) {
        const expectedMod = Math.round((wH + (gateResult.scoreModifier ?? 0)) * 100) / 100;
        console.log('[ModifierBase] invariant check — expected:', expectedMod, 'actual:', gateResult.modifiedWeightedScore);
      }
      console.log('[ReviewFlags] persisting review_flags:', gateResult.reviewFlags);
    }
    logWeightedModifierInvariant('standard_holistic_client', gateResult.weightedScore, gateResult);
    const { data: existingTimingRow } = await supabase
      .from('interview_attempts')
      .select('response_timings')
      .eq('id', deferredForHolistic)
      .eq('user_id', deps.userId)
      .maybeSingle();
    const responseTimingsForHolistic = resolveResponseTimingsForPersist(
      deps.responseTimingsRef.current as InterviewResponseTimingEntry[],
      existingTimingRow?.response_timings as InterviewResponseTimingEntry[] | null | undefined,
    );
    const { error: attErr } = await supabase
      .from('interview_attempts')
      .update({
        completed_at: new Date().toISOString(),
        weighted_score: gateResult.weightedScore,
        passed: gateResult.pass,
        gate_fail_reasons: gateResult.failReasonCodes ?? [],
        gate_fail_detail: normalizeGateFailDetailForPersist(gateResult.failReasonDetail),
        scenario_composites: scenarioCompositesToStorageJson(gateResult.scenarioComposites),
        pillar_scores: parsed.pillarScores ?? null,
        scoring_deferred: false,
        ...(responseTimingsForHolistic ? { response_timings: responseTimingsForHolistic } : {}),
        ...(completionGateHolistic && !completionGateHolistic.ok
          ? { incomplete_reason: completionGateHolistic.incomplete_reason }
          : {}),
        ...(() => {
          const skipFields = skipPenaltyPersistFieldsFromConfirmedCount(
            deps.scenarioSkipConfirmedCountRef.current,
          );
          return {
            skip_count: skipFields.skip_count,
            skip_penalties: skipFields.skip_penalties,
            skip_penalty_total: skipFields.skip_penalty_total,
            auto_failed: skipFields.auto_failed,
            auto_fail_reason: skipFields.auto_fail_reason,
          };
        })(),
        ...communicationFloorFieldsFromTranscript(finalMessages),
        ego_development_level: egoForStandardHolisticUpdate ?? holisticScoringBaseline.ego_development_level,
        reasoning_pending: true,
        ai_reasoning: {
          _reasoningPending: true,
          pillar_scores: parsed.pillarScores ?? {},
          weighted_score: gateResult.weightedScore,
          passed: gateResult.pass,
          note: 'Narrative generation queued (client holistic scoring path).',
          _queuedAt: new Date().toISOString(),
        },
        review_flags: reviewFlagsForHolisticPersist,
        depth_signal_modifier: crossRefAdjustedDepthModifier,
        score_modifier: crossRefAdjustedDepthModifier,
        modified_weighted_score:
          crossRefAdjustedModifiedWeighted ??
          holisticWeightedScoreForPersist ??
          gateResult.modifiedWeightedScore ??
          gateResult.weightedScore ??
          null,
        mentalizing_overcertainty_count:
          mentalizingOvercertaintyCountHolistic ?? holisticScoringBaseline.mentalizing_overcertainty_count,
        defense_patterns: normalizeDefensePatternsForPersist(
          holisticDefensePatterns ?? holisticScoringBaseline.defense_patterns,
        ),
        defense_cross_reference: defenseCrossReference,
        ...emotionPersistStandard,
        disclosure_calibration: holisticDisclosureCalibration ?? holisticScoringBaseline.disclosure_calibration,
        personal_moment_emotional_vocab_density: null,
        personal_moment_emotional_vocab_low: false,
        moment_4_concreteness: moment4ConcretenessHolisticGate ?? holisticScoringBaseline.moment_4_concreteness,
        moment_5_concreteness: moment5ConcretenessHolisticGate ?? holisticScoringBaseline.moment_5_concreteness,
      })
      .eq('id', deferredForHolistic)
      .eq('user_id', deps.userId);
    if (attErr) {
      void remoteLog('[STANDARD] client_holistic_interview_attempts_update_failed', {
        attemptId: deferredForHolistic,
        message: attErr.message,
      });
      if (__DEV__) console.error('interview_attempts update (client holistic fallback)', attErr);
    } else {
      void remoteLog('[STANDARD] client_holistic_saved_to_interview_attempts', {
        attemptId: deferredForHolistic,
        pass: gateResult.pass,
      });
      // Atomic rollup AFTER scores are committed — never fire-and-forget.
      const rollupResult = await markScoringStageComplete(
        supabase,
        deferredForHolistic,
        deps.userId,
        'moment5',
        {
          userPsychometrics: (userPsychForCrossRef as Record<string, unknown> | null) ?? null,
          force: true,
          trigger: 'finalizeStandardHolisticClientFallback:after_holistic_write',
          overrides: {
            scenario_composites: scenarioCompositesToStorageJson(gateResult.scenarioComposites),
            gate_fail_reasons: gateResult.failReasonCodes ?? [],
            defense_patterns: normalizeDefensePatternsForPersist(
              holisticDefensePatterns ?? holisticScoringBaseline.defense_patterns,
            ),
            defense_cross_reference: defenseCrossReference,
            ego_development_level:
              egoForStandardHolisticUpdate ?? holisticScoringBaseline.ego_development_level,
            disclosure_calibration:
              holisticDisclosureCalibration ?? holisticScoringBaseline.disclosure_calibration,
            personal_moment_emotional_vocab_density: null,
            personal_moment_emotional_vocab_low: false,
            depth_signal_modifier: crossRefAdjustedDepthModifier,
            score_modifier: crossRefAdjustedDepthModifier,
            modified_weighted_score:
              crossRefAdjustedModifiedWeighted ??
              holisticWeightedScoreForPersist ??
              gateResult.modifiedWeightedScore ??
              gateResult.weightedScore ??
              null,
          },
        },
      );
      void remoteLog('[STANDARD] client_holistic_rollup_complete', {
        attemptId: deferredForHolistic,
        ok: rollupResult.ok,
        verified: rollupResult.verified,
        skipped: rollupResult.skipped ?? null,
        error: rollupResult.error ?? null,
      });
      await applyPsychometricModifierToAttempt(deps.userId, deferredForHolistic);
      const rtpPost = getSessionLogRuntime();
      void runCommunicationStylePipelineAfterSave(
        deps.userId,
        deferredForHolistic,
        deps.interviewSessionIdRef.current,
        { platform: rtpPost.platform },
      );
      if (PSYCHOMETRICS_ENABLED) {
        triggerAsyncAiReasoningPipeline(deps.userId, deferredForHolistic);
      } else {
        void (async () => {
          const pillarForReasoning: Record<string, number> = {};
          for (const [k, v] of Object.entries(parsed.pillarScores ?? {})) {
            if (typeof v === 'number' && Number.isFinite(v)) pillarForReasoning[k] = v;
          }
          const scenarioMapForReasoning: Record<
            number,
            { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined
          > = {};
          for (const n of [1, 2, 3] as const) {
            const s = deps.scenarioScoresRef.current[n];
            if (s) {
              scenarioMapForReasoning[n] = {
                pillarScores: s.pillarScores,
                scenarioName: s.scenarioName,
              };
            }
          }
          const reasoning = await generateAIReasoningSafe(
            pillarForReasoning,
            scenarioMapForReasoning,
            finalMessages,
            gateResult.weightedScore,
            gateResult.pass,
            [],
          );
          const narrativePending = !!(reasoning as { _reasoningPending?: boolean })._reasoningPending;
          const aiOut = narrativePending
            ? {
                _reasoningPending: false,
                _narrativeFailed: true,
                pillar_scores: pillarForReasoning,
                weighted_score: gateResult.weightedScore,
                passed: gateResult.pass,
                note: 'Narrative AI reasoning failed or timed out; scores saved.',
                last_error: (reasoning as { _error?: string })._error ?? null,
              }
            : (reasoning as unknown as Record<string, unknown>);
          await supabase
            .from('interview_attempts')
            .update({
              ai_reasoning: aiOut,
              reasoning_pending: false,
            })
            .eq('id', deferredForHolistic)
            .eq('user_id', deps.userId);
        })();
      }
    }
  }

  await deps.saveInterviewResults(parsed, gateResult, deps.userId);
  if (deps.userId) {
    const r = getSessionLogRuntime();
    logGateAnalyticsToSession({
      base: { userId: deps.userId, attemptId: r.attemptId, platform: r.platform },
      gateReason: gateResult.reason,
      failingConstruct: gateResult.failingConstruct,
      failingScore: gateResult.failingScore,
      weightedScore: gateResult.weightedScore,
      pillarScores: parsed.pillarScores ?? {},
    });
    writeSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 'session_complete',
      eventData: { session_correlation_id: deps.interviewSessionIdRef.current, path: 'non_alpha_results' },
      platform: r.platform,
    });
  }
  if (isStandardOnboardingApplicant) {
    const attemptIdForCommit = deps.interviewSessionAttemptIdRef.current ?? deferredForHolistic ?? null;
    if (attemptIdForCommit) {
      await commitStandardOnboardingUsersAfterAttempt(supabase, {
        userId: deps.userId!,
        attemptIdForUserRow: attemptIdForCommit,
        gateOkForInterviewPassed: completionGateHolistic == null || completionGateHolistic.ok,
      });
      deps.setPendingScoringSyncAttemptId(attemptIdForCommit);
    }
    if (!ALPHA_MODE) {
      deps.queryClient.invalidateQueries({ queryKey: ['profile', deps.userId] });
    }
    deps.setStatus('results');
  } else {
    void remoteLog('[RESULTS_SCREEN_TRANSITION]', {
      destination: 'in_app_congratulations',
      userId: deps.userId ?? null,
      interviewSessionId: deps.interviewSessionIdRef.current,
      source: 'scoreInterview_non_alpha_non_standard',
    });
    deps.setInterviewStatus('congratulations');
  }
  deps.setStatus('results');
}
