import type { MutableRefObject } from 'react';
import type { QueryClient } from '@tanstack/react-query';

import * as preamble from '@features/aria/ariaInterviewScreenPreambleBindings';
import * as wiring from '@features/aria/ariaInterviewScreenWiringImports';
import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';
import type { useAriaInterviewSession } from '@features/aria/hooks/useAriaInterviewSession';
import type { AriaInterviewTurnClusterDepSyncWiringParams } from '@features/aria/hooks/useAriaInterviewTurnClusterDepSyncWiring';
import type { FetchStageScoreDeps } from '@features/aria/fetchStageScoreTypes';
import type { SaveScenarioCheckpointDeps } from '@features/aria/saveScenarioCheckpointTypes';
import type { ClaudeParallelStreamTtsCallDeps } from '@features/aria/claudeParallelStreamTtsCallTypes';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type BuildAriaInterviewTurnClusterDepSyncWiringParamsFromScreenInput = {
  syncContexts: {
    coreCtx: AriaInterviewDepsSyncContext;
    coreGateServicesBaseCtx: AriaInterviewDepsSyncContext;
    gateSyncCtx: AriaInterviewDepsSyncContext;
    runtimeCtx: AriaInterviewDepsSyncContext;
    servicesGateCtx: AriaInterviewDepsSyncContext;
  };
  documentTts: {
    claudeParallelStreamTtsDepsRef: MutableRefObject<ClaudeParallelStreamTtsCallDeps>;
    fetchStageScoreDepsRef: MutableRefObject<FetchStageScoreDeps>;
    saveScenarioCheckpointDepsRef: MutableRefObject<SaveScenarioCheckpointDeps>;
    deliverRecordingRetryLine: AriaInterviewTurnClusterDepSyncWiringParams['deliverRecordingRetryLine'];
  };
  webTts: {
    clearStaleInterviewTtsRuntimeLocks: AriaInterviewTurnClusterDepSyncWiringParams['turnHandler']['webTtsResume']['clearStaleInterviewTtsRuntimeLocks'];
    isInterviewerOutputActiveForMicGate: AriaInterviewTurnClusterDepSyncWiringParams['micCluster']['playbackGate']['isInterviewerOutputActiveForMicGate'];
  };
  boot: {
    applyInterviewSpeechComplete: AriaInterviewTurnClusterDepSyncWiringParams['turnHandler']['webTtsResume']['applyInterviewSpeechComplete'];
    showChatError: AriaInterviewTurnClusterDepSyncWiringParams['turnHandler']['transcript']['showChatError'];
    resolveAssistantScenarioNumber: AriaInterviewTurnClusterDepSyncWiringParams['turnHandler']['persistence']['resolveAssistantScenarioNumber'];
    processTurnAudioWithRetry: AriaInterviewTurnClusterDepSyncWiringParams['micCluster']['recordingPipeline']['processTurnAudioWithRetry'];
    deleteTurnAudioFile: AriaInterviewTurnClusterDepSyncWiringParams['micCluster']['recordingPipeline']['deleteTurnAudioFile'];
  };
  emotion: {
    awaitEmotionModalForIndex: AriaInterviewTurnClusterDepSyncWiringParams['turnHandler']['emotionModal']['awaitEmotionModalForIndex'];
    runEmotionModalAfterScenarioTransition: AriaInterviewTurnClusterDepSyncWiringParams['turnHandler']['emotionModal']['runEmotionModalAfterScenarioTransition'];
    markClosingQuestionAsked: AriaInterviewTurnClusterDepSyncWiringParams['turnHandler']['closingQuestion']['markClosingQuestionAsked'];
    markClosingQuestionAnswered: AriaInterviewTurnClusterDepSyncWiringParams['turnHandler']['closingQuestion']['markClosingQuestionAnswered'];
  };
  session: AriaInterviewScreenSessionState;
  interview: ReturnType<typeof useAriaInterviewSession>;
  queryClient: QueryClient;
  setHighestScenarioReached: AriaInterviewTurnClusterDepSyncWiringParams['turnHandler']['uiStage']['setHighestScenarioReached'];
  interviewSession: {
    audioRecorderIsRecordingForRouteRef: MutableRefObject<boolean>;
    recognitionRef: MutableRefObject<unknown>;
    webMicArmInFlightRef: MutableRefObject<boolean>;
    micTapWhileTtsActiveRef: MutableRefObject<boolean>;
    useTapMicUi: boolean;
    currentTranscript: string;
    takeRecordingStartEventDataWithVadBypassRestart: AriaInterviewTurnClusterDepSyncWiringParams['micCluster']['recordingPipeline']['takeRecordingStartEventDataWithVadBypassRestart'];
    pendingRecordingRestartAfterVadBypassRef: MutableRefObject<unknown>;
  };
};

