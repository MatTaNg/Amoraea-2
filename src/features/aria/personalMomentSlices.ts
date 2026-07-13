import { assistantTextLooksLikeMoment4HandoffLead } from './interviewTransitionBundles';
import { looksLikeMoment4GrudgePrompt } from './moment4ProbeLogic';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from './moment5ProbeCopy';
import { scoringSliceHasAssessableMoment5UserResponse } from './moment5ScoringGuard';
import {
  collectMoment5TaggedUserTurns,
  isMoment5TaggedUserTurn,
  readTranscriptTurnInterviewMoment,
} from './moment5TranscriptHelpers';
import {
  isMoment5AssistantAnchor,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
} from './probeAndScoringUtils';

export type TranscriptTurn = {
  role: string;
  content: string;
  interviewMoment?: number;
  interview_moment?: number;
  moment?: number;
};

function isMoment5SliceAssistantStart(content: string | null | undefined): boolean {
  return (
    isMoment5AssistantAnchor(content) ||
    transcriptAssistantContainsMoment5PrimaryConflictQuestion(content)
  );
}

function combinedUserWordCount(slice: TranscriptTurn[]): number {
  return slice
    .filter((m) => m.role === 'user')
    .map((m) => (m.content ?? '').trim())
    .filter(Boolean)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * Rebuild M5 scoring corpus from all user turns tagged moment 5, including assistant
 * follow-ups (resolution, accountability probe) between them.
 */
export function rebuildMoment5SliceFromTaggedUsers(transcript: TranscriptTurn[]): TranscriptTurn[] {
  const taggedIndices: number[] = [];
  for (let i = 0; i < transcript.length; i++) {
    if (isMoment5TaggedUserTurn(transcript[i])) taggedIndices.push(i);
  }
  if (taggedIndices.length === 0) return [];

  const firstTagged = taggedIndices[0]!;
  const lastTagged = taggedIndices[taggedIndices.length - 1]!;

  let anchorIdx = -1;
  for (let i = firstTagged - 1; i >= 0; i--) {
    const row = transcript[i];
    if (row?.role === 'assistant' && isMoment5SliceAssistantStart(row.content ?? '')) {
      anchorIdx = i;
      break;
    }
  }

  if (anchorIdx < 0) {
    const out: TranscriptTurn[] = [
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
    ];
    for (let t = 0; t < taggedIndices.length; t++) {
      const userIdx = taggedIndices[t]!;
      const rangeStart = t === 0 ? 0 : taggedIndices[t - 1]! + 1;
      for (let j = rangeStart; j < userIdx; j++) {
        const row = transcript[j];
        if (row?.role === 'assistant') out.push(row);
      }
      out.push(transcript[userIdx]!);
    }
    return out;
  }

  return transcript
    .slice(anchorIdx, lastTagged + 1)
    .filter((m) => m.role === 'assistant' || m.role === 'user');
}

function findMoment5AssistantStartIndex(transcript: TranscriptTurn[], m4Start: number): number {
  const from = m4Start >= 0 ? m4Start : 0;
  for (let i = from; i < transcript.length; i++) {
    const m = transcript[i];
    if (m.role === 'assistant' && isMoment5SliceAssistantStart(m.content ?? '')) return i;
  }
  if (m4Start >= 0) {
    for (let i = 0; i < m4Start; i++) {
      const m = transcript[i];
      if (m.role === 'assistant' && isMoment5SliceAssistantStart(m.content ?? '')) return i;
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
  if (lastUser < 0) return [];
  return filtered.slice(0, lastUser + 1);
}

/**
 * Moment 5 scoring corpus: prefer anchor-inferred slice; fall back to `interviewMoment: 5` user turns
 * when the assistant anchor was paraphrased or missing from the stored transcript.
 */
export function resolveMoment5ScoringSlice(transcript: TranscriptTurn[]): TranscriptTurn[] {
  const taggedRebuild = trimMoment5SliceForScoring(rebuildMoment5SliceFromTaggedUsers(transcript));
  const { moment5 } = inferPersonalMomentSlices(transcript);
  const inferred = trimMoment5SliceForScoring(moment5);

  const candidates: TranscriptTurn[][] = [];
  if (taggedRebuild.length > 0 && scoringSliceHasAssessableMoment5UserResponse(taggedRebuild)) {
    candidates.push(taggedRebuild);
  }
  if (inferred.length > 0 && scoringSliceHasAssessableMoment5UserResponse(inferred)) {
    candidates.push(inferred);
  }

  if (candidates.length > 0) {
    return [...candidates].sort((a, b) => {
      const aUsers = a.filter((m) => m.role === 'user').length;
      const bUsers = b.filter((m) => m.role === 'user').length;
      if (bUsers !== aUsers) return bUsers - aUsers;
      return combinedUserWordCount(b) - combinedUserWordCount(a);
    })[0]!;
  }

  if (collectMoment5TaggedUserTurns(transcript).length > 0) {
    return taggedRebuild.length > 0 ? taggedRebuild : inferred;
  }

  const taggedUserIdx = transcript.findIndex(
    (m) => m.role === 'user' && readTranscriptTurnInterviewMoment(m) === 5 && (m.content ?? '').trim().length > 0,
  );
  if (taggedUserIdx < 0) return inferred;

  let anchorIdx = -1;
  for (let i = taggedUserIdx - 1; i >= 0; i--) {
    const row = transcript[i];
    if (row?.role === 'assistant' && isMoment5SliceAssistantStart(row.content ?? '')) {
      anchorIdx = i;
      break;
    }
  }

  const rebuilt: TranscriptTurn[] = [];
  if (anchorIdx >= 0) {
    rebuilt.push(transcript[anchorIdx]!);
  } else {
    rebuilt.push({ role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT });
  }
  for (let i = anchorIdx >= 0 ? anchorIdx + 1 : 0; i < transcript.length; i++) {
    const row = transcript[i];
    if (!row) continue;
    if (row.role === 'user' && readTranscriptTurnInterviewMoment(row) === 5) rebuilt.push(row);
  }
  const trimmed = trimMoment5SliceForScoring(rebuilt);
  return trimmed.length > 0 ? trimmed : inferred;
}
