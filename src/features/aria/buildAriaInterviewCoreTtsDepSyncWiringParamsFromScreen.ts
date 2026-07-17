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
    awaitTtsScreenReadyGate: AriaInterviewCoreTtsDepSyncWiringParams['ttsPipeline']['awaitTtsScreenReadyGate'];
  };
  webTts: {
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
    committedScenarioRef,
  } = shell;
  const {
    setMessages,
    currentMessagesRef,
    awaitTtsScreenReadyGate,
  } = interviewSession;

  return {
    ...syncContexts,
    coreLocal: {
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
      setTtsPlaybackReliabilityNotice,
      setLastTtsCompletionCallbackMs: wiring.setLastTtsCompletionCallbackMs,
      speak: webTts.speak,
      applyInterviewSpeechComplete: boot.applyInterviewSpeechComplete,
      awaitTtsScreenReadyGate,
      stopElevenLabsPlayback: wiring.stopElevenLabsPlayback,
      persistInterviewAttemptSessionLifecycle: wiring.persistInterviewAttemptSessionLifecycle,
      applyReferenceCardFromAssistantSpeechRef: boot.applyReferenceCardFromAssistantSpeechRef,
      setReferenceCardPrompt,
      setReferenceCardScenario,
      setInterviewUiPhase,
      prepareInterviewTtsPlayback: wiring.prepareInterviewTtsPlayback,
      committedScenarioRef,
    },
  };
}
