import { useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { QueryClient } from '@tanstack/react-query';

import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createApplyRouteProbeAfterResumeSyncCtxFromScreen,
  createHandleRecordingErrorSyncCtxFromScreen,
  createHandleSendTypedSyncCtxFromScreen,
  createWebTabRestoreSessionSyncCtxFromScreen,
} from '@features/aria/buildAriaInterviewAuxClusterScreenParams';
import {
  createInterviewMicClusterSyncCtxFromScreen,
  createInterviewTurnHandlerSyncCtxFromScreen,
} from '@features/aria/buildAriaInterviewClusterScreenParams';
import { buildInterviewTurnHandlerMergedSyncCtx } from '@features/aria/buildInterviewClusterMergedSyncCtx';
import type { InterviewMicClusterLocalScope } from '@features/aria/buildInterviewMicClusterLocalSyncExtra';
import type { InterviewTurnHandlerLocalScope } from '@features/aria/buildInterviewTurnHandlerLocalSyncExtra';
import type { AriaInterviewAudioRecorderDeps } from '@features/aria/hooks/useAriaInterviewAudioRecorder';
import { useAriaInterviewAudioRecorder } from '@features/aria/hooks/useAriaInterviewAudioRecorder';
import {
  useKickPostClosingInterviewCompletion,
  type KickPostClosingInterviewCompletionDeps,
} from '@features/aria/hooks/useKickPostClosingInterviewCompletion';
import { useInterviewMicLifecycle, type InterviewMicLifecycleDeps } from '@features/aria/hooks/useInterviewMicLifecycle';
import { useInterviewMicPressCallbacks } from '@features/aria/hooks/useInterviewMicPressCallbacks';
import { useInterviewScenarioScoringCallbacks } from '@features/aria/hooks/useInterviewScenarioScoringCallbacks';
import {
  useInterviewHandleSendTyped,
  useInterviewTurnProcessingCallbacks,
} from '@features/aria/hooks/useInterviewTurnProcessingCallbacks';
import type { ApplyRouteProbeAfterResumeDeps } from '@features/aria/applyRouteProbeAfterResumeTypes';
import type { AudioRouteKind } from '@features/aria/config/audioRouteRuntime';
import type { FetchStageScoreDeps } from '@features/aria/fetchStageScoreTypes';
import type { HandleRecordingErrorDeps } from '@features/aria/handleRecordingErrorTypes';
import type { HandleSendTypedDeps } from '@features/aria/handleSendTypedTypes';
import type { PostClaudeAssistantTurnDeps } from '@features/aria/postClaudeAssistantTurnTypes';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import type { ClaudeParallelStreamTtsCallDeps } from '@features/aria/claudeParallelStreamTtsCallTypes';
import type { ProcessUserSpeechDeps } from '@features/aria/processUserSpeechTypes';
import type { SaveScenarioCheckpointDeps } from '@features/aria/saveScenarioCheckpointTypes';
import type { ScenarioBoundaryScoringDeps } from '@features/aria/scenarioBoundaryScoringTypes';
import type { ScoreScenarioDeps } from '@features/aria/scoreScenarioTypes';
import type { TranscribeSafeDeps } from '@features/aria/transcribeSafeTypes';
import type { WebMicPressLifecycleDeps } from '@features/aria/webMicPressLifecycleTypes';
import type { HandleNativeOrWhisperMicPressDeps } from '@features/aria/handleNativeOrWhisperMicPressTypes';
import type { InterviewWebTabRestoreSessionDeps } from '@features/aria/webTabRestoreSessionDeps';
import {
  syncApplyRouteProbeAfterResumeDeps,
  syncAriaInterviewMicCluster,
  syncAriaInterviewTurnHandlerCluster,
  syncHandleRecordingErrorDeps,
  syncHandleSendTypedDeps,
  syncScenarioBoundaryScoringDeps,
} from '@features/aria/syncAriaInterviewDepsRefs';

export type TurnHandlerUiStageDepScreenRefs = Pick<
  PostClaudeAssistantTurnDeps,
  'setWebTabGestureRestoreOverlay' | 'setReferenceCardPrompt' | 'setHighestScenarioReached' | 'setStageResults'
>;

