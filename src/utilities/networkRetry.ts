/**
 * Three attempts with fixed delays before attempts 2 and 3 (after failures on 1 and 2).
 * Delays: `delaysMs[0]` after attempt 1 fails, `delaysMs[1]` after attempt 2 fails.
 */
export async function runWithThreeAttemptsFixedBackoff<T>(opts: {
  run: (attemptNumber: 1 | 2 | 3) => Promise<T>;
  delaysMs: [number, number];
  shouldRetry: (err: unknown, failedAttemptNumber: 1 | 2 | 3) => boolean;
  onRetry?: (info: { nextAttempt: 2 | 3; delayMs: number; error: unknown }) => void;
}): Promise<T> {
  const { run, delaysMs, shouldRetry, onRetry } = opts;
  let lastErr: unknown;
  for (const attempt of [1, 2, 3] as const) {
    try {
      return await run(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt === 3 || !shouldRetry(err, attempt)) {
        throw err;
      }
      const delayMs = attempt === 1 ? delaysMs[0] : delaysMs[1];
      onRetry?.({ nextAttempt: (attempt + 1) as 2 | 3, delayMs, error: err });
      await new Promise<void>((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
