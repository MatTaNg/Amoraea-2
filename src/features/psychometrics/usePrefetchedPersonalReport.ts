import { useCallback, useEffect, useState } from 'react';
import {
  getCachedPersonalReportHtml,
  prefetchPersonalReport,
  clearPersonalReportCache,
} from './personalReportPrefetch';

export type PersonalReportPrefetchStatus = 'loading' | 'ready' | 'error';

export function usePrefetchedPersonalReport(userId: string | undefined) {
  const [status, setStatus] = useState<PersonalReportPrefetchStatus>(() =>
    userId && getCachedPersonalReportHtml(userId) ? 'ready' : 'loading',
  );
  const [html, setHtml] = useState<string | null>(() =>
    userId ? getCachedPersonalReportHtml(userId) : null,
  );

  useEffect(() => {
    if (!userId) {
      setStatus('loading');
      setHtml(null);
      return;
    }

    const cached = getCachedPersonalReportHtml(userId);
    if (cached) {
      setHtml(cached);
      setStatus('ready');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setHtml(null);

    prefetchPersonalReport(userId)
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
  }, [userId]);

  const retry = useCallback(() => {
    if (!userId) return;
    clearPersonalReportCache(userId);
    setStatus('loading');
    setHtml(null);
    void prefetchPersonalReport(userId)
      .then((reportHtml) => {
        setHtml(reportHtml);
        setStatus('ready');
      })
      .catch(() => {
        setStatus('error');
      });
  }, [userId]);

  const ensureHtml = useCallback(async (): Promise<string> => {
    if (!userId) {
      throw new Error('User id required');
    }
    if (html) {
      return html;
    }
    const reportHtml = await prefetchPersonalReport(userId);
    setHtml(reportHtml);
    setStatus('ready');
    return reportHtml;
  }, [userId, html]);

  return { status, html, retry, ensureHtml };
}
