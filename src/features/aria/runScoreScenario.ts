import { supabase } from '@data/supabase/client';
import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_PROXY_URL,
  buildAnthropicMessagesHeaders,
  getAnthropicEndpoint,
} from '@features/aria/anthropicClientConfig';
import { ALPHA_MODE } from '@features/aria/scoreInterviewModuleConstants';
import { formatScoreMessage } from '@features/aria/interviewConstructAndScoreDisplay';
import { resolveScenarioUserTextForScoring } from '@features/aria/interviewScenarioScoringSlice';
import { fetchScenarioScoreFromAnthropic } from '@features/aria/fetchScenarioScoreFromAnthropic';
import { postProcessScenarioModelScore } from '@features/aria/postProcessScenarioModelScore';
import { SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS } from '@features/aria/interviewSkipPenalties';
import {
  logScenarioScoreAllScenariosRecoveryCritical,
  scenarioScoreRecoveryStats,
} from '@features/aria/scenarioScoringParse';
import {
  assertScenarioScoreQualityOrThrow,
  isScenarioScoreDegradedError,
  maxTokensForScenarioScore,
} from '@features/aria/scenarioScoreDegradedRetry';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import {
  extractScenario3UserCorpusAfterLastRepairPrompt,
  sliceTranscriptForScenario3Scoring,
  type ScenarioCorpusMessageSlice,
} from '@features/aria/scenarioCProbeLogic';
import type { ScoreScenarioDeps, ScoreScenarioParams } from '@features/aria/scoreScenarioTypes';
import {
  persistScenarioScoreBundleToAttempt,
  type ScenarioAttemptScoreBundle,
} from '@utilities/interviewAttemptScenarioPersistence';
import { markScoringStageComplete, type ScoringStageId } from '@features/psychometrics/ensureInterviewRollupArtifacts';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';
import { loadInterviewFromStorage } from '@utilities/storage/InterviewStorage';
import { saveInterviewProgress } from '@features/aria/interviewLocalPersistence';
import { withRetry } from '@utilities/withRetry';

function scoringStageIdForScenario(scenarioNumber: 1 | 2 | 3): ScoringStageId {
  if (scenarioNumber === 1) return 'scenario1';
  if (scenarioNumber === 2) return 'scenario2';
  return 'scenario3';
}

