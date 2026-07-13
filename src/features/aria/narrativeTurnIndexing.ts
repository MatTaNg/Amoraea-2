import { readTranscriptTurnInterviewMoment } from '@features/aria/moment5TranscriptHelpers';
import { sliceTranscriptForScenario3Scoring } from '@features/aria/scenarioCTranscriptSlicing';

/** Transcript row for narrative / reflection composers (not scoring). */
export type NarrativeTurnMessage = {
  role: string;
  content?: string | null;
  scenarioNumber?: number;
  interviewMoment?: number;
  interview_moment?: number;
  moment?: number;
};

/**
 * Last user answer tagged to a specific interview moment (newest matching turn).
 * Prefer this over "last user in transcript" from Scenario 3 onward — personal moments
 * still carry `scenarioNumber: 3` but use `interviewMoment` 4 or 5.
 */
export function resolveLastUserAnswerForInterviewMoment(
  messages: readonly NarrativeTurnMessage[],
  moment: number,
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'user') continue;
    if (readTranscriptTurnInterviewMoment(m) !== moment) continue;
    const content = String(m.content ?? '').trim();
    if (content) return content;
  }
  return '';
}

/**
 * User corpus for scenario boundary reflections — scoped by scenarioNumber AND interviewMoment
 * so Moment 4/5 answers (still tagged scenarioNumber 3) never pollute Scenario 3 wrap-ups.
 */
export function aggregateScenarioUserTurnsForNarrative(
  messages: readonly NarrativeTurnMessage[],
  scenario: 1 | 2 | 3,
): string {
  const maxMoment = scenario;
  const scoped = scenario === 3 ? sliceTranscriptForScenario3Scoring(messages) : messages;
  const parts: string[] = [];
  for (const m of scoped) {
    if (m.role !== 'user') continue;
    if (m.scenarioNumber !== scenario) continue;
    const interviewMoment = readTranscriptTurnInterviewMoment(m);
    if (interviewMoment !== undefined && interviewMoment > maxMoment) continue;
    if (interviewMoment !== undefined && interviewMoment >= 4) continue;
    const content = String(m.content ?? '').trim();
    if (content) parts.push(content);
  }
  return parts.join('\n').trim();
}

/** Walk backward for the newest in-scenario user turn, skipping later personal moments. */
export function lastScenarioFictionUserAnswer(
  messages: readonly NarrativeTurnMessage[],
  scenario: 1 | 2 | 3,
): string {
  const maxMoment = scenario;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'user') continue;
    const interviewMoment = readTranscriptTurnInterviewMoment(m);
    if (interviewMoment !== undefined && interviewMoment > maxMoment) continue;
    if (interviewMoment !== undefined && interviewMoment >= 4) continue;
    const sn = m.scenarioNumber;
    if (sn !== undefined && sn > scenario) continue;
    if (sn !== undefined && sn < scenario) break;
    const content = String(m.content ?? '').trim();
    if (content) return content;
  }
  return '';
}