/** Assemble turn-cluster dep-sync params from session state + upstream TTS/boot/emotion outputs. */
export function buildAriaInterviewTurnClusterDepSyncWiringParamsFromScreen(
  input: BuildAriaInterviewTurnClusterDepSyncWiringParamsFromScreenInput,
): AriaInterviewTurnClusterDepSyncWiringParams {
  const {
    syncContexts,
    documentTts,
    webTts,
    boot,
    emotion,
    session,
    interview,
    queryClient,
    setHighestScenarioReached,
    interviewSession,
  } = input;
  const { status, voiceState, setStatus } = interview;
  const {
    setCurrentTranscript,
    setExchangeCount,
    setMicWarning,
    setMicEnginePrimed,
    setMicPermission,
    setMicNeedsReconnect,
    setMicSessionRecovering,
    setLateStartIdleCueVisible,
    setPreInitMeterLevel,
  } = interview;
  const { closingQuestion, shell } = session;
  const {
    scoreScenarioRef,
    typedAnswer,
    interviewStatus,
    setTypedAnswer,
    setInterviewStatus,
    setPendingCompletion,
    setIsWaiting,
    setPendingScoringSyncAttemptId,
    setReferenceCardPrompt,
    setStageResults,
    setTouchedConstructs,
    setUsedPersonalExamples,
    setResults,
    commitInterviewMessages,
    usedPersonalExamples,
    setSessionAudioHealthNotice,
    setConversationErrorNotice,
    recordingDelayMeasurementRef,
    transcribeBufferMetaRef,
    recordingPeakMeteringRef,
    lastRecordingVadSpeechDetectedRef,
    transcriptionFailureStreakRef,
    lastRecordingRetryDeliveredNormRef,
    recordingCompleteInFlightRef,
  } = shell;
  const {
    audioRecorderIsRecordingForRouteRef,
    recognitionRef,
    webMicArmInFlightRef,
    micTapWhileTtsActiveRef,
    useTapMicUi,
    currentTranscript,
    takeRecordingStartEventDataWithVadBypassRestart,
    pendingRecordingRestartAfterVadBypassRef,
  } = interviewSession;

  return {
    ...syncContexts,
    queryClient,
    turnHandlerShellExtras: {
      setTouchedConstructs,
      setUsedPersonalExamples,
      setResults,
      setStatus,
    },
    claudeParallelStreamTtsDepsRef: documentTts.claudeParallelStreamTtsDepsRef,
    fetchStageScoreDepsRef: documentTts.fetchStageScoreDepsRef,
    saveScenarioCheckpointDepsRef: documentTts.saveScenarioCheckpointDepsRef,
    scoreScenarioRef,
    audioRecorderIsRecordingForRouteRef,
    typedAnswer,
    handleSendTypedLocal: {
      touchActivity: wiring.touchActivity,
      setTypedAnswer,
      setMicWarning,
      stopElevenLabsSpeech: wiring.stopElevenLabsSpeech,
    },
    routeProbe: { setAudioRouteKind: wiring.setAudioRouteKind },
    deliverRecordingRetryLine: documentTts.deliverRecordingRetryLine,
    turnHandler: {
      kickCompletionScoring: wiring.kickCompletionScoring,
      statusSetters: {
        status,
        setInterviewStatus,
        setPendingCompletion,
        setIsWaiting,
        setPendingScoringSyncAttemptId,
      },
      emotionModal: {
        awaitEmotionModalForIndex: emotion.awaitEmotionModalForIndex,
        listUnansweredEmotionModalIndices: wiring.listUnansweredEmotionModalIndices,
        runEmotionModalAfterScenarioTransition: emotion.runEmotionModalAfterScenarioTransition,
      },
      webTtsResume: {
        clearStaleInterviewTtsRuntimeLocks: webTts.clearStaleInterviewTtsRuntimeLocks,
        applyInterviewSpeechComplete: boot.applyInterviewSpeechComplete,
      },
      uiStage: {
        setReferenceCardPrompt,
        setHighestScenarioReached,
        setStageResults,
      },
      closingQuestion: {
        setClosingQuestionPending: closingQuestion.setClosingQuestionPending,
        setClosingQuestionScenario: closingQuestion.setClosingQuestionScenario,
        markClosingQuestionAsked: emotion.markClosingQuestionAsked,
        markClosingQuestionAnswered: emotion.markClosingQuestionAnswered,
        closingQuestionPending: closingQuestion.closingQuestionPending,
        closingQuestionScenario: closingQuestion.closingQuestionScenario,
      },
      persistence: {
        commitInterviewMessages,
        saveInterviewToStorage: wiring.saveInterviewToStorage,
        persistInterviewAttemptSessionLifecycle: wiring.persistInterviewAttemptSessionLifecycle,
        applyInterviewProgressFromAssistantText: wiring.applyInterviewProgressFromAssistantText,
        insertPreambleBriefingIfMissing: preamble.insertPreambleBriefingIfMissing,
        resolveAssistantScenarioNumber: boot.resolveAssistantScenarioNumber,
      },
      transcript: {
        setCurrentTranscript,
        setExchangeCount,
        showChatError: boot.showChatError,
        usedPersonalExamples,
      },
      sessionBootstrap: {
        createInterviewAttemptOnFirstSubstantiveResponse:
          preamble.createInterviewAttemptOnFirstSubstantiveResponse,
        collectDeviceContext: wiring.collectDeviceContext,
        assignAttemptIdForSessionLogs: wiring.assignAttemptIdForSessionLogs,
        markAiProcessingTurnStarted: wiring.markAiProcessingTurnStarted,
      },
    },
    micCluster: {
      liveState: {
        voiceState,
        currentTranscript,
        interviewStatus,
        useTapMicUi,
        touchActivity: wiring.touchActivity,
      },
      micSetters: {
        setMicWarning,
        setMicEnginePrimed,
        setMicPermission,
        setCurrentTranscript,
        setMicNeedsReconnect,
        setMicSessionRecovering,
        setLateStartIdleCueVisible,
        setPreInitMeterLevel,
        setSessionAudioHealthNotice,
        setConversationErrorNotice,
      },
      playbackGate: {
        stopElevenLabsPlayback: wiring.stopElevenLabsPlayback,
        stopElevenLabsSpeech: wiring.stopElevenLabsSpeech,
        checkMicPermission: preamble.checkMicPermission,
        isInterviewerOutputActiveForMicGate: webTts.isInterviewerOutputActiveForMicGate,
        classifyInterviewQuestionType: preamble.classifyInterviewQuestionType,
      },
      recordingPipeline: {
        processTurnAudioWithRetry: boot.processTurnAudioWithRetry,
        takeRecordingStartEventDataWithVadBypassRestart,
        deleteTurnAudioFile: boot.deleteTurnAudioFile,
        classifyError: wiring.classifyError,
      },
      recordingRefs: {
        recognitionRef,
        webMicArmInFlightRef,
        micTapWhileTtsActiveRef,
        recordingDelayMeasurementRef,
        transcribeBufferMetaRef,
        recordingPeakMeteringRef,
        lastRecordingVadSpeechDetectedRef,
        transcriptionFailureStreakRef,
        lastRecordingRetryDeliveredNormRef,
        recordingCompleteInFlightRef,
        pendingRecordingRestartAfterVadBypassRef,
      },
      webTtsResume: {
        hasInterviewClosingSpeakInFlightForSession: wiring.hasInterviewClosingSpeakInFlightForSession,
      },
      pressHandlers: {},
    },
  };
}