export async function runScoreScenario(
  deps: ScoreScenarioDeps,
  params: ScoreScenarioParams,
): Promise<void> {
  const {
    userId,
    isAdmin,
    scenarioCRepairOnlyEvidenceRef,
    scenarioScoresRef,
    scenarioFrustrationSkipNullMarkersRef,
    interviewSessionAttemptIdRef,
    probeLogRef,
    setScenarioScores,
    setMessages,
    saveScenarioCheckpoint,
  } = deps;
  const { scenarioNumber, allMessages } = params;

  if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) return;
  const scoringMessages =
    scenarioNumber === 3
      ? sliceTranscriptForScenario3Scoring(allMessages as ScenarioCorpusMessageSlice[])
      : allMessages;
  const userMessages = scoringMessages.filter((m) => m.role === 'user');
  if (userMessages.length < 2 && __DEV__) {
    console.warn(
      `Scenario ${scenarioNumber} scored with insufficient user messages (${userMessages.length}) — both-characters answer may be missing. Token may have fired before the answer was received.`,
    );
  }
  const apiUrl = getAnthropicEndpoint();
  const headers = buildAnthropicMessagesHeaders({ apiUrl });
  const repairFocusForPrompt =
    scenarioNumber === 3
      ? scenarioCRepairOnlyEvidenceRef.current?.trim() ||
        extractScenario3UserCorpusAfterLastRepairPrompt(scoringMessages as ScenarioCorpusMessageSlice[]) ||
        null
      : null;
  const priorMentalizingForScenario3 =
    scenarioNumber === 3
      ? {
          s1: scenarioScoresRef.current[1]?.pillarScores?.mentalizing ?? undefined,
          s2: scenarioScoresRef.current[2]?.pillarScores?.mentalizing ?? undefined,
        }
      : null;
  const scoringT0 = Date.now();
  if (userId) {
    const r = getSessionLogRuntime();
    writeSessionLog({
      userId,
      attemptId: r.attemptId,
      eventType: 'scoring_start',
      eventData: { scenario_number: scenarioNumber },
      platform: r.platform,
    });
  }
  try {
    let scoringAttempt = 0;
    const scenarioResult = await withRetry(
      async (): Promise<ScenarioScoreResult> => {
        scoringAttempt += 1;
        const attemptId = interviewSessionAttemptIdRef.current;
        const { parsedScenario, raw, parseError, stopReason } = await fetchScenarioScoreFromAnthropic({
          apiUrl,
          headers,
          scenarioNumber,
          scoringMessages,
          priorMentalizingForScenario3,
          repairFocusForPrompt,
          attemptId,
        });
        const scenarioUserTextPreNormalize = resolveScenarioUserTextForScoring(
          scoringMessages as Parameters<typeof resolveScenarioUserTextForScoring>[0],
          scenarioNumber,
        );
        const scenarioResult = postProcessScenarioModelScore({
          parsedScenario,
          raw,
          scenarioNumber,
          scoringMessages,
          scenarioUserTextPreNormalize,
          frustrationSkipNullMarkers: scenarioFrustrationSkipNullMarkersRef.current,
          parseError,
          attemptId,
        });
        const recoveryStats = scenarioScoreRecoveryStats(
          scenarioResult,
          SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS[scenarioNumber],
        );
        try {
          assertScenarioScoreQualityOrThrow({
            scenarioNumber,
            parseError,
            stopReason,
            recoveryStats,
            pillarScores: scenarioResult.pillarScores,
            contemptTierBreakdown: scenarioResult.contempt_tier_breakdown,
          });
        } catch (qualityErr) {
          if (isScenarioScoreDegradedError(qualityErr)) {
            void remoteLog('[SCENARIO_SCORE_DEGRADED_RETRY]', {
              scenarioNumber,
              attemptId: attemptId ?? null,
              scoringAttempt,
              reason: qualityErr.reason,
              stopReason: stopReason ?? null,
              maxTokens: maxTokensForScenarioScore(scenarioNumber),
              recoveredMarkerCount: qualityErr.recoveryStats.recoveredMarkerCount,
              scoredMarkerCount: qualityErr.recoveryStats.scoredMarkerCount,
              rawLength: raw.length,
            });
          }
          throw qualityErr;
        }
        return scenarioResult;
      },
      {
        retries: 3,
        baseDelay: 5000,
        maxDelay: 30000,
        context: `scoring scenario ${scenarioNumber}`,
        onUnrecoverable: (err) => {
          if (__DEV__) {
            const status = (err as { status?: number })?.status;
            console.error(`Scoring unrecoverable error (scenario ${scenarioNumber}):`, status);
          }
        },
        sessionLog: userId
          ? {
              userId,
              attemptId: getSessionLogRuntime().attemptId,
              platform: getSessionLogRuntime().platform,
            }
          : undefined,
      },
    );
    if (scoringAttempt > 1) {
      void remoteLog('[SCENARIO_SCORE_DEGRADED_RECOVERED]', {
        scenarioNumber,
        attemptId: interviewSessionAttemptIdRef.current ?? null,
        scoringAttempt,
        ...scenarioScoreRecoveryStats(
          scenarioResult,
          SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS[scenarioNumber],
        ),
      });
    }
    if (userId) {
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'scoring_complete',
        eventData: { scenario_number: scenarioNumber },
        durationMs: Date.now() - scoringT0,
        platform: r.platform,
      });
    }
    if (scenarioNumber === 3) {
      scenarioCRepairOnlyEvidenceRef.current = null;
    }
    const scoreMessage = formatScoreMessage(scenarioResult);
    if (__DEV__) {
      console.log('[SCORECARD_FETCH_RESULT]', {
        isAdmin,
        scenarioNumber,
        scoreKeys: Object.keys(scenarioResult.pillarScores ?? {}),
        scoreMessageLength: scoreMessage.length,
        mentalizing_inference_source: scenarioResult.mentalizing_inference_source ?? null,
        mentalizing_overcertainty: scenarioResult.mentalizing_overcertainty ?? false,
      });
    }
    void remoteLog('[SCORECARD_FETCH_RESULT]', {
      isAdmin,
      scenarioNumber,
      scoreKeys: Object.keys(scenarioResult.pillarScores ?? {}),
      scoreMessageLength: scoreMessage.length,
      mentalizing_inference_source: scenarioResult.mentalizing_inference_source ?? null,
      mentalizing_overcertainty: scenarioResult.mentalizing_overcertainty ?? false,
      userId: userId ?? null,
      ...scenarioScoreRecoveryStats(
        scenarioResult,
        SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS[scenarioNumber],
      ),
    });
    if (scenarioNumber === 3) {
      const perScenario = {
        1: scenarioScoreRecoveryStats(
          scenarioScoresRef.current[1] ?? { pillarScores: {}, keyEvidence: {} },
          SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS[1],
        ),
        2: scenarioScoreRecoveryStats(
          scenarioScoresRef.current[2] ?? { pillarScores: {}, keyEvidence: {} },
          SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS[2],
        ),
        3: scenarioScoreRecoveryStats(
          scenarioResult,
          SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS[3],
        ),
      };
      if (perScenario[1].usedRecoveryPath && perScenario[2].usedRecoveryPath && perScenario[3].usedRecoveryPath) {
        logScenarioScoreAllScenariosRecoveryCritical({
          attemptId: interviewSessionAttemptIdRef.current,
          userId: userId ?? null,
          perScenario,
        });
      }
    }
    setScenarioScores((prev) => ({ ...prev, [scenarioNumber]: scenarioResult }));
    scenarioScoresRef.current[scenarioNumber] = scenarioResult;
    const attemptIdForSlice = interviewSessionAttemptIdRef.current;
    if (userId && attemptIdForSlice) {
      const bundle: ScenarioAttemptScoreBundle = {
        pillarScores: scenarioResult.pillarScores,
        pillarConfidence: scenarioResult.pillarConfidence,
        keyEvidence: scenarioResult.keyEvidence,
        scenarioName: scenarioResult.scenarioName,
        mentalizing_inference_source: scenarioResult.mentalizing_inference_source,
        mentalizing_overcertainty: scenarioResult.mentalizing_overcertainty === true,
        contempt_tier_breakdown: scenarioResult.contempt_tier_breakdown,
      };
      try {
        await withRetry(
          async () => {
            const { error } = await persistScenarioScoreBundleToAttempt(supabase, {
              attemptId: attemptIdForSlice,
              userId,
              scenarioNumber,
              bundle,
            });
            if (error) throw error;
          },
          {
            retries: 2,
            baseDelay: 2000,
            maxDelay: 10000,
            context: `persist scenario ${scenarioNumber} scores`,
            sessionLog: userId
              ? {
                  userId,
                  attemptId: getSessionLogRuntime().attemptId,
                  platform: getSessionLogRuntime().platform,
                }
              : undefined,
          },
        );
        void markScoringStageComplete(supabase, attemptIdForSlice, userId, scoringStageIdForScenario(scenarioNumber), {
          trigger: `runScoreScenario:after_persist_scenario_${scenarioNumber}`,
        }).catch((rollupErr) => {
          void remoteLog('[WARN] gated rollup after scenario persist failed', {
            scenarioNumber,
            message: rollupErr instanceof Error ? rollupErr.message : String(rollupErr),
          });
        });
      } catch (pe) {
        void remoteLog('[WARN] scenario slice DB persist failed after scoring', {
          scenarioNumber,
          message: pe instanceof Error ? pe.message : String(pe),
        });
      }
    }
    if (ALPHA_MODE) {
      const ps = scenarioResult.pillarScores ?? {};
      const vals = Object.values(ps).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      const postScore = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      probeLogRef.current.push({
        scenario: scenarioNumber,
        construct: 'combined',
        probe_fired: false,
        trigger_reason: null,
        pre_probe_score: 0,
        post_probe_score: Math.round(postScore * 10) / 10,
        score_delta: Math.round(postScore * 10) / 10,
      });
    }
    setMessages((prev) => [
      ...prev,
      { role: 'system', content: scoreMessage, isScoreCard: true } as {
        role: string;
        content: string;
        isScoreCard?: boolean;
      },
    ]);
    saveScenarioCheckpoint(scenarioNumber, scenarioResult, scoringMessages, userId);
  } catch (err) {
    deps.scoredScenariosRef?.current.delete(scenarioNumber);
    if (__DEV__) console.error(`Scoring failed for scenario ${scenarioNumber}:`, err instanceof Error ? err.message : err);
    const retriesExhausted = (err as { retriesExhausted?: boolean }).retriesExhausted === true;
    if (retriesExhausted && isScenarioScoreDegradedError(err)) {
      void remoteLog('[SCENARIO_SCORE_DEGRADED_EXHAUSTED]', {
        scenarioNumber,
        attemptId: interviewSessionAttemptIdRef.current ?? null,
        reason: err.reason,
        maxTokens: maxTokensForScenarioScore(scenarioNumber),
        recoveredMarkerCount: err.recoveryStats.recoveredMarkerCount,
        scoredMarkerCount: err.recoveryStats.scoredMarkerCount,
      });
    }
    await remoteLog('[ERROR] scenario scoring failed', {
      scenarioNumber,
      message: err instanceof Error ? err.message : String(err),
      retriesExhausted,
      totalMessages: scoringMessages.length,
      userTurns: scoringMessages.filter((m) => m.role === 'user').length,
    });
    const saved = await loadInterviewFromStorage(userId);
    if (saved) {
      const scoringFailed = [
        ...(saved.scoringFailed ?? []),
        {
          scenario: scenarioNumber,
          failedAt: new Date().toISOString(),
          error: err instanceof Error ? err.message : String(err),
        },
      ];
      await saveInterviewProgress(userId, { ...saved, scoringFailed });
    }
  }
}
