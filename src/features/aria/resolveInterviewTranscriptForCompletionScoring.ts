import { compactInterviewTranscriptTurns, type TranscriptTurn } from '@features/aria/interviewTranscriptDedup';
import {
  moment5ScoringAllowed,
  scoringSliceHasAssessableMoment5UserResponse,
  transcriptEligibleForMoment5Scoring,
} from '@features/aria/moment5ScoringGuard';
import {
  collectMoment5TaggedUserTurns,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
} from '@features/aria/moment5TranscriptHelpers';
import { resolveMoment5ScoringSlice } from '@features/aria/personalMomentSlices';

export type CompletionScoringTranscriptTurn = {
  role: string;
  content?: string | null;
  interviewMoment?: number;
  scenarioNumber?: number;
  isWelcomeBack?: boolean;
};

function userAssistantOnly<T extends CompletionScoringTranscriptTurn>(rows: readonly T[]): T[] {
  return rows.filter((m) => m.role === 'user' || m.role === 'assistant');
}

/** Higher = better corpus for deferred M4/M5 scoring at interview close. */
export function scoreCompletionTranscriptM5Richness(
  transcript: readonly CompletionScoringTranscriptTurn[],
): number {
  const slice = resolveMoment5ScoringSlice(transcript as TranscriptTurn[]);
  let score = 0;
  if (moment5ScoringAllowed(transcript, slice)) score += 10_000;
  else if (transcriptEligibleForMoment5Scoring(transcript)) score += 5_000;
  else if (scoringSliceHasAssessableMoment5UserResponse(slice)) score += 2_500;
  score += collectMoment5TaggedUserTurns(transcript).length * 100;
  score += slice.filter((m) => m.role === 'user').length * 25;
  if (
    transcript.some(
      (m) =>
        m.role === 'assistant' &&
        transcriptAssistantContainsMoment5PrimaryConflictQuestion(m.content ?? ''),
    )
  ) {
    score += 200;
  }
  score += transcript.length;
  return score;
}

/**
 * Pick the richest user/assistant transcript for completion scoring.
 * `currentMessagesRef` can lag `updatedMessages` after post-Claude persist — prefer the
 * candidate that satisfies Moment 5 scoring guards when they diverge.
 */
export function resolveInterviewTranscriptForCompletionScoring(
  ...candidates: readonly (readonly CompletionScoringTranscriptTurn[] | null | undefined)[]
): CompletionScoringTranscriptTurn[] {
  const nonEmpty = candidates
    .filter((c): c is readonly CompletionScoringTranscriptTurn[] => Array.isArray(c) && c.length > 0)
    .map(userAssistantOnly);
  if (nonEmpty.length === 0) return [];
  let best = nonEmpty[0]!;
  let bestScore = scoreCompletionTranscriptM5Richness(best);
  for (let i = 1; i < nonEmpty.length; i++) {
    const cand = nonEmpty[i]!;
    const candScore = scoreCompletionTranscriptM5Richness(cand);
    if (candScore > bestScore) {
      best = cand;
      bestScore = candScore;
    }
  }
  return compactInterviewTranscriptTurns([...best]);
}

export type Moment5ScoringGuardDiagnostics = {
  allowed: boolean;
  transcriptEligible: boolean;
  sliceHasAssessableUser: boolean;
  taggedM5UserTurns: number;
  sliceUserTurns: number;
  hasM5PrimaryAnchor: boolean;
  skipReason: string | null;
};

export function diagnoseMoment5ScoringGuard(
  transcript: readonly CompletionScoringTranscriptTurn[] | null | undefined,
  scoringSlice: readonly { role?: string; content?: string | null }[] | null | undefined,
): Moment5ScoringGuardDiagnostics {
  const transcriptEligible = transcriptEligibleForMoment5Scoring(transcript);
  const sliceHasAssessableUser = scoringSliceHasAssessableMoment5UserResponse(scoringSlice);
  const allowed = transcriptEligible && sliceHasAssessableUser;
  let skipReason: string | null = null;
  if (!allowed) {
    if (!transcriptEligible && !sliceHasAssessableUser) {
      skipReason = 'transcript_ineligible_and_slice_not_assessable';
    } else if (!transcriptEligible) {
      skipReason = 'transcript_ineligible_for_moment5';
    } else {
      skipReason = 'scoring_slice_not_assessable';
    }
  }
  return {
    allowed,
    transcriptEligible,
    sliceHasAssessableUser,
    taggedM5UserTurns: collectMoment5TaggedUserTurns(transcript ?? []).length,
    sliceUserTurns: (scoringSlice ?? []).filter((m) => m.role === 'user').length,
    hasM5PrimaryAnchor: Array.isArray(transcript)
      ? transcript.some(
          (m) =>
            m.role === 'assistant' &&
            transcriptAssistantContainsMoment5PrimaryConflictQuestion(m.content ?? ''),
        )
      : false,
    skipReason,
  };
}
