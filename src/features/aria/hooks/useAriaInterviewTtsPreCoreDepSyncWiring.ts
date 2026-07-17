import { useRef } from 'react';

import {
  useInterviewTtsSpeak,
  type UseInterviewTtsSpeakDeps,
} from '@features/aria/hooks/useInterviewTtsSpeak';
import {
  useInterviewTtsRuntime,
  type InterviewTtsRuntimeDeps,
} from '@features/aria/hooks/useInterviewTtsRuntime';

export type AriaInterviewTtsPreCoreDepSyncWiringParams = {
  ttsSpeak: UseInterviewTtsSpeakDeps;
};

/**
 * Mount native TTS speak + runtime interrupt helpers.
 */
export function useAriaInterviewTtsPreCoreDepSyncWiring(
  params: AriaInterviewTtsPreCoreDepSyncWiringParams,
) {
  const { ttsSpeak } = params;

  const ttsRuntimeDepsRef = useRef({} as InterviewTtsRuntimeDeps);
  const {
    isInterviewerOutputActiveForMicGate,
    clearStaleInterviewTtsRuntimeLocks,
    interruptAllInterviewTtsOutput,
    resolveStaleTtsRuntimeLockThresholdMs,
  } = useInterviewTtsRuntime(ttsRuntimeDepsRef);

  const { speak } = useInterviewTtsSpeak(ttsSpeak);

  return {
    ttsRuntimeDepsRef,
    isInterviewerOutputActiveForMicGate,
    clearStaleInterviewTtsRuntimeLocks,
    interruptAllInterviewTtsOutput,
    resolveStaleTtsRuntimeLockThresholdMs,
    speak,
  };
}
