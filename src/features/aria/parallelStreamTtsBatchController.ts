import { dedupeAdjacentBoundaryValidationsBeforeParticipantName } from '@features/aria/interviewerFrameworkPrompt';
import {
  PARALLEL_TTS_BATCH_MIN_CHARS,
  shouldFlushParallelTtsBatch,
} from '@features/aria/interviewParallelTtsBatch';
import { stripConsecutiveDuplicateSentencesWithinDraft } from '@features/aria/elongatingProbe';
import { fetchElevenLabsMpegArrayBuffer } from '@features/aria/utils/elevenLabsTtsFetch';

import type { EnqueueParallelStreamTtsUtterance } from './parallelStreamEnqueueTtsUtterance';
import type { ParallelStreamTtsPlaybackContext } from './parallelStreamTtsRuntimeState';

export type ParallelStreamTtsBatchController = {
  parallelTtsBatchDeduped: () => string;
  scheduleParallelTtsBatchPrefetch: () => void;
  flushParallelTtsBatch: (force: boolean) => void;
  appendToParallelTtsBatch: (spoken: string) => void;
};

export function createParallelStreamTtsBatchController(
  ctx: ParallelStreamTtsPlaybackContext,
  enqueueParallelTtsUtterance: EnqueueParallelStreamTtsUtterance,
): ParallelStreamTtsBatchController {
  const { params, state } = ctx;

  const parallelTtsBatchDeduped = () =>
    stripConsecutiveDuplicateSentencesWithinDraft(
      dedupeAdjacentBoundaryValidationsBeforeParticipantName(
        state.parallelTtsBatchBuffer.trim(),
        params.participantFirstNameForSpoken,
      ),
    );

  const scheduleParallelTtsBatchPrefetch = () => {
    const snap = parallelTtsBatchDeduped();
    if (snap.length < PARALLEL_TTS_BATCH_MIN_CHARS - 40) return;
    if (state.parallelTtsBatchPrefetch?.text === snap) return;
    state.parallelTtsBatchPrefetch = {
      text: snap,
      promise: fetchElevenLabsMpegArrayBuffer(snap).catch(() => null),
    };
  };

  const flushParallelTtsBatch = (force: boolean) => {
    const batch = parallelTtsBatchDeduped();
    if (!shouldFlushParallelTtsBatch(batch, force, params.participantFirstNameForSpoken)) return;
    const prefetch =
      state.parallelTtsBatchPrefetch?.text === batch ? state.parallelTtsBatchPrefetch.promise : null;
    state.parallelTtsBatchBuffer = '';
    state.parallelTtsBatchPrefetch = null;
    enqueueParallelTtsUtterance(batch, prefetch);
  };

  const appendToParallelTtsBatch = (spoken: string) => {
    params.textToParallelStream.spokenStarted = true;
    state.parallelTtsBatchBuffer = state.parallelTtsBatchBuffer
      ? `${state.parallelTtsBatchBuffer} ${spoken}`.trim()
      : spoken;
    scheduleParallelTtsBatchPrefetch();
    flushParallelTtsBatch(false);
  };

  return {
    parallelTtsBatchDeduped,
    scheduleParallelTtsBatchPrefetch,
    flushParallelTtsBatch,
    appendToParallelTtsBatch,
  };
}
