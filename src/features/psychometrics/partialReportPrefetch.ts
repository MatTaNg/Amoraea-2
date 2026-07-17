import { buildPartialReportHtml } from './generatePartialReport';

type CacheEntry = {
  html?: string;
  promise?: Promise<string>;
};

const cacheByUserId = new Map<string, CacheEntry>();

export function getCachedPartialReportHtml(userId: string): string | null {
  return cacheByUserId.get(userId)?.html ?? null;
}

export function clearPartialReportCache(userId?: string): void {
  if (userId) {
    cacheByUserId.delete(userId);
    return;
  }
  cacheByUserId.clear();
}

/** Starts (or returns) in-flight partial report generation; resolves to branded report HTML. */
export function prefetchPartialReport(userId: string): Promise<string> {
  const existing = cacheByUserId.get(userId);
  if (existing?.html) {
    return Promise.resolve(existing.html);
  }
  if (existing?.promise) {
    return existing.promise;
  }

  const promise = buildPartialReportHtml(userId)
    .then((html) => {
      cacheByUserId.set(userId, { html });
      return html;
    })
    .catch((err: unknown) => {
      // Drop failed in-flight entry so retry never reuses a rejected promise.
      const current = cacheByUserId.get(userId);
      if (current?.promise === promise) {
        cacheByUserId.delete(userId);
      }
      throw err instanceof Error ? err : new Error('Partial report generation failed');
    });

  cacheByUserId.set(userId, { promise });
  return promise;
}
