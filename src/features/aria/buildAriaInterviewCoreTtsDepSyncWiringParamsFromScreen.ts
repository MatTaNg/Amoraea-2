import type { MutableRefObject } from 'react';

import * as wiring from '@features/aria/ariaInterviewScreenWiringImports';
import type { AriaInterviewCoreTtsDepSyncWiringParams } from '@features/aria/hooks/useAriaInterviewCoreTtsDepSyncWiring';
import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type BuildAriaInterviewCoreTtsDepSyncWiringParamsFromScreenInput = {
  syncContexts: {
    runtimeGateCtx: AriaInterviewDepsSyncContext;
    gateCtx: AriaInterviewDepsSyncContext;
    servicesBaseCtx: AriaInterviewDepsSyncContext;
    servicesFullCtx: AriaInterviewDepsSyncContext;
  };
  session: AriaInterviewScreenSessionState;
  interviewSession: {
    setMessages: AriaInterviewCoreTtsDepSyncWiringParams['coreLocal']['setMessages'];
    currentMessagesRef: MutableRefObject<Array<{ role: string; content?: string }>>;
    mobileWebTapToBeginDone: boolean;
    setWebDesktopPendingTtsGestureOverlay: (value: boolean) => void;
    setWebTabGestureRestoreOverlay: (value: boolean) => void;
    awaitTtsScreenReadyGate: AriaInterviewCoreTtsDepSyncWiringParams['ttsPipeline']['awaitTtsScreenReadyGate'];
  };
  webTts: {
    dismissTabRestoreOverlay: AriaInterviewCoreTtsDepSyncWiringParams['coreLocal']['dismissTabRestoreOverlay'];
    dismissAfterAndroidBackgroundPlaybackEnd: AriaInterviewCoreTtsDepSyncWiringParams['coreLocal']['dismissAfterAndroidBackgroundPlaybackEnd'];
    speak: AriaInterviewCoreTtsDepSyncWiringParams['ttsPipeline']['speak'];
  };
  boot: {
    applyInterviewSpeechComplete: AriaInterviewCoreTtsDepSyncWiringParams['ttsPipeline']['applyInterviewSpeechComplete'];
    applyReferenceCardFromAssistantSpeechRef: AriaInterviewCoreTtsDepSyncWiringParams['ttsPipeline']['applyReferenceCardFromAssistantSpeechRef'];
  };
};

/** Assemble core TTS dep-sync params from session state + upstream runtime/web-TTS/boot outputs. */
export function buildAriaInterviewCoreTtsDepSyncWiringParamsFromScreen(
  input: BuildAriaInterviewCoreTtsDepSyncWiringParamsFromScreenInput,
): AriaInterviewCoreTtsDepSyncWiringParams {
  const { syncContexts, session, interviewSession, webTts, boot } = input;
  const { shell } = session;
  const {
    setEmotionModalVisible,
    setScenarioScores,
    pendingCompletionTranscriptRef,
    probeLogRef,
    currentScenarioRef,
    isInterviewCompleteRef,
    scoredScenariosRef,
    scenarioScoresRef,
    setTtsPlaybackReliabilityNotice,
    setReferenceCardPrompt,
    setReferenceCardScenario,
    setInterviewUiPhase,
  } = shell;
  const {
    setMessages,
    currentMessagesRef,
    mobileWebTapToBeginDone,
    setWebDesktopPendingTtsGestureOverlay,
    setWebTabGestureRestoreOverlay,
    awaitTtsScreenReadyGate,
  } = interviewSession;

  return {
    ...syncContexts,
    coreLocal: {
      dismissTabRestoreOverlay: webTts.dismissTabRestoreOverlay,
      dismissAfterAndroidBackgroundPlaybackEnd: webTts.dismissAfterAndroidBackgroundPlaybackEnd,
      setMessages,
      setEmotionModalVisible,
      setScenarioScores,
      pendingCompletionTranscriptRef,
      probeLogRef,
      currentScenarioRef,
      currentMessagesRef,
      isInterviewCompleteRef,
      scoredScenariosRef,
      scenarioScoresRef,
    },
    ttsPipeline: {
      mobileWebTapToBeginDone,
      setWebTabGestureRestoreOverlay,
      setWebDesktopPendingTtsGestureOverlay,
      setTtsPlaybackReliabilityNotice,
      setLastTtsCompletionCallbackMs: wiring.setLastTtsCompletionCallbackMs,
      speak: webTts.speak,
      applyInterviewSpeechComplete: boot.applyInterviewSpeechComplete,
      awaitTtsScreenReadyGate,
      stopElevenLabsPlayback: wiring.stopElevenLabsPlayback,
      webSpeechShouldDeferToUserGesture: wiring.webSpeechShouldDeferToUserGesture,
      rearmWebMicPreInitAfterTtsPlaybackComplete: wiring.rearmWebMicPreInitAfterTtsPlaybackComplete,
      scheduleWebMicPreInitRefreshAfterTtsCompletes: wiring.scheduleWebMicPreInitRefreshAfterTtsCompletes,
      persistInterviewAttemptSessionLifecycle: wiring.persistInterviewAttemptSessionLifecycle,
      applyReferenceCardFromAssistantSpeechRef: boot.applyReferenceCardFromAssistantSpeechRef,
      setReferenceCardPrompt,
      setReferenceCardScenario,
      setInterviewUiPhase,
      prepareInterviewTtsPlayback: wiring.prepareInterviewTtsPlayback,
    },
  };
}