export type TurnHandlerDepScreenRefs = Omit<InterviewTurnHandlerLocalScope, 'scenarioScoring' | 'uiStage'> & {
  uiStage: TurnHandlerUiStageDepScreenRefs;
  kickCompletionScoring: InterviewTurnHandlerLocalScope['scenarioScoring']['kickCompletionScoring'];
};

export type MicClusterDepScreenRefs = Omit<
  InterviewMicClusterLocalScope,
  'liveState' | 'recordingPipeline' | 'webTtsResume' | 'recordingRefs' | 'pressHandlers'
> & {
  liveState: Omit<InterviewMicClusterLocalScope['liveState'], 'audioRecorder'>;
  recordingPipeline: Omit<
    InterviewMicClusterLocalScope['recordingPipeline'],
    'handleRecordingError' | 'processUserSpeech' | 'transcribeSafe' | 'applyRouteProbeAfterResume' | 'deliverRecordingRetryLine'
  >;
  recordingRefs: Omit<InterviewMicClusterLocalScope['recordingRefs'], 'releaseRecordingFnRef'>;
  webTtsResume: Omit<InterviewMicClusterLocalScope['webTtsResume'], 'syncInterviewTtsAfterScreenReturn'>;
  pressHandlers: Omit<
    InterviewMicClusterLocalScope['pressHandlers'],
    'startRecordingAfterPendingTts' | 'handlePressEnd' | 'handlePressStart' | 'waitUntilInterviewerQuiescentForWebMic'
  >;
};

export type HandleSendTypedDepScreenRefs = Pick<
  HandleSendTypedDeps,
  'touchActivity' | 'setTypedAnswer' | 'setMicWarning' | 'stopElevenLabsSpeech'
>;

export type AriaInterviewTurnClusterDepSyncWiringParams = {
  coreCtx: AriaInterviewDepsSyncContext;
  coreGateServicesBaseCtx: AriaInterviewDepsSyncContext;
  gateSyncCtx: AriaInterviewDepsSyncContext;
  webRuntimeCtx: AriaInterviewDepsSyncContext;
  servicesGateCtx: AriaInterviewDepsSyncContext;
  queryClient: QueryClient;
  turnHandlerShellExtras: AriaInterviewDepsSyncContext;
  webTabRestoreSessionDepsRef: MutableRefObject<InterviewWebTabRestoreSessionDeps>;
  claudeParallelStreamTtsDepsRef: MutableRefObject<ClaudeParallelStreamTtsCallDeps>;
  fetchStageScoreDepsRef: MutableRefObject<FetchStageScoreDeps>;
  saveScenarioCheckpointDepsRef: MutableRefObject<SaveScenarioCheckpointDeps>;
  scoreScenarioRef: MutableRefObject<
    ((scenarioNumber: 1 | 2 | 3, allMessages: { role: string; content: string }[]) => Promise<void>) | null
  >;
  audioRecorderIsRecordingForRouteRef: MutableRefObject<boolean>;
  runWebGestureTtsFlush: () => void;
  typedAnswer: string;
  handleSendTypedLocal: HandleSendTypedDepScreenRefs;
  routeProbe: { setAudioRouteKind: (kind: AudioRouteKind) => void };
  deliverRecordingRetryLine: InterviewMicClusterLocalScope['recordingPipeline']['deliverRecordingRetryLine'];
  syncInterviewTtsAfterScreenReturn: InterviewMicClusterLocalScope['webTtsResume']['syncInterviewTtsAfterScreenReturn'];
  turnHandler: TurnHandlerDepScreenRefs;
  micCluster: MicClusterDepScreenRefs;
};

