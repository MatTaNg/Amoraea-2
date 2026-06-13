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

  useEffect(() => {
    if (!userId || !scoringReady) {
      setStatus('idle');
      setHtml(null);
      return;
    }

    const cached = getCachedPartialReportHtml(userId);
    if (cached) {
      setHtml(cached);
      setStatus('ready');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setHtml(null);

    prefetchPartialReport(userId)
      .then((reportHtml) => {
        if (cancelled) return;
        setHtml(reportHtml);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [userId, scoringReady]);

  const retry = useCallback(() => {
    if (!userId || !scoringReady) return;
    clearPartialReportCache(userId);
    setStatus('loading');
    setHtml(null);
    void prefetchPartialReport(userId)
      .then((reportHtml) => {
        setHtml(reportHtml);
        setStatus('ready');
      })
      .catch(() => {
        setStatus('error');
      });
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
    return reportHtml;
  }, [userId, scoringReady, html]);

  return { status, html, retry, ensureHtml };
}
