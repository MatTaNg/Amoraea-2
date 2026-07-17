import type { MutableRefObject } from 'react';

import type { AriaInterviewRuntimeDepSyncWiringParams } from '@features/aria/hooks/useAriaInterviewRuntimeDepSyncWiring';
import type { EmotionModalOrchestrationDeps } from '@features/aria/emotionModalOrchestrationTypes';
import type { useAriaInterviewSession } from '@features/aria/hooks/useAriaInterviewSession';
import type { InterviewTtsRuntimeDeps } from '@features/aria/hooks/useInterviewTtsRuntime';
import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type BuildAriaInterviewRuntimeDepSyncWiringParamsFromScreenInput = {
  gateCtx: AriaInterviewDepsSyncContext;
  servicesGateCtx: AriaInterviewDepsSyncContext;
  emotionModalOrchestrationDepsRef: MutableRefObject<EmotionModalOrchestrationDeps>;
  ttsRuntimeDepsRef: MutableRefObject<InterviewTtsRuntimeDeps>;
  session: AriaInterviewScreenSessionState;
  interview: ReturnType<typeof useAriaInterviewSession>;
  userIdRef: MutableRefObject<string>;
  interviewSession: {
    voiceStateRef: MutableRefObject<unknown>;
    setVoiceState: AriaInterviewRuntimeDepSyncWiringParams['webRuntime']['setVoiceState'];
    transcriptAtReleaseRef: MutableRefObject<unknown>;
  };
  webTts: {
    interruptAllInterviewTtsOutput: AriaInterviewRuntimeDepSyncWiringParams['webRuntime']['interruptAllInterviewTtsOutput'];
  };
};

/** Assemble runtime dep-sync params from session state + upstream web-TTS/emotion outputs. */
export function buildAriaInterviewRuntimeDepSyncWiringParamsFromScreen(
  input: BuildAriaInterviewRuntimeDepSyncWiringParamsFromScreenInput,
): AriaInterviewRuntimeDepSyncWiringParams {
  const {
    gateCtx,
    servicesGateCtx,
    emotionModalOrchestrationDepsRef,
    ttsRuntimeDepsRef,
    session,
    interview,
    userIdRef,
    interviewSession,
    webTts,
  } = input;
  const { status, voiceState } = interview;
  const { routing, shell, gate } = session;
  const { isInterviewAppRoute } = routing;
  const {
    emotionItemsComplete,
    emotionModalVisible,
    emotionModalItemIndex,
    statusRef,
    emotionModalOpenForIndexRef,
    maybeAwaitEmotionAfterScenarioTransitionRef,
    runEmotionModalAfterScenarioTransitionRef,
    setEmotionItemResponses,
    setEmotionItemsComplete,
    setEmotionModalVisible,
    setEmotionModalItemIndex,
    lastQuestionTextRef,
    ttsLineInFlightRef,
    timingRef,
    lastVoiceTurnLanguageRef,
    lastVoiceTurnConfidenceRef,
    postRecordingParallelStreamSettleRef,
    recordingJustFinishedBeforeNextTtsRef,
  } = shell;
  const { emotionModalResolveRef, emotionModalTimeoutRef, emotionModalShownForScenarioRef } = gate.resumeEmotion;
  const { tryRunEmotionModalFromScenarioTransitionRef } = gate.metaSkip;
  const {
    voiceStateRef,
    setVoiceState,
    transcriptAtReleaseRef,
  } = interviewSession;

  return {
    gateCtx,
    servicesGateCtx,
    emotionModalOrchestrationDepsRef,
    ttsRuntimeDepsRef,
    webRuntime: {
      isInterviewAppRoute,
      userIdRef,
      voiceStateRef,
      setVoiceState,
      lastQuestionTextRef,
      ttsLineInFlightRef,
      recordingJustFinishedBeforeNextTtsRef,
      postRecordingParallelStreamSettleRef,
      transcriptAtReleaseRef,
      timingRef,
      lastVoiceTurnLanguageRef,
      lastVoiceTurnConfidenceRef,
      interruptAllInterviewTtsOutput: webTts.interruptAllInterviewTtsOutput,
    },
    earlyDeps: {
      emotionItemsComplete,
      status,
      voiceState,
      emotionModalVisible,
      emotionModalItemIndex,
      statusRef,
      emotionModalResolveRef,
      emotionModalOpenForIndexRef,
      emotionModalTimeoutRef,
      emotionModalShownForScenarioRef,
      maybeAwaitEmotionAfterScenarioTransitionRef,
      runEmotionModalAfterScenarioTransitionRef,
      tryRunEmotionModalFromScenarioTransitionRef,
      setEmotionItemResponses,
      setEmotionItemsComplete,
      setEmotionModalVisible,
      setEmotionModalItemIndex,
    },
  };
}
