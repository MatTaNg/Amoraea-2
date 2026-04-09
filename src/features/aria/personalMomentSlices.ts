import { isMoment5AppreciationAssistantAnchor } from './probeAndScoringUtils';

export type TranscriptTurn = { role: string; content: string };

function findMoment5AssistantStartIndex(transcript: TranscriptTurn[], m4Start: number): number {
  const from = m4Start >= 0 ? m4Start : 0;
  for (let i = from; i < transcript.length; i++) {
    const m = transcript[i];
    if (m.role === 'assistant' && isMoment5AppreciationAssistantAnchor(m.content ?? '')) return i;
  }
  if (m4Start >= 0) {
    for (let i = 0; i < m4Start; i++) {
      const m = transcript[i];
      if (m.role === 'assistant' && isMoment5AppreciationAssistantAnchor(m.content ?? '')) return i;
    }
  }
  return -1;
}

export function inferPersonalMomentSlices(transcript: TranscriptTurn[]): {
  moment4: TranscriptTurn[];
  moment5: TranscriptTurn[];
  m4Start: number;
  m5Start: number;
} {
  const m4Start = transcript.findIndex(
    (m) =>
      m.role === 'assistant' &&
      /held a grudge|really didn't like|last two questions are more personal/i.test(m.content ?? '')
  );
  const m5Start = findMoment5AssistantStartIndex(transcript, m4Start);
  const moment4 =
    m4Start >= 0
      ? transcript
          .slice(m4Start, m5Start > m4Start ? m5Start : transcript.length)
          .filter((m) => m.role === 'assistant' || m.role === 'user')
      : [];
  const moment5 =
    m5Start >= 0
      ? transcript.slice(m5Start).filter((m) => m.role === 'assistant' || m.role === 'user')
      : [];
  return { moment4, moment5, m4Start, m5Start };
}
