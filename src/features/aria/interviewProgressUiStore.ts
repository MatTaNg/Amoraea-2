import {
  interviewCompletionRatio,
  matchInterviewProgressStep,
  type InterviewProgressMoment,
} from '@features/aria/interviewProgressPresentation';

type MomentRef = { current: number };
type MomentsCompleteRef = {
  current: Partial<Record<InterviewProgressMoment, boolean>>;
};
type LastQuestionTextRef = { current: string };

export type InterviewProgressSnapshot = {
  ratio: number;
  percent: number;
};

const listeners = new Set<() => void>();

let momentRef: MomentRef | null = null;
let momentsCompleteRef: MomentsCompleteRef | null = null;
let lastQuestionTextRef: LastQuestionTextRef | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

const INITIAL_SNAPSHOT: InterviewProgressSnapshot = snapshotFrom({
  currentMoment: 1,
  momentsComplete: {},
});

let snapshot: InterviewProgressSnapshot = INITIAL_SNAPSHOT;

function snapshotFrom(input: {
  currentMoment: number;
  momentsComplete: Partial<Record<InterviewProgressMoment, boolean>>;
  lastQuestionText?: string;
}): InterviewProgressSnapshot {
  const ratio = interviewCompletionRatio(input);
  return { ratio, percent: Math.round(ratio * 100) };
}

function readLiveInput(): {
  currentMoment: number;
  momentsComplete: Partial<Record<InterviewProgressMoment, boolean>>;
  lastQuestionText: string;
} | null {
  if (!momentRef || !momentsCompleteRef) return null;
  return {
    currentMoment: momentRef.current,
    momentsComplete: momentsCompleteRef.current,
    lastQuestionText: lastQuestionTextRef?.current ?? '',
  };
}

function publishIfChanged(): void {
  const input = readLiveInput();
  const next = input ? snapshotFrom(input) : INITIAL_SNAPSHOT;
  const promptMatched =
    input != null && matchInterviewProgressStep(input.lastQuestionText) >= 0;
  if (!promptMatched && next.ratio < snapshot.ratio) return;
  if (next.percent === snapshot.percent && next.ratio === snapshot.ratio) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function ensurePolling(): void {
  if (pollTimer != null || listeners.size === 0) return;
  pollTimer = setInterval(publishIfChanged, 400);
}

function stopPollingIfIdle(): void {
  if (listeners.size > 0 || pollTimer == null) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

/** Live interview section refs. Progress UI reads these; section flags update in place. */
export function bindInterviewProgressSources(
  nextMomentRef: MomentRef,
  nextMomentsCompleteRef: MomentsCompleteRef,
  nextLastQuestionTextRef?: LastQuestionTextRef | null,
): () => void {
  momentRef = nextMomentRef;
  momentsCompleteRef = nextMomentsCompleteRef;
  lastQuestionTextRef = nextLastQuestionTextRef ?? null;
  publishIfChanged();
  return () => {
    if (momentRef !== nextMomentRef) return;
    momentRef = null;
    momentsCompleteRef = null;
    lastQuestionTextRef = null;
    snapshot = INITIAL_SNAPSHOT;
    listeners.forEach((listener) => listener());
  };
}

export function subscribeInterviewProgress(listener: () => void): () => void {
  listeners.add(listener);
  ensurePolling();
  publishIfChanged();
  return () => {
    listeners.delete(listener);
    stopPollingIfIdle();
  };
}

export function getInterviewProgressSnapshot(): InterviewProgressSnapshot {
  return snapshot;
}
