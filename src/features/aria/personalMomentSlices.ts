import { assistantTextLooksLikeMoment4HandoffLead } from './interviewTransitionBundles';
import { looksLikeMoment4GrudgePrompt } from './moment4ProbeLogic';
import { isMoment5AssistantAnchor } from './probeAndScoringUtils';

export type TranscriptTurn = { role: string; content: string; interviewMoment?: number };

function findMoment5AssistantStartIndex(transcript: TranscriptTurn[], m4Start: number): number {
  const from = m4Start >= 0 ? m4Start : 0;
  for (let i = from; i < transcript.length; i++) {
    const m = transcript[i];
    if (m.role === 'assistant' && isMoment5AssistantAnchor(m.content ?? '')) return i;
  }
  if (m4Start >= 0) {
    for (let i = 0; i < m4Start; i++) {
      const m = transcript[i];
      if (m.role === 'assistant' && isMoment5AssistantAnchor(m.content ?? '')) return i;
    }
  }
  return -1;
}

/** First assistant index that begins the Moment 4 segment (tagged, grudge prompt, or S3→M4 handoff lead). */
export function findMoment4AssistantStartIndex(transcript: TranscriptTurn[]): number {
  for (let i = 0; i < transcript.length; i++) {
    const m = transcript[i];
    if (m.role !== 'assistant') continue;
    if (typeof m.interviewMoment === 'number' && m.interviewMoment === 4) return i;
  }
  for (let i = 0; i < transcript.length; i++) {
    const m = transcript[i];
    if (m.role === 'assistant' && looksLikeMoment4GrudgePrompt(m.content ?? '')) return i;
  }
  for (let i = 0; i < transcript.length; i++) {
    const m = transcript[i];
    if (m.role === 'assistant' && assistantTextLooksLikeMoment4HandoffLead(m.content ?? '')) return i;
  }
  for (let i = 0; i < transcript.length; i++) {
    const m = transcript[i];
    if (
      m.role === 'assistant' &&
      /held a grudge|really didn't like|last two questions are more personal/i.test(m.content ?? '')
    ) {
      return i;
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
  const m4Start = findMoment4AssistantStartIndex(transcript);
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

const EPHEMERAL_M5_ASSISTANT_RE =
  /didn'?t catch any speech|tap the mic when you'?re ready|good work getting through all of this/i;

/**
 * Drop mic-retry and closing-assistant lines from the Moment 5 scoring corpus so the model is not scored
 * on post-answer wrap-up or empty-turn prompts (common when resume injects a retry before the real M5 answer).
 */
export function trimMoment5SliceForScoring(slice: TranscriptTurn[]): TranscriptTurn[] {
  const filtered = slice.filter((m) => {
    if (m.role !== 'assistant') return true;
    const c = (m.content ?? '').trim();
    if (!c) return false;
    return !EPHEMERAL_M5_ASSISTANT_RE.test(c);
  });
  let lastUser = -1;
  for (let i = filtered.length - 1; i >= 0; i--) {
    if (filtered[i].role === 'user') {
      lastUser = i;
      break;
    }
  }
  return lastUser >= 0 ? filtered.slice(0, lastUser + 1) : filtered;
}
