import { buildPersonalReportHtml } from './generateReport';

type CacheEntry = {
  html?: string;
  promise?: Promise<string>;
  error?: Error;
};

const cacheByUserId = new Map<string, CacheEntry>();

export function getCachedPersonalReportHtml(userId: string): string | null {
  return cacheByUserId.get(userId)?.html ?? null;
}

export function clearPersonalReportCache(userId?: string): void {
  if (userId) {
    cacheByUserId.delete(userId);
    return;
  }
  cacheByUserId.clear();
}

/** Starts (or returns) in-flight generation; resolves to branded report HTML. */
export function prefetchPersonalReport(userId: string): Promise<string> {
  const existing = cacheByUserId.get(userId);
  if (existing?.html) {
    return Promise.resolve(existing.html);
  }
  if (existing?.promise) {
    return existing.promise;
  }

  const promise = buildPersonalReportHtml(userId)
    .then((html) => {
      cacheByUserId.set(userId, { html });
      return html;
    })
    .catch((err: unknown) => {
      const error = err instanceof Error ? err : new Error('Report generation failed');
      cacheByUserId.delete(userId);
      throw error;
    });

  cacheByUserId.set(userId, { promise });
  return promise;
}
