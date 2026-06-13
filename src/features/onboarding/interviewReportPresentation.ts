import type { InterviewReportAttempt } from './loadInterviewReportAttempt';

export function readAiReasoningString(
  ai: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  const v = ai?.[key];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

export function readAiReasoningStringArray(
  ai: Record<string, unknown> | null | undefined,
  key: string,
): string[] {
  const v = ai?.[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
}

export function defaultPartialSummary(attempt: InterviewReportAttempt): string {
  const fromAi = readAiReasoningString(attempt.ai_reasoning, 'overall_summary');
  if (fromAi && !attempt.reasoning_pending) return fromAi;
  return 'Your interview is complete. Your full analysis is being prepared.';
}

export function psychometricContributionSummary(attempt: InterviewReportAttempt): {
  tone: 'positive' | 'neutral' | 'growth';
  text: string;
} {
  const modifier =
    attempt.corrected_psychometric_modifier ?? attempt.psychometric_modifier_applied ?? 0;
  if (modifier >= 0.15) {
    return {
      tone: 'positive',
      text: 'Your assessment results strengthened your profile.',
    };
  }
  if (modifier <= -0.15) {
    return {
      tone: 'growth',
      text: 'Some areas of your assessment indicated opportunities for growth.',
    };
  }
  return {
    tone: 'neutral',
    text: 'Your assessment results were factored into your overall profile.',
  };
}

export function formatPillarScoreDisplay(score: number | null): string {
  if (score == null || !Number.isFinite(score)) return '—';
  return `${Math.round(score * 10) / 10}`;
}
