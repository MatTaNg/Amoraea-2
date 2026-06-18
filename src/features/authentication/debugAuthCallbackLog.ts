/** Debug-only auth callback tracing (session 28d27a). Do not log tokens or PII. */
const DEBUG_AUTH_STORAGE_KEY = 'debug_auth_28d27a';

export function debugAuthCallbackLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = 'pre-fix',
): void {
  const entry = {
    sessionId: '28d27a',
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
    runId,
  };
  if (typeof window !== 'undefined') {
    try {
      const prev = JSON.parse(sessionStorage.getItem(DEBUG_AUTH_STORAGE_KEY) ?? '[]') as unknown[];
      prev.push(entry);
      sessionStorage.setItem(DEBUG_AUTH_STORAGE_KEY, JSON.stringify(prev.slice(-40)));
    } catch {
      /* ignore */
    }
  }
  if (typeof fetch !== 'undefined') {
    // #region agent log
    fetch('http://127.0.0.1:7668/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '28d27a' },
      body: JSON.stringify(entry),
    }).catch(() => {});
    // #endregion
  }
  if (typeof console !== 'undefined') {
    // #region agent log
    console.info('[auth-debug-28d27a]', location, message, data);
    // #endregion
  }
}

export function sanitizeAuthUrlForLog(
  pathname: string,
  search: string,
  hash: string,
): Record<string, unknown> {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const hashParams = hash.startsWith('#') ? new URLSearchParams(hash.slice(1)) : new URLSearchParams();
  return {
    pathname,
    hasCode: params.has('code'),
    hasTokenHash: params.has('token_hash'),
    queryType: params.get('type') ?? null,
    hashType: hashParams.get('type') ?? null,
    hasAccessTokenHash: hash.toLowerCase().includes('access_token'),
    hasErrorHash: hash.toLowerCase().includes('error='),
    searchLen: search.length,
    hashLen: hash.length,
  };
}
