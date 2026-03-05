/**
 * withRetry — silent exponential backoff for async calls.
 * Used by interview flow (conversation, scoring, reasoning, DB).
 * Only retries on rate limit (429) and network errors.
 */

export interface WithRetryOptions {
  retries?: number;
  baseDelay?: number;
  maxDelay?: number;
  context?: string;
  onRetry?: (attempt: number) => void;
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
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      const status = (err as { status?: number })?.status;

      const isRateLimit =
        /rate limit|429/i.test(message) || status === 429;
      const isNetwork =
        /fetch|network|Failed to fetch/i.test(message);

      const isRetryable = isRateLimit || isNetwork;

      if (!isRetryable || attempt === retries) {
        if (__DEV__) {
          console.error(`[${context}] failed after ${attempt + 1} attempt(s):`, message);
        }
        throw lastError;
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
      if (__DEV__) {
        console.warn(
          `[${context}] attempt ${attempt + 1} failed (${message.slice(0, 60)}). Retrying in ${delay / 1000}s...`
        );
      }
      if (onRetry) onRetry(attempt + 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
