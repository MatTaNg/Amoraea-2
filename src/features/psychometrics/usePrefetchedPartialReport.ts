import { useCallback, useEffect, useState } from 'react';
import {
  clearPartialReportCache,
  getCachedPartialReportHtml,
  prefetchPartialReport,
} from './partialReportPrefetch';

export type PartialReportPrefetchStatus = 'idle' | 'loading' | 'ready' | 'error';

export function usePrefetchedPartialReport(userId: string | undefined, scoringReady: boolean) {
  const [status, setStatus] = useState<PartialReportPrefetchStatus>(() => {
    if (!userId || !scoringReady) return 'idle';
    return getCachedPartialReportHtml(userId) ? 'ready' : 'loading';
  });
  const [html, setHtml] = useState<string | null>(() =>
    userId && scoringReady ? getCachedPartialReportHtml(userId) : null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** Bumped on retry so the effect always re-runs (avoids a no-op when cache/in-flight state is sticky). */
  const [generationId, setGenerationId] = useState(0);

  useEffect(() => {
    if (!userId || !scoringReady) {
      setStatus('idle');
      setHtml(null);
      setErrorMessage(null);
      return;
    }

    if (generationId === 0) {
      const cached = getCachedPartialReportHtml(userId);
      if (cached) {
        setHtml(cached);
        setStatus('ready');
        setErrorMessage(null);
        return;
      }
    }

    let cancelled = false;
    setStatus('loading');
    setHtml(null);
    setErrorMessage(null);

    prefetchPartialReport(userId)
      .then((reportHtml) => {
        if (cancelled) return;
        setHtml(reportHtml);
        setStatus('ready');
        setErrorMessage(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error && err.message.trim()
            ? err.message.trim()
            : 'Partial report generation failed';
        console.error('[PartialReport] prefetch failed:', message, err);
        setStatus('error');
        setErrorMessage(message);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, scoringReady, generationId]);

  const retry = useCallback(() => {
    if (!userId || !scoringReady) {
      console.warn('[PartialReport] retry skipped', { userId: Boolean(userId), scoringReady });
      return;
    }
    clearPartialReportCache(userId);
    setStatus('loading');
    setHtml(null);
    setErrorMessage(null);
    setGenerationId((n) => n + 1);
  }, [userId, scoringReady]);

  const ensureHtml = useCallback(async (): Promise<string> => {
    if (!userId) {
      throw new Error('User id required');
    }
    if (!scoringReady) {
      throw new Error('Interview scores not ready');
    }
    if (html) {
      return html;
    }
    const reportHtml = await prefetchPartialReport(userId);
    setHtml(reportHtml);
    setStatus('ready');
    setErrorMessage(null);
    return reportHtml;
  }, [userId, scoringReady, html]);

  return { status, html, errorMessage, retry, ensureHtml };
}
