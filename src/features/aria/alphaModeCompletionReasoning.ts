import type { GateResult } from '@features/aria/computeGateResult';
import type { InterviewCompletionGateResult } from '@features/aria/interviewCompletionGate';
import {
  AI_REASONING_POST_SCORING_COOLDOWN_MS,
  generateAIReasoningSafe,
} from '@features/aria/scoreInterviewModuleConstants';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';

export type AlphaCompletionReasoningResult = {
  reasoning: Awaited<ReturnType<typeof generateAIReasoningSafe>>;
  reasoningPending: boolean;
  elapsedReasoningMs: number;
  failureKind: string | undefined;
};

export async function generateAlphaModeCompletionReasoning(params: {
  deps: ScoreInterviewDeps;
  gateBlockedAlpha: boolean;
  completionGateAlpha: InterviewCompletionGateResult;
  finalMessages: { role: string; content: string }[];
  finalGateResult: GateResult;
  pillarScores: Record<string, number>;
}): Promise<AlphaCompletionReasoningResult> {
  const { deps, gateBlockedAlpha, completionGateAlpha, finalMessages, finalGateResult, pillarScores } =
    params;

  let reasoning: Awaited<ReturnType<typeof generateAIReasoningSafe>>;
  let reasoningPending: boolean;
  let elapsedReasoningMs = 0;
  let failureKind: string | undefined;

  if (!gateBlockedAlpha) {
    deps.setReasoningProgress('generating');
    if (__DEV__) console.log('=== [3] Generating reasoning (post-scoring cooldown) ===');
    await new Promise((r) => setTimeout(r, AI_REASONING_POST_SCORING_COOLDOWN_MS));
    if (__DEV__) console.log('=== [3] Generating reasoning (request) ===');
    const slowTimer = setTimeout(() => deps.setReasoningProgress('slow'), 10_000);
    const verySlowTimer = setTimeout(() => deps.setReasoningProgress('very_slow'), 30_000);
    const reasoningStartedAt = Date.now();
    reasoning = await generateAIReasoningSafe(
      pillarScores,
      {
        1: deps.scenarioScoresRef.current[1],
        2: deps.scenarioScoresRef.current[2],
        3: deps.scenarioScoresRef.current[3],
      },
      finalMessages,
      finalGateResult.weightedScore,
      finalGateResult.pass,
      finalGateResult.excludedMarkers ?? [],
      {
        onOuterRetry: (n) => deps.setReasoningProgress(n >= 2 ? 'very_slow' : 'slow'),
      },
    );
    elapsedReasoningMs = Date.now() - reasoningStartedAt;
    failureKind = (reasoning as { _failureKind?: string })._failureKind;
    reasoningPending = !!(reasoning as { _reasoningPending?: boolean })._reasoningPending;
    deps.setReasoningProgress(reasoningPending ? 'failed' : 'done');
    clearTimeout(slowTimer);
    clearTimeout(verySlowTimer);
  } else {
    reasoning = {
      _reasoningPending: true,
      _completionHeld: true,
      incomplete_reason: completionGateAlpha.incomplete_reason,
      detail: completionGateAlpha.detail,
    } as unknown as Awaited<ReturnType<typeof generateAIReasoningSafe>>;
    reasoningPending = true;
    failureKind = undefined;
    deps.setReasoningProgress('failed');
  }

  if (deps.userId) {
    const r = getSessionLogRuntime();
    writeSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 'ai_reasoning_complete',
      eventData: {
        attempt_id: r.attemptId ?? deps.interviewSessionAttemptIdRef.current ?? null,
        elapsed_ms: elapsedReasoningMs,
        reasoning_pending: reasoningPending,
        failure_kind: failureKind ?? null,
        last_error: (reasoning as { _error?: string })._error ?? null,
        outer_attempts: (reasoning as { _outerAttempts?: number })._outerAttempts ?? null,
        is_client_request_timeout:
          (reasoning as { _isClientRequestTimeout?: boolean })._isClientRequestTimeout ?? null,
        is_browser_level_network_failure:
          (reasoning as { _isBrowserLevelNetworkFailure?: boolean })._isBrowserLevelNetworkFailure ??
          null,
        post_scoring_cooldown_ms: AI_REASONING_POST_SCORING_COOLDOWN_MS,
      },
      platform: r.platform,
    });
  }

  await remoteLog('[4] Reasoning generated', {
    reasoningKeys: reasoning ? Object.keys(reasoning) : [],
    reasoningPending,
    elapsed_ms: elapsedReasoningMs,
    failure_kind: failureKind ?? null,
    lastError: (reasoning as { _error?: string })._error ?? null,
    outer_attempts: (reasoning as { _outerAttempts?: number })._outerAttempts ?? null,
    is_client_request_timeout: (reasoning as { _isClientRequestTimeout?: boolean })._isClientRequestTimeout,
    is_browser_level_network_failure: (reasoning as { _isBrowserLevelNetworkFailure?: boolean })
      ._isBrowserLevelNetworkFailure,
    is_request_timeout: (reasoning as { _isClientRequestTimeout?: boolean })._isClientRequestTimeout,
    is_network_error: failureKind === 'network' || failureKind === 'aborted',
  });
  if (__DEV__) console.log('=== [4] Reasoning complete ===');

  return { reasoning, reasoningPending, elapsedReasoningMs, failureKind };
}
