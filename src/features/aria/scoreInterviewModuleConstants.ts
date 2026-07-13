import type { GateResult } from '@features/aria/computeGateResult';
import {
  classifyAIReasoningRequestError,
  DEFAULT_AI_REASONING_PER_ATTEMPT_TIMEOUT_MS,
  generateAIReasoning,
} from '@features/aria/generateAIReasoning';
import { buildMoment4HandoffForInterview } from '@features/aria/interviewTransitionBundles';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { getPublicEnv, getResolvedSupabaseUrl } from '@features/aria/anthropicClientConfig';
import { remoteLog } from '@utilities/remoteLog';

export {
  ANTHROPIC_API_KEY,
  ANTHROPIC_PROXY_URL,
  SUPABASE_ANON_KEY,
  getAnthropicEndpoint,
  getResolvedSupabaseAnonKey,
  getResolvedSupabaseUrl,
} from '@features/aria/anthropicClientConfig';

/** When true, shows full AI reasoning, analysis page, and retake option. Set to false before production. */
export const ALPHA_MODE = false;

export const FALLBACK_MARKER_SCORES_MID: Record<string, number> = {
  mentalizing: 6,
  accountability: 7,
  contempt: 6,
  repair: 7,
  regulation: 6,
  attunement: 7,
  appreciation: 6,
  commitment_threshold: 6,
};

export const DEFERRED_MOMENT_ANTHROPIC_TIMEOUT_MS = 120_000;

/** Let the browser / HTTP stack recover after a long scoring burst before the large reasoning request. */
export const AI_REASONING_POST_SCORING_COOLDOWN_MS = 5_000;

const AI_REASONING_OUTER_RETRIES = 2;
const AI_REASONING_OUTER_BACKOFF_MS: readonly number[] = [4_000, 8_000];

export const MOMENT_4_HANDOFF = buildMoment4HandoffForInterview('', MOMENT_4_GRUDGE_QUESTION_TEXT);

function getResolvedWhisperProxyUrl(): string {
  const configured = getPublicEnv('EXPO_PUBLIC_OPENAI_WHISPER_PROXY_URL', 'openaiWhisperProxyUrl');
  if (configured) return configured;
  const supabaseUrl = getResolvedSupabaseUrl().replace(/\/+$/, '');
  return supabaseUrl ? `${supabaseUrl}/functions/v1/openai-whisper-proxy` : '';
}

export { getResolvedWhisperProxyUrl };

export const OPENAI_API_KEY = getPublicEnv('EXPO_PUBLIC_OPENAI_API_KEY', 'openaiApiKey');
export const OPENAI_WHISPER_PROXY_URL = getResolvedWhisperProxyUrl();

/** `modified_weighted_score` must match `weighted_score + score_modifier` (2dp rounding in gate). */
export function logWeightedModifierInvariant(
  context: string,
  weighted: number | null | undefined,
  gate: GateResult,
): void {
  if (weighted == null || !Number.isFinite(weighted)) return;
  const sm = gate.scoreModifier ?? 0;
  const actual = gate.modifiedWeightedScore;
  if (actual == null || !Number.isFinite(actual)) return;
  const expected = Math.round((weighted + sm) * 100) / 100;
  if (Math.abs(expected - actual) > 0.01) {
    console.error(`[ModifierBase] MISMATCH ${context} — expected:`, expected, 'actual:', actual);
  } else if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[ModifierBase] modifier invariant holds:', actual, `(${context})`);
  }
}

type GenerateAIReasoningSafeOptions = {
  onRetry?: (attempt: number) => void;
  onOuterRetry?: (outerAttempt: number) => void;
  onUnrecoverable?: (err: unknown) => void;
};

export async function generateAIReasoningSafe(
  pillarScores: Record<string, number>,
  scenarioScores: Record<number, { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined>,
  transcript: Array<{ role: string; content?: string }>,
  weightedScore: number | null,
  passed: boolean,
  unassessedMarkers: string[],
  options?: GenerateAIReasoningSafeOptions,
): Promise<
  import('@features/aria/generateAIReasoning').AIReasoningResult & {
    _generationFailed?: boolean;
    _reasoningPending?: boolean;
    _error?: string;
    _failureKind?: import('@features/aria/generateAIReasoning').AIReasoningRequestFailureKind;
    _outerAttempts?: number;
    _isClientRequestTimeout?: boolean;
    _isBrowserLevelNetworkFailure?: boolean;
  }
> {
  let lastErr: unknown;
  const maxOuter = 1 + AI_REASONING_OUTER_RETRIES;

  for (let outer = 0; outer < maxOuter; outer++) {
    if (outer > 0) {
      const delayMs = AI_REASONING_OUTER_BACKOFF_MS[outer - 1] ?? 8_000;
      void remoteLog('[AI_REASONING_OUTER_RETRY]', {
        outer_attempt: outer + 1,
        delay_ms_before: delayMs,
        max_outer_attempts: maxOuter,
      });
      options?.onOuterRetry?.(outer + 1);
      options?.onRetry?.(outer + 1);
      await new Promise((r) => setTimeout(r, delayMs));
    }
    try {
      return await generateAIReasoning(
        pillarScores,
        scenarioScores,
        transcript,
        weightedScore,
        passed,
        unassessedMarkers,
        { perAttemptTimeoutMs: DEFAULT_AI_REASONING_PER_ATTEMPT_TIMEOUT_MS },
      );
    } catch (err) {
      lastErr = err;
      if (outer < maxOuter - 1) {
        void remoteLog('[AI_REASONING_INNER_EXHAUSTED]', {
          outer_attempt: outer + 1,
          will_retry: true,
          error: err instanceof Error ? err.message : String(err),
        });
        continue;
      }
    }
  }

  const err = lastErr;
  const meta = classifyAIReasoningRequestError(err, null);
  if (__DEV__) {
    console.error('AI reasoning generation failed after outer retries:', meta, err);
  }
  void remoteLog('[AI_REASONING_PENDING]', {
    error: err instanceof Error ? err.message : String(err),
    failure_kind: meta.kind,
    is_client_request_timeout: meta.isClientRequestTimeout,
    is_browser_level_network_failure: meta.isBrowserLevelNetworkFailure,
    is_server_http: meta.kind === 'http',
    is_parse_error: meta.kind === 'parse',
    is_request_timeout_legacy: meta.kind === 'aborted' && meta.isClientRequestTimeout,
    is_request_timeout: meta.isClientRequestTimeout,
    is_network_error: meta.kind === 'network' || (meta.kind === 'aborted' && meta.isBrowserLevelNetworkFailure),
    error_name: err instanceof Error ? err.name : null,
    outer_attempts: maxOuter,
    pillarKeys: Object.keys(pillarScores ?? {}),
  });
  return {
    _reasoningPending: true,
    _failureKind: meta.kind,
    _error: err instanceof Error ? err.message : String(err),
    _outerAttempts: maxOuter,
    _isClientRequestTimeout: meta.isClientRequestTimeout,
    _isBrowserLevelNetworkFailure: meta.isBrowserLevelNetworkFailure,
    overall_summary: undefined,
    overall_strengths: [],
    overall_growth_areas: [],
    construct_breakdown: {},
    scenario_observations: {},
    closing_reflection: undefined,
  };
}
