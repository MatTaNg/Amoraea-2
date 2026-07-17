import { useRef } from 'react';

import { createInitialParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';

import type { WebTtsUtteranceReplayOptions } from './ariaInterviewScreenSessionStateTypes';

export function useAriaInterviewSessionTtsGateRefs() {
  const lastSuccessfulTtsTextNormalizedRef = useRef<string | null>(null);
  const lastSuccessfulTtsDeliveredPreviewRef = useRef<string>('');
  const ttsSessionHardFailureCountRef = useRef(0);
  const ttsUtteranceInFlightRef = useRef<string | null>(null);
  const ttsUtteranceInFlightOptionsRef = useRef<WebTtsUtteranceReplayOptions | null>(null);
  const ttsSpeakGenerationRef = useRef(0);
  const parallelStreamingTtsRef = useRef(createInitialParallelStreamingTtsState());
  const webTabRestoreTapSessionRef = useRef(0);
  const webTabRestoreDeliveredNormRef = useRef<string | null>(null);
  const tabRestoreInFlightWithoutPlaybackSinceMsRef = useRef<number | null>(null);
  const whisperRatioReaskAttemptsForCurrentQuestionRef = useRef(0);

  return {
    lastSuccessfulTtsTextNormalizedRef,
    lastSuccessfulTtsDeliveredPreviewRef,
    ttsSessionHardFailureCountRef,
    ttsUtteranceInFlightRef,
    ttsUtteranceInFlightOptionsRef,
    ttsSpeakGenerationRef,
    parallelStreamingTtsRef,
    webTabRestoreTapSessionRef,
    webTabRestoreDeliveredNormRef,
    tabRestoreInFlightWithoutPlaybackSinceMsRef,
    whisperRatioReaskAttemptsForCurrentQuestionRef,
  };
}
