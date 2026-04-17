/**
 * Shared between `openai-whisper-proxy` and Jest — keep in sync when editing either copy.
 * (Supabase Edge runs Deno; app tests import this file via relative path.)
 */

export function formFieldString(fd: { get(key: string): unknown }, key: string): string | undefined {
  const v = fd.get(key);
  if (v == null) return undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    return t !== '' ? t : undefined;
  }
  if (typeof File !== 'undefined' && v instanceof File) return undefined;
  const s = String(v).trim();
  return s !== '' ? s : undefined;
}

/** Merge `language` from multipart fields, alternate keys, and query string — forward a single value to OpenAI. */
export function resolveIncomingWhisperLanguage(
  incoming: { get(key: string): unknown; entries(): IterableIterator<[string, unknown]> },
  requestUrl: string
): string | undefined {
  const url = new URL(requestUrl);
  const fromQuery =
    url.searchParams.get('language')?.trim() ||
    url.searchParams.get('language_parameter')?.trim() ||
    url.searchParams.get('lang')?.trim();
  if (fromQuery) return fromQuery;
  for (const key of ['language', 'language_parameter', 'lang', 'locale'] as const) {
    const s = formFieldString(incoming, key);
    if (s) return s;
  }
  for (const [k, v] of incoming.entries()) {
    if (typeof v !== 'string' || v.trim() === '') continue;
    const kl = k.toLowerCase();
    if (kl === 'language' || kl === 'language_parameter' || kl === 'lang' || kl === 'locale') {
      return v.trim();
    }
  }
  return undefined;
}
