import type { MaybeQueueParallelStreamSentenceForTts } from './parallelStreamMaybeQueueSentenceForTts';
import type { ParallelStreamTtsPlaybackContext } from './parallelStreamTtsRuntimeState';

export function createParallelStreamProcessTextDelta(
  ctx: ParallelStreamTtsPlaybackContext,
  maybeQueueSentenceForTts: MaybeQueueParallelStreamSentenceForTts,
) {
  const { deps, params, state } = ctx;

  return (deltaText: string) => {
    if (!deltaText) return;
    params.textToParallelStream.full += deltaText;
    deps.parallelStreamingTtsRef.current.accumulatedFullText = params.textToParallelStream.full;
    if (params.metaFrustrationFirstSignalBuffered) return;
    state.sentenceBuffer += deltaText;
    for (;;) {
      const m = state.sentenceBuffer.match(/[.!?](?:\s|$)/);
      if (!m || m.index == null) break;
      const cut = m.index + m[0].length;
      const sentence = state.sentenceBuffer.slice(0, cut);
      state.sentenceBuffer = state.sentenceBuffer.slice(cut);
      maybeQueueSentenceForTts(sentence, true, false, state.sentenceBuffer);
    }
  };
}
