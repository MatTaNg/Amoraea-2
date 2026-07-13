import { Platform } from 'react-native';

import {
  computeParallelStreamTabRestoreText,
  isUnauthorizedS1TabRestoreFollowUp,
  looksLikeBriefStreamAckOnly,
  looksLikeScenarioHandoffOrVignetteBundle,
  looksLikeShortProbeFallback,
} from '@features/aria/computeParallelStreamTabRestoreText';
import { TAB_RESTORE_PENDING_SPEAK_OPTIONS } from '@features/aria/interviewTtsSpeakOptions';
import { hasWebInterviewHtmlAudioTabResumePending } from '@features/aria/utils/webInterviewHtmlAudioTabResume';

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
    if (Platform.OS === 'web' && deps.webTtsTabInterruptPendingReplayRef.current) {
      const prior = deps.pendingGestureRestoreSpeakRef.current;
      /**
       * Tab-hide already queued a restore and cancelled the stream. Do not replace that
       * pending line with later stream leftovers (e.g. muted S1 vignette while the spoken
       * line was the contempt probe).
       */
      if (deps.parallelStreamingTtsRef.current.cancelRequested && prior?.text?.trim()) {
      } else {
        const spokenComplete = deps.parallelStreamingTtsRef.current.spokenCompleteText;
        const restoreText = computeParallelStreamTabRestoreText(
          params.textToParallelStream.full,
          spokenComplete,
          [deps.webTtsUtteranceInFlightRef.current ?? ''],
        );
        if (restoreText.length > 0) {
          const preserveHtmlResume =
            prior?.restoreMode === 'resume_html' || hasWebInterviewHtmlAudioTabResumePending();
          const nextWouldBeStaleFollowUp =
            isUnauthorizedS1TabRestoreFollowUp(restoreText) ||
            looksLikeBriefStreamAckOnly(restoreText) ||
            (looksLikeShortProbeFallback(restoreText) &&
              looksLikeScenarioHandoffOrVignetteBundle(spokenComplete));
          const keepPrior =
            !!prior?.text?.trim() &&
            (preserveHtmlResume ||
              (nextWouldBeStaleFollowUp &&
                (looksLikeScenarioHandoffOrVignetteBundle(prior.text) ||
                  prior.text.trim().length >= 40)));
          const nextText = keepPrior && prior?.text ? prior.text : restoreText;
          deps.pendingGestureRestoreSpeakRef.current = {
            text: nextText,
            restoreMode: preserveHtmlResume ? 'resume_html' : prior?.restoreMode ?? 'replay',
            queuedAtMs: prior?.queuedAtMs ?? Date.now(),
            options: prior?.options ?? { ...TAB_RESTORE_PENDING_SPEAK_OPTIONS },
            resolve: prior?.resolve ?? (() => {}),
            reject: prior?.reject ?? (() => {}),
          };
          deps.setWebTabGestureRestoreOverlay(true);
        }
      }
    }
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
