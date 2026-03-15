/**
 * withRetry — retries only on retryable errors (rate limit, network, timeouts).
 * Unrecoverable errors (4xx, 500) throw immediately with unrecoverable: true.
 * Exhausted retries throw with retriesExhausted: true.
 */

export type ErrorClassification = 'retryable' | 'unrecoverable' | 'unknown';

/**
 * Classify an error for retry behavior.
 * - retryable: transient (429, 502, 503, 504, network, timeout) — worth retrying
 * - unrecoverable: bad request, auth, server error — no retry
 * - unknown: treat as retry once then unrecoverable
 */
export function classifyError(err: unknown): ErrorClassification {
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
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const errorType = classifyError(err);

      if (errorType === 'unrecoverable') {
        if (__DEV__) {
          const status = (err as { status?: number })?.status;
          console.error(`[${context}] unrecoverable error (${status}):`, err instanceof Error ? err.message : err);
        }
        onUnrecoverable?.(err);
        throw Object.assign(err instanceof Error ? err : new Error(String(err)), { unrecoverable: true });
      }

      if (attempt === retries) {
        if (__DEV__) {
          console.error(`[${context}] failed after ${attempt + 1} attempt(s):`, err instanceof Error ? err.message : err);
        }
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
