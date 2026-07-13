import type { ComputeGateResultOptions } from '@features/aria/computeGateResultCore';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import { INTERVIEW_MARKER_IDS } from '@features/aria/interviewMarkers';
import { computeSkipPenaltyGateComputation } from '@features/aria/interviewSkipPenalties';

export const FALLBACK_MARKER_SCORES_ALL_MARKERS: Record<string, number> = Object.fromEntries(
  INTERVIEW_MARKER_IDS.map((id) => [id, 7]),
) as Record<string, number>;

export function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

export function messageLooksLikeScoreCard(msg: { role?: string; content?: string; isScoreCard?: boolean }): boolean {
  if (msg.isScoreCard) return true;
  const t = msg.content ?? '';
  return t.includes('── Scenario ') && /\d\/10/.test(t);
}

export function attachSkipPenaltyGateOptions(skipConfirmedCount: number): Pick<
  ComputeGateResultOptions,
  'skipPenaltyTotal' | 'skipAutoFail'
> & {
  skipBreakdown: NonNullable<InterviewResults['skipBreakdown']>;
} {
  const c = computeSkipPenaltyGateComputation(skipConfirmedCount);
  return {
    skipPenaltyTotal: c.skipPenaltyTotal,
    skipAutoFail: c.skipAutoFail,
    skipBreakdown: {
      skips_taken: c.skips_taken,
      skip_penalties: c.skip_penalties,
      skip_penalty_total: c.skip_penalty_total,
    },
  };
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  if (typeof btoa === 'function') return btoa(binary);
  return '';
}

export function newInterviewSessionId(userId: string): string {
  return `${userId || 'anon'}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function classifyInterviewQuestionType(
  text: string,
): 'analysis' | 'repair' | 'probe' | 'personal' | 'unknown' {
  const t = (text ?? '').toLowerCase();
  if (!t.trim()) return 'unknown';
  if (/personal|tell me about yourself|your childhood|private|intimate/.test(t)) return 'personal';
  if (/tell me more|what exactly|can you give an example|go deeper/.test(t)) return 'probe';
  if (/sorry|apolog|repair|make up|fix this|make amends/.test(t)) return 'repair';
  if (/score|pillar|evidence|pattern across|marker/.test(t)) return 'analysis';
  return 'unknown';
}
