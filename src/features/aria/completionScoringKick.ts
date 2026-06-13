/**
 * Module-level completion scoring kick — stream handlers import this directly so
 * scoring is not blocked by React ref assignment order at the bottom of AriaScreen.
 */

export type CompletionTranscriptMsg = { role: string; content: string };
type ScoreInterviewFn = (messages: CompletionTranscriptMsg[]) => Promise<void>;

let registeredScoreInterview: ScoreInterviewFn | null = null;
let scoringInFlight = false;
let scoringAttempted = false;
/** Set when we already navigated to InterviewComplete so scoreInterview does not hand off twice. */
let psychometricsInterviewHandoffIssued = false;

export function registerScoreInterviewForCompletion(fn: ScoreInterviewFn | null): void {
  registeredScoreInterview = fn;
}

export function isCompletionScoringInFlight(): boolean {
  return scoringInFlight;
}

export function wasCompletionScoringAttempted(): boolean {
  return scoringAttempted;
}

export function markCompletionScoringInFlight(inFlight: boolean): void {
  scoringInFlight = inFlight;
}

export function resetCompletionScoringSession(): void {
  scoringAttempted = false;
  scoringInFlight = false;
  psychometricsInterviewHandoffIssued = false;
}

export function markPsychometricsInterviewHandoffIssued(): void {
  psychometricsInterviewHandoffIssued = true;
}

export function wasPsychometricsInterviewHandoffIssued(): boolean {
  return psychometricsInterviewHandoffIssued;
}

/** Start client M4/M5 + deferred completion scoring. Safe to call from stream handlers. */
export function kickCompletionScoring(source: string, transcript: CompletionTranscriptMsg[]): boolean {
  if (!transcript?.length) return false;
  if (scoringInFlight) return false;
  const scoreFn = registeredScoreInterview;
  if (!scoreFn) return false;
  scoringAttempted = true;
  void scoreFn(transcript).catch(() => {});
  return true;
}
