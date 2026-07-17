import type { MutableRefObject } from 'react';

import * as preamble from '@features/aria/ariaInterviewScreenPreambleBindings';
import type { AriaInterviewTtsPreCoreDepSyncWiringParams } from '@features/aria/hooks/useAriaInterviewTtsPreCoreDepSyncWiring';
import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';

export type BuildAriaInterviewTtsPreCoreDepSyncWiringParamsFromScreenInput = {
  session: AriaInterviewScreenSessionState;
  userIdRef: MutableRefObject<string>;
  interviewSession: {
    awaitTtsScreenReadyGate: AriaInterviewTtsPreCoreDepSyncWiringParams['ttsSpeak']['awaitTtsScreenReadyGate'];
    setVoiceState: AriaInterviewTtsPreCoreDepSyncWiringParams['ttsSpeak']['setVoiceState'];
    isSpeakingRef: MutableRefObject<unknown>;
  };
};

/** Assemble web TTS pre-core dep-sync params from session state. */
export function buildAriaInterviewTtsPreCoreDepSyncWiringParamsFromScreen(
  input: BuildAriaInterviewTtsPreCoreDepSyncWiringParamsFromScreenInput,
): AriaInterviewTtsPreCoreDepSyncWiringParams {
  const { session, userIdRef, interviewSession } = input;
  const { shell } = session;
  const {
    lastQuestionTextRef,
    timingRef,
    recordingJustFinishedBeforeNextTtsRef,
  } = shell;
  const {
    awaitTtsScreenReadyGate,
    setVoiceState,
    isSpeakingRef,
  } = interviewSession;

  return {
    ttsSpeak: {
      awaitTtsScreenReadyGate,
      setVoiceState,
      userIdRef,
      lastQuestionTextRef,
      isSpeakingRef,
      timingRef,
      recordingJustFinishedBeforeNextTtsRef,
      trySplitFictionalScenarioIntroLongDelivery: preamble.trySplitFictionalScenarioIntroLongDelivery,
    },
  };
}