/** Wire turn-handler + mic-cluster dep refs and mount related callbacks each render. */
export function useAriaInterviewTurnClusterDepSyncWiring(params: AriaInterviewTurnClusterDepSyncWiringParams) {
  const {
    coreCtx,
    coreGateServicesBaseCtx,
    gateSyncCtx,
    webRuntimeCtx,
    servicesGateCtx,
    webTabRestoreSessionDepsRef,
    claudeParallelStreamTtsDepsRef,
    fetchStageScoreDepsRef,
    saveScenarioCheckpointDepsRef,
    scoreScenarioRef,
    audioRecorderIsRecordingForRouteRef,
    runWebGestureTtsFlush,
    typedAnswer,
    handleSendTypedLocal,
    routeProbe,
    deliverRecordingRetryLine,
    syncInterviewTtsAfterScreenReturn,
    queryClient,
    turnHandlerShellExtras,
    turnHandler,
    micCluster,
  } = params;

  const { kickCompletionScoring, uiStage, ...turnHandlerRest } = turnHandler;

  const postClaudeTurnDepsRef = useRef({} as PostClaudeAssistantTurnDeps);
  const preClaudeTurnGateDepsRef = useRef({} as PreClaudeTurnGateDeps);
  const kickPostClosingCompletionDepsRef = useRef({} as KickPostClosingInterviewCompletionDeps);
  const processUserSpeechDepsRef = useRef({} as ProcessUserSpeechDeps);
  const scenarioBoundaryScoringDepsRef = useRef({} as ScenarioBoundaryScoringDeps);
  const scoreScenarioDepsRef = useRef({} as ScoreScenarioDeps);

  const { kickPostClosingInterviewCompletionIfReady } = useKickPostClosingInterviewCompletion(
    kickPostClosingCompletionDepsRef,
  );

  const {
    fetchStageScore,
    saveScenarioCheckpoint,
    scoreScenario,
    notifyScenarioStarted,
    ensureCompletedScenarioScored,
  } = useInterviewScenarioScoringCallbacks({
    fetchStageScoreDepsRef,
    saveScenarioCheckpointDepsRef,
    scoreScenarioDepsRef,
    scenarioBoundaryScoringDepsRef,
    scoreScenarioRef,
  });

  const turnHandlerLocalScope: InterviewTurnHandlerLocalScope = {
    ...turnHandlerRest,
    uiStage: {
      ...uiStage,
      kickPostClosingInterviewCompletionIfReady,
    },
    scenarioScoring: {
      kickCompletionScoring,
      saveScenarioCheckpoint,
      fetchStageScore,
      scoreScenario,
      notifyScenarioStarted,
      ensureCompletedScenarioScored,
      scoreScenarioRef,
    },
  };

  const turnHandlerMergedSyncCtx = buildInterviewTurnHandlerMergedSyncCtx(
    coreGateServicesBaseCtx,
    turnHandlerLocalScope,
  );

  const turnHandlerSyncCtx = createInterviewTurnHandlerSyncCtxFromScreen(
    coreGateServicesBaseCtx,
    turnHandlerLocalScope,
  );

  // Full merged ctx — not the stripped turn-handler slice — carries scoredScenariosRef and other refs.
  syncScenarioBoundaryScoringDeps(scenarioBoundaryScoringDepsRef, turnHandlerMergedSyncCtx);

  const runtimeSyncCtx = createWebTabRestoreSessionSyncCtxFromScreen({
    coreGateServicesBaseCtx,
    webRuntimeCtx,
    coreCtx,
  });

  syncAriaInterviewTurnHandlerCluster(
    {
      kickPostClosingCompletionDepsRef,
      webTabRestoreSessionDepsRef,
      scoreScenarioDepsRef,
      postClaudeTurnDepsRef,
      preClaudeTurnGateDepsRef,
      processUserSpeechDepsRef,
    },
    turnHandlerSyncCtx,
    runtimeSyncCtx,
    {
      preClaudeTurnGateDepsRef,
      postClaudeTurnDepsRef,
      claudeParallelStreamTtsDepsRef,
    },
    { deliverRecordingRetryLine, queryClient, ...turnHandlerShellExtras },
    gateSyncCtx,
  );

  const handleRecordingErrorDepsRef = useRef({} as HandleRecordingErrorDeps);
  syncHandleRecordingErrorDeps(
    handleRecordingErrorDepsRef,
    createHandleRecordingErrorSyncCtxFromScreen(coreCtx),
  );

  const transcribeSafeDepsRef = useRef({} as TranscribeSafeDeps);
  const { processUserSpeech, handleRecordingError, transcribeSafe } = useInterviewTurnProcessingCallbacks({
    processUserSpeechDepsRef,
    handleRecordingErrorDepsRef,
    transcribeSafeDepsRef,
  });

  const applyRouteProbeAfterResumeDepsRef = useRef({} as ApplyRouteProbeAfterResumeDeps);
  syncApplyRouteProbeAfterResumeDeps(
    applyRouteProbeAfterResumeDepsRef,
    createApplyRouteProbeAfterResumeSyncCtxFromScreen(coreCtx, routeProbe),
  );

  const releaseRecordingFnRef = useRef<
    | ((opts?: {
        momentNumber?: number;
        logCleanupFailed?: (payload: { message: string; moment_number?: number }) => void;
      }) => Promise<void>)
    | null
  >(null);

  const audioRecorderDepsRef = useRef({} as AriaInterviewAudioRecorderDeps);
  const audioRecorder = useAriaInterviewAudioRecorder(audioRecorderDepsRef);

  const webMicPressLifecycleDepsRef = useRef({} as WebMicPressLifecycleDeps);
  const handleNativeOrWhisperMicPressDepsRef = useRef({} as HandleNativeOrWhisperMicPressDeps);
  const {
    waitUntilInterviewerQuiescentForWebMic,
    startRecordingAfterPendingTts,
    handlePressStart,
    handlePressEnd,
    handleWebMicPressIn,
    applyRouteProbeAfterResume,
    handleNativeOrWhisperMicPress,
  } = useInterviewMicPressCallbacks({
    webMicPressLifecycleDepsRef,
    applyRouteProbeAfterResumeDepsRef,
    handleNativeOrWhisperMicPressDepsRef,
    runWebGestureTtsFlush,
  });

  const handleSendTypedDepsRef = useRef({} as HandleSendTypedDeps);
  syncHandleSendTypedDeps(
    handleSendTypedDepsRef,
    createHandleSendTypedSyncCtxFromScreen(coreCtx, {
      ...handleSendTypedLocal,
      processUserSpeech,
    }),
  );
  const handleSendTyped = useInterviewHandleSendTyped(handleSendTypedDepsRef, typedAnswer);

  audioRecorderIsRecordingForRouteRef.current = audioRecorder.isRecording;
  releaseRecordingFnRef.current = audioRecorder.releaseRecordingInstance;

  const micLifecycleDepsRef = useRef({} as InterviewMicLifecycleDeps);
  const micClusterSyncCtx = createInterviewMicClusterSyncCtxFromScreen({
    coreGateServicesBaseCtx,
    webRuntimeCtx,
    micCluster: {
      ...micCluster,
      liveState: {
        ...micCluster.liveState,
        audioRecorder,
      },
      recordingPipeline: {
        ...micCluster.recordingPipeline,
        handleRecordingError,
        processUserSpeech,
        transcribeSafe,
        deliverRecordingRetryLine,
        applyRouteProbeAfterResume,
      },
      recordingRefs: {
        ...micCluster.recordingRefs,
        releaseRecordingFnRef,
      },
      webTtsResume: {
        ...micCluster.webTtsResume,
        syncInterviewTtsAfterScreenReturn,
      },
      pressHandlers: {
        ...micCluster.pressHandlers,
        startRecordingAfterPendingTts,
        handlePressEnd,
        handlePressStart,
        waitUntilInterviewerQuiescentForWebMic,
      },
    },
  });

  syncAriaInterviewMicCluster(
    {
      webMicPressLifecycleDepsRef,
      transcribeSafeDepsRef,
      audioRecorderDepsRef,
      micLifecycleDepsRef,
      handleNativeOrWhisperMicPressDepsRef,
    },
    micClusterSyncCtx,
  );

  useInterviewMicLifecycle(micLifecycleDepsRef);

  return {
    fetchStageScore,
    saveScenarioCheckpoint,
    scoreScenario,
    notifyScenarioStarted,
    ensureCompletedScenarioScored,
    processUserSpeech,
    handleRecordingError,
    transcribeSafe,
    audioRecorder,
    waitUntilInterviewerQuiescentForWebMic,
    startRecordingAfterPendingTts,
    handlePressStart,
    handlePressEnd,
    handleWebMicPressIn,
    applyRouteProbeAfterResume,
    handleNativeOrWhisperMicPress,
    handleSendTyped,
    micLifecycleDepsRef,
  };
}
