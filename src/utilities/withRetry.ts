/**
 * withRetry — retries only on retryable errors (rate limit, network, timeouts).
 * Unrecoverable errors (4xx, 500) throw immediately with unrecoverable: true.
 * Exhausted retries throw with retriesExhausted: true.
 */

import { writeSessionLog, type SessionPlatform } from '@utilities/sessionLogging/writeSessionLog';

export type ErrorClassification = 'retryable' | 'unrecoverable' | 'unknown';

/**
 * Classify an error for retry behavior.
 * - retryable: transient (429, 502, 503, 504, network, timeout) — worth retrying
 * - unrecoverable: bad request, auth, server error — no retry
 * - unknown: treat as retry once then unrecoverable
 */
export function classifyError(err: unknown): ErrorClassification {
  if (err instanceof Error && err.name === 'WebTtsRequiresUserGestureError') {
    return 'unrecoverable';
  }
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { status?: number; statusCode?: number })?.statusCode
    ?? null;
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();

  // Retryable — transient
  if (status === 429) return 'retryable';
  if (status === 503) return 'retryable';
  if (status === 504) return 'retryable';
  if (status === 502) return 'retryable';
  if (message.includes('rate limit')) return 'retryable';
  if (message.includes('timeout')) return 'retryable';
  if (message.includes('network')) return 'retryable';
  if (message.includes('failed to fetch')) return 'retryable';
  if (message.includes('econnreset')) return 'retryable';
  if (message.includes('enotfound')) return 'retryable';

  // Unrecoverable — won't fix with retry
  if (status === 400) return 'unrecoverable';
  if (status === 401) return 'unrecoverable';
  if (status === 403) return 'unrecoverable';
  if (status === 404) return 'unrecoverable';
  if (status === 500) return 'unrecoverable';
  if (message.includes('invalid')) return 'unrecoverable';
  if (message.includes('unauthorized')) return 'unrecoverable';
  if (message.includes('forbidden')) return 'unrecoverable';
  if (message.includes('not found')) return 'unrecoverable';

  return 'unknown';
}

export interface WithRetryOptions {
  retries?: number;
  baseDelay?: number;
  maxDelay?: number;
  context?: string;
  onRetry?: (attempt: number) => void;
  onUnrecoverable?: (err: unknown) => void;
  /** When set, logs api_call_slow (>3000ms) and api_call_failed (exhausted / unrecoverable). */
  sessionLog?: {
    userId: string | null;
    attemptId: string | null;
    platform: SessionPlatform | null;
  };
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: WithRetryOptions = {}
): Promise<T> {
  const {
    retries = 2,
    baseDelay = 8000,
    maxDelay = 20000,
    context = 'API call',
    onRetry,
    onUnrecoverable,
    sessionLog,
  } = options;

  let lastError: unknown;
  const logApi = sessionLog?.userId
    ? (type: 'api_call_slow' | 'api_call_failed', payload: Record<string, unknown>, durationMs?: number, err?: string) => {
        writeSessionLog({
          userId: sessionLog.userId!,
          attemptId: sessionLog.attemptId,
          eventType: type,
          eventData: { endpoint: context, user_id: sessionLog.userId, ...payload },
          durationMs: durationMs ?? null,
          error: err ?? null,
          platform: sessionLog.platform,
        });
      }
    : null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const t0 = Date.now();
      const result = await fn();
      const ms = Date.now() - t0;
      if (logApi && ms > 3000) {
        logApi('api_call_slow', { duration_ms: ms }, ms);
      }
      return result;
    } catch (err) {
      lastError = err;
      const errorType = classifyError(err);

      if (errorType === 'unrecoverable') {
        if (__DEV__) {
          const status = (err as { status?: number })?.status;
          console.error(`[${context}] unrecoverable error (${status}):`, err instanceof Error ? err.message : err);
        }
        onUnrecoverable?.(err);
        const status = (err as { status?: number })?.status ?? null;
        logApi?.(
          'api_call_failed',
          {
            status_code: status,
            error_message: err instanceof Error ? err.message : String(err),
            retry_count: 0,
          },
          undefined,
          err instanceof Error ? err.message : String(err)
        );
        throw Object.assign(err instanceof Error ? err : new Error(String(err)), { unrecoverable: true });
      }

      if (attempt === retries) {
        if (__DEV__) {
          console.error(`[${context}] failed after ${attempt + 1} attempt(s):`, err instanceof Error ? err.message : err);
        }
        const status = (err as { status?: number })?.status ?? null;
        logApi?.(
          'api_call_failed',
          {
            status_code: status,
            error_message: err instanceof Error ? err.message : String(err),
            retry_count: retries,
          },
          undefined,
          err instanceof Error ? err.message : String(err)
        );
        throw Object.assign(lastError instanceof Error ? lastError : new Error(String(lastError)), { retriesExhausted: true });
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      if (__DEV__) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[${context}] attempt ${attempt + 1} failed, retrying in ${delay / 1000}s...`, message.slice(0, 60));
      }
      if (attempt === 0 && onRetry) onRetry(attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
