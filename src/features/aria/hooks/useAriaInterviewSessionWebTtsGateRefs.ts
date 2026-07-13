import { useRef } from 'react';

import { createInitialParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';

import type { WebTtsUtteranceReplayOptions } from './ariaInterviewScreenSessionStateTypes';

export function useAriaInterviewSessionWebTtsGateRefs() {
  const lastSuccessfulTtsTextNormalizedRef = useRef<string | null>(null);
  const lastSuccessfulTtsDeliveredPreviewRef = useRef<string>('');
  const ttsSessionHardFailureCountRef = useRef(0);
  const webTtsUtteranceInFlightRef = useRef<string | null>(null);
  const webTtsUtteranceInFlightOptionsRef = useRef<WebTtsUtteranceReplayOptions | null>(null);
  const webTtsTabInterruptPendingReplayRef = useRef(false);
  const webTtsSpeakGenerationRef = useRef(0);
  const parallelStreamingTtsRef = useRef(createInitialParallelStreamingTtsState());
  const webTabRestoreReplayInFlightRef = useRef(false);
  const webTabRestoreTapSessionRef = useRef(0);
  const webTabRestoreDeliveredNormRef = useRef<string | null>(null);
  const tabRestoreInFlightWithoutPlaybackSinceMsRef = useRef<number | null>(null);
  const whisperRatioReaskAttemptsForCurrentQuestionRef = useRef(0);

  return {
    lastSuccessfulTtsTextNormalizedRef,
    lastSuccessfulTtsDeliveredPreviewRef,
    ttsSessionHardFailureCountRef,
    webTtsUtteranceInFlightRef,
    webTtsUtteranceInFlightOptionsRef,
    webTtsTabInterruptPendingReplayRef,
    webTtsSpeakGenerationRef,
    parallelStreamingTtsRef,
    webTabRestoreReplayInFlightRef,
    webTabRestoreTapSessionRef,
    webTabRestoreDeliveredNormRef,
    tabRestoreInFlightWithoutPlaybackSinceMsRef,
    whisperRatioReaskAttemptsForCurrentQuestionRef,
  };
}
