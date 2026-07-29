import { shouldHoldBoundaryWarmStreamingLine } from '@features/aria/interviewerFrameworkPrompt';

export type ParallelStreamingTtsState = {
  active: boolean;
  cancelRequested: boolean;
  accumulatedFullText: string;
  /** Sentences fully spoken before a tab interrupt (parallel Claude SSE TTS). */
  spokenCompleteText: string;
  /** Sophie perspective Q passed to parallel-stream TTS (set at question_delivered, before spokenCompleteText). */
  s3SophiePerspectiveProbeDeliveredThisStream: boolean;
};

export function createInitialParallelStreamingTtsState(): ParallelStreamingTtsState {
  return {
    active: false,
    cancelRequested: false,
    accumulatedFullText: '',
    spokenCompleteText: '',
    s3SophiePerspectiveProbeDeliveredThisStream: false,
  };
}

/** Merge streamed sentences into one ElevenLabs request to avoid fetch/play gaps at every period. */
export const PARALLEL_TTS_BATCH_MIN_CHARS = 180;
export const PARALLEL_TTS_BATCH_MAX_CHARS = 480;
/** Do not flush mid-vignette on `.` until this length — keeps S2→S3 intros in one MP3 when possible. */
export const PARALLEL_TTS_BATCH_PERIOD_FLUSH_MIN_CHARS = 400;
/** Short acks (e.g. "Great work.") play immediately without waiting for a larger batch. */
export const PARALLEL_TTS_BATCH_SHORT_SENTENCE_MAX_CHARS = 52;

export function shouldFlushParallelTtsBatch(
  text: string,
  force: boolean,
  participantFirstName?: string,
): boolean {
  if (force) return text.trim().length > 0;
  const t = text.trim();
  if (!t) return false;
  if (shouldHoldBoundaryWarmStreamingLine(t, participantFirstName)) return false;
  if (/\?\s*$/.test(t)) return true;
  if (t.length >= PARALLEL_TTS_BATCH_MAX_CHARS) return true;
  if (t.length <= PARALLEL_TTS_BATCH_SHORT_SENTENCE_MAX_CHARS && /[.!]\s*$/.test(t)) return true;
  if (t.length >= PARALLEL_TTS_BATCH_PERIOD_FLUSH_MIN_CHARS && /[.!]\s*$/.test(t)) return true;
  return false;
}
