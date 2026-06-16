import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearValidationReportCache,
  getCachedValidationReportHtml,
  prefetchValidationReport,
} from './validationReportPrefetch';

export type ValidationReportPrefetchStatus = 'idle' | 'loading' | 'ready' | 'error';

export function usePrefetchedValidationReport(
  userId: string | undefined,
  reportReady: boolean,
  refreshKey?: string,
) {
  const [status, setStatus] = useState<ValidationReportPrefetchStatus>(() => {
    if (!userId || !reportReady) return 'idle';
    return getCachedValidationReportHtml(userId) ? 'ready' : 'loading';
  });
  const [html, setHtml] = useState<string | null>(() =>
    userId && reportReady ? getCachedValidationReportHtml(userId) : null,
  );
  const prevRefreshKey = useRef(refreshKey);

  useEffect(() => {
    if (!userId || refreshKey == null || prevRefreshKey.current === refreshKey) return;
    clearValidationReportCache(userId);
    prevRefreshKey.current = refreshKey;
    setHtml(null);
    setStatus(reportReady ? 'loading' : 'idle');
  }, [userId, refreshKey, reportReady]);

  useEffect(() => {
    if (!userId || !reportReady) {
      setStatus('idle');
      setHtml(null);
      return;
    }

    const cached = getCachedValidationReportHtml(userId);
    if (cached) {
      setHtml(cached);
      setStatus('ready');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setHtml(null);

    prefetchValidationReport(userId)
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
  }, [userId, reportReady, refreshKey]);

  const retry = useCallback(() => {
    if (!userId || !reportReady) return;
    clearValidationReportCache(userId);
    setStatus('loading');
    setHtml(null);
    void prefetchValidationReport(userId)
      .then((reportHtml) => {
        setHtml(reportHtml);
        setStatus('ready');
      })
      .catch(() => {
        setStatus('error');
      });
  }, [userId, reportReady]);

  const ensureHtml = useCallback(async (): Promise<string> => {
    if (!userId) {
      throw new Error('User id required');
    }
    if (!reportReady) {
      throw new Error('Validation results not ready');
    }
    if (html) {
      return html;
    }
    const reportHtml = await prefetchValidationReport(userId);
    setHtml(reportHtml);
    setStatus('ready');
    return reportHtml;
  }, [userId, reportReady, html]);

  return { status, html, retry, ensureHtml };
}
