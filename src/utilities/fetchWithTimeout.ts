/**
 * fetch() with AbortSignal timeout — prevents hung proxy/API calls from blocking UI forever.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? 90_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const { timeoutMs: _omit, signal: externalSignal, ...rest } = init;
  try {
    return await fetch(url, {
      ...rest,
      signal: externalSignal ?? controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
