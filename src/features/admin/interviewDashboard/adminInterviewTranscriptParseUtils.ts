import type { LiveTranscriptMsg } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export function parseUserTranscript(raw: unknown): LiveTranscriptMsg[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as LiveTranscriptMsg[];
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? (p as LiveTranscriptMsg[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Best-effort scenario indicator from live transcript message tags. */
export function inferLatestScenarioFromTranscript(lines: LiveTranscriptMsg[]): number | null {
  let max: number | null = null;
  for (const m of lines) {
    const n = m.scenarioNumber;
    if (typeof n === 'number' && n >= 1 && n <= 3) {
      max = max == null ? n : Math.max(max, n);
    }
  }
  return max;
}
