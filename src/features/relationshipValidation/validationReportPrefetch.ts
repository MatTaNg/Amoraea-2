import { buildValidationReportHtml } from './generateValidationReport';

type CacheEntry = {
  html?: string;
  promise?: Promise<string>;
};

const cacheByUserId = new Map<string, CacheEntry>();

export function getCachedValidationReportHtml(userId: string): string | null {
  return cacheByUserId.get(userId)?.html ?? null;
}

export function clearValidationReportCache(userId?: string): void {
  if (userId) {
    cacheByUserId.delete(userId);
    return;
  }
  cacheByUserId.clear();
}

export function prefetchValidationReport(userId: string): Promise<string> {
  const existing = cacheByUserId.get(userId);
  if (existing?.html) {
    return Promise.resolve(existing.html);
  }
  if (existing?.promise) {
    return existing.promise;
  }

  const promise = buildValidationReportHtml(userId)
    .then((html) => {
      cacheByUserId.set(userId, { html });
      return html;
    })
    .catch((err: unknown) => {
      cacheByUserId.delete(userId);
      throw err instanceof Error ? err : new Error('Validation report generation failed');
    });

  cacheByUserId.set(userId, { promise });
  return promise;
}
