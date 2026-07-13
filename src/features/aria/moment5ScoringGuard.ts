import { MIN_FIRST_SUBSTANTIVE_RESPONSE_WORDS } from '@features/interview/interviewAttemptLifecycle';
import { countInterviewWords } from './moment4SpecificityFollowUp';
import {
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
  type Moment5TranscriptTurn,
  readTranscriptTurnInterviewMoment,
} from './moment5TranscriptHelpers';

export const MIN_MOMENT5_SCORING_USER_CHARS = 5;

export type Moment5ScoringGuardContext = {
  transcript?: readonly Moment5TranscriptTurn[] | null;
  scoringSlice?: readonly { role?: string; content?: string | null }[] | null;
};

export function moment5UserTurnTextIsAssessable(content: string | null | undefined): boolean {
  const trimmed = (content ?? '').trim();
  if (trimmed.length < MIN_MOMENT5_SCORING_USER_CHARS) return false;
  return countInterviewWords(trimmed) >= MIN_FIRST_SUBSTANTIVE_RESPONSE_WORDS;
}

export function scoringSliceHasAssessableMoment5UserResponse(
  slice: readonly { role?: string; content?: string | null }[] | null | undefined,
): boolean {
  if (!slice?.length) return false;
  for (const turn of slice) {
    if (turn.role !== 'user') continue;
    if (moment5UserTurnTextIsAssessable(turn.content)) return true;
  }
  return false;
}

/**
 * True when the full transcript contains a substantive Moment 5 user answer — tagged `interviewMoment: 5`
 * or positioned after the primary conflict question (skipping resolution follow-up assistant lines).
 */
export function transcriptEligibleForMoment5Scoring(
  transcript: readonly Moment5TranscriptTurn[] | null | undefined,
): boolean {
  if (!Array.isArray(transcript)) return false;

  for (const turn of transcript) {
    if (!turn || typeof turn !== 'object') continue;
    if (
      turn.role === 'user' &&
      readTranscriptTurnInterviewMoment(turn) === 5 &&
      moment5UserTurnTextIsAssessable(turn.content)
    ) {
      return true;
    }
  }

  for (let i = 0; i < transcript.length; i++) {
    const row = transcript[i];
    if (!row || typeof row !== 'object') continue;
    if (row.role !== 'assistant') continue;
    if (!transcriptAssistantContainsMoment5PrimaryConflictQuestion(row.content)) continue;
    // Keep scanning after brief/filler user turns — a later substantive answer (or probe
    // response) still makes the transcript eligible for Moment 5 scoring.
    for (let j = i + 1; j < transcript.length; j++) {
      const next = transcript[j];
      if (!next || typeof next !== 'object') continue;
      if (next.role === 'assistant') continue;
      if (next.role === 'user' && moment5UserTurnTextIsAssessable(next.content)) return true;
    }
  }

  return false;
}

export function moment5ScoringAllowed(
  transcript: readonly Moment5TranscriptTurn[] | null | undefined,
  scoringSlice: readonly { role?: string; content?: string | null }[] | null | undefined,
): boolean {
  return (
    transcriptEligibleForMoment5Scoring(transcript) &&
    scoringSliceHasAssessableMoment5UserResponse(scoringSlice)
  );
}

/** True when a substantive Moment 5 user answer exists — required before scoring or recovery salvage. */
export function moment5HasAssessableUserResponse(ctx?: Moment5ScoringGuardContext): boolean {
  if (!ctx) return false;
  return moment5ScoringAllowed(ctx.transcript, ctx.scoringSlice);
}

/** @deprecated Use {@link moment5HasAssessableUserResponse} */
export const moment5RecoveryScoringAllowed = moment5HasAssessableUserResponse;
