import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';

import {
  createAlphaModeCongratulationsFailsafeSyncCtxFromScreen,
  createApplyInterviewSpeechCompleteSyncCtxFromScreen,
  createApplyReferenceCardFromAssistantSpeechSyncCtxFromScreen,
  createAriaInterviewDiagnosticSyncCtxFromScreen,
  createAriaInterviewServicesExtendedSyncCtxFromScreen,
  createAriaScreenMountedLogSyncCtxFromScreen,
  createCheckInterviewStatusSyncCtxFromScreen,
  createDebouncedLiveTranscriptSyncCtxFromScreen,
  createEnsureValidSessionSyncCtxFromScreen,
  createInterviewAttemptBootstrapSyncCtxFromScreen,
  createInterviewAuthSignedOutSaveSyncCtxFromScreen,
  createInterviewLoadingStatusFailsafeSyncCtxFromScreen,
  createInterviewScenarioTransitionUiSyncCtxFromScreen,
  createInterviewScrollToEndSyncCtxFromScreen,
  createInterviewUnhandledRejectionSaveSyncCtxFromScreen,
  createInterviewWebGreetingPrefetchSyncCtxFromScreen,
  createLoadStandardResultsReferralCodeSyncCtxFromScreen,
  createPendingScoringSyncPollSyncCtxFromScreen,
  createProfileNameSourceDebugSyncCtxFromScreen,
  createRecoverPendingDatabaseSaveSyncCtxFromScreen,
  createRestorePreparingResultsInterviewStatusSyncCtxFromScreen,
  createSaveActiveInterviewProgressSyncCtxFromScreen,
  createShowChatErrorSyncCtxFromScreen,
  type AriaInterviewDiagnosticScreenRefs,
} from '@features/aria/buildAriaInterviewBootMiscScreenParams';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  syncApplyInterviewSpeechCompleteDeps,
  syncApplyReferenceCardFromAssistantSpeechDeps,
  syncAlphaModeCongratulationsFailsafeDeps,
  syncAriaScreenMountedLogDeps,
  syncCheckInterviewStatusDeps,
  syncDebouncedLiveTranscriptSyncDeps,
  syncEnsureValidSessionDeps,
  syncInterviewAttemptBootstrapDeps,
  syncInterviewAuthSignedOutSaveDeps,
  syncInterviewLoadingStatusFailsafeDeps,
  syncInterviewScenarioTransitionUiDeps,
  syncInterviewScrollToEndDeps,
  syncInterviewUnhandledRejectionSaveDeps,
  syncInterviewWebGreetingPrefetchDeps,
  syncLoadStandardResultsReferralCodeDeps,
  syncPendingScoringSyncPollDeps,
  syncProfileNameSourceDebugDeps,
  syncRecoverPendingDatabaseSaveDeps,
  syncRestorePreparingResultsInterviewStatusDeps,
  syncSaveActiveInterviewProgressDeps,
  syncShowChatErrorDeps,
  syncAdminScoreCardRenderLogDeps,
  syncElongatingProbeFromMessagesDeps,
  syncInterviewNetworkStatusCheckDeps,
  syncReasoningProgressResetDeps,
  syncSyncCurrentMessagesRefDeps,
  syncTranscriptScenarioLogDeps,
} from '@features/aria/syncAriaInterviewDepsRefs';
import type { AriaScreenBootEffectsDeps } from '@features/aria/interviewClosingQuestionTypes';
import type { EnsureValidSessionDeps } from '@features/aria/runEnsureValidSession';
import type { InterviewWebGreetingPrefetchDeps } from '@features/aria/runPrefetchWebInterviewGreetingOnConsent';
import type { InterviewAttemptBootstrapDeps } from '@features/aria/interviewAttemptBootstrapTypes';
import type {
  AdminScoreCardRenderLogDeps,
  ElongatingProbeFromMessagesDeps,
  InterviewNetworkStatusCheckDeps,
  ReasoningProgressResetDeps,
  SyncCurrentMessagesRefDeps,
  TranscriptScenarioLogDeps,
} from '@features/aria/interviewDiagnosticEffectsTypes';
import type {
  InterviewAuthSignedOutSaveDeps,
  InterviewUnhandledRejectionSaveDeps,
} from '@features/aria/buildInterviewProgressSnapshotFromRefs';
import type {
  CheckInterviewStatusDeps,
  RestorePreparingResultsInterviewStatusDeps,
} from '@features/aria/checkInterviewStatusTypes';
import type { PendingScoringSyncPollDeps } from '@features/aria/interviewPostScoringEffectsTypes';
import type {
  AlphaModeCongratulationsFailsafeDeps,
  InterviewLoadingStatusFailsafeDeps,
  LoadStandardResultsReferralCodeDeps,
  RecoverPendingDatabaseSaveDeps,
} from '@features/aria/interviewPostScoringEffectsTypes';
import type {
  DebouncedLiveTranscriptSyncDeps,
  InterviewScenarioTransitionUiDeps,
  SaveActiveInterviewProgressDeps,
} from '@features/aria/interviewActivePersistenceTypes';
import type {
  ApplyInterviewSpeechCompleteDeps,
  ApplyReferenceCardFromAssistantSpeechDeps,
  InterviewScrollToEndDeps,
  ProfileNameSourceDebugDeps,
  ShowChatErrorDeps,
} from '@features/aria/referenceCardFromAssistantSpeechTypes';
import type { MessageWithScenario, ScenarioScoreResult } from '@features/aria/interviewScenarioScoringSlice';
import type { InterviewFirstNameProfile } from '@features/aria/interviewerFrameworkPrompt';
import {
  useInterviewAdminScoreCardRenderLog,
  useInterviewElongatingProbeFromMessages,
  useInterviewNetworkStatusCheck,
  useInterviewReasoningProgressReset,
  useInterviewTranscriptScenarioLog,
  useSyncCurrentMessagesRef,
} from '@features/aria/hooks/useInterviewDiagnosticEffects';
import { useInterviewAttemptBootstrap } from '@features/aria/hooks/useInterviewAttemptBootstrap';
import { useInterviewWebGreetingPrefetch } from '@features/aria/hooks/useInterviewWebGreetingPrefetch';
import { useInterviewUnhandledRejectionSave } from '@features/aria/hooks/useInterviewUnhandledRejectionSave';
import { useInterviewAuthSignedOutSave } from '@features/aria/hooks/useInterviewAuthSignedOutSave';
import { useRestorePreparingResultsInterviewStatus } from '@features/aria/hooks/useRestorePreparingResultsInterviewStatus';
import { useCheckInterviewStatus } from '@features/aria/hooks/useCheckInterviewStatus';
import { usePendingScoringSyncPoll } from '@features/aria/hooks/usePendingScoringSyncPoll';
import { useInterviewLoadingStatusFailsafe } from '@features/aria/hooks/useInterviewLoadingStatusFailsafe';
import { useAlphaModeCongratulationsFailsafe } from '@features/aria/hooks/useAlphaModeCongratulationsFailsafe';
import { useLoadStandardResultsReferralCode } from '@features/aria/hooks/useLoadStandardResultsReferralCode';
import { useRecoverPendingDatabaseSave } from '@features/aria/hooks/useRecoverPendingDatabaseSave';
import { useSaveActiveInterviewProgress } from '@features/aria/hooks/useSaveActiveInterviewProgress';
import { useDebouncedLiveTranscriptSync } from '@features/aria/hooks/useDebouncedLiveTranscriptSync';
import { useInterviewScenarioTransitionUi } from '@features/aria/hooks/useInterviewScenarioTransitionUi';
import { useProfileNameSourceDebugLog } from '@features/aria/hooks/useProfileNameSourceDebugLog';
import { useInterviewScrollToEndOnMessages } from '@features/aria/hooks/useInterviewScrollToEndOnMessages';
import {
  useAdminEmailFromSession,
  useAriaScreenMountedLog,
  useMicPermissionOnMount,
  useStorageFallbackListener,
} from '@features/aria/hooks/useInterviewScreenBootEffects';
import { useEnsureValidSessionCallback } from '@features/aria/hooks/useInterviewTurnProcessingCallbacks';
import {
  runApplyReferenceCardFromAssistantSpeech,
  runApplyInterviewSpeechComplete,
  runShowChatError,
} from '@features/aria/runReferenceCardFromAssistantSpeech';

export type AriaInterviewBootEffectWiringParams = {
  servicesBaseCtx: AriaInterviewDepsSyncContext;
  remoteLog: AriaScreenBootEffectsDeps['remoteLog'];
  diagnostic: AriaInterviewDiagnosticScreenRefs;
  userId: string | undefined;
  isAdmin: boolean;
  userEmail: string | undefined;
  messages: Array<{ role: string; content?: string }>;
  status: string;
  interviewStatus: string;
  scenarioScores: Record<number, ScenarioScoreResult>;
  scenarioScoresRef: MutableRefObject<Record<number, ScenarioScoreResult>>;
  pendingCompletion: boolean;
  pendingScoringSyncAttemptId: string | null;
  isInterviewAppRoute: boolean;
  preparingHandoffPollTick: number;
  alphaMode: boolean;
  results: unknown;
  preInterviewConsentAge: boolean;
  preInterviewConsentData: boolean;
  currentMessagesRef: MutableRefObject<Array<{ role: string; content?: string }>>;
  setUsingMemoryFallback: (value: boolean) => void;
  setMicPermission: (value: 'granted' | 'denied' | 'prompt' | 'unavailable') => void;
  supabase: AriaInterviewDepsSyncContext['supabase'];
  setIsAdmin: (value: boolean) => void;
  setUserEmail: (value: string | null) => void;
  isAmoraeaAdminConsoleEmail: (email: string | null | undefined) => boolean;
  profile: InterviewFirstNameProfile;
  getInterviewUserFirstNameForPrompt: AriaInterviewDepsSyncContext['getInterviewUserFirstNameForPrompt'];
  writeSessionLog: AriaInterviewDepsSyncContext['writeSessionLog'];
  scrollViewRef: InterviewScrollToEndDeps['scrollViewRef'];
  setMessages: ShowChatErrorDeps['setMessages'];
  setConversationErrorNotice: ShowChatErrorDeps['setConversationErrorNotice'];
  webTtsTabInterruptPendingReplayRef: ApplyInterviewSpeechCompleteDeps['webTtsTabInterruptPendingReplayRef'];
  lastQuestionTextRef: MutableRefObject<string>;
  scenarioAContemptProbeAskedRef: MutableRefObject<boolean>;
  scenarioARepairQuestionAskedRef: MutableRefObject<boolean>;
};

export function useAriaInterviewBootEffectWiring(params: AriaInterviewBootEffectWiringParams) {
  const {
    servicesBaseCtx,
    remoteLog,
    diagnostic,
    userId,
    isAdmin,
    userEmail,
    messages,
    status,
    interviewStatus,
    scenarioScores,
    scenarioScoresRef,
    pendingCompletion,
    pendingScoringSyncAttemptId,
    isInterviewAppRoute,
    preparingHandoffPollTick,
    alphaMode,
    results,
    preInterviewConsentAge,
    preInterviewConsentData,
    currentMessagesRef,
    setUsingMemoryFallback,
    setMicPermission,
    supabase,
    setIsAdmin,
    setUserEmail,
    isAmoraeaAdminConsoleEmail,
    profile,
    getInterviewUserFirstNameForPrompt,
    writeSessionLog,
    scrollViewRef,
    setMessages,
    setConversationErrorNotice,
    webTtsTabInterruptPendingReplayRef,
    lastQuestionTextRef,
    scenarioAContemptProbeAskedRef,
    scenarioARepairQuestionAskedRef,
  } = params;

  const ariaScreenMountedLogDepsRef = useRef({ remoteLog } as Pick<AriaScreenBootEffectsDeps, 'remoteLog'>);
  syncAriaScreenMountedLogDeps(
    ariaScreenMountedLogDepsRef,
    createAriaScreenMountedLogSyncCtxFromScreen(servicesBaseCtx),
  );
  useAriaScreenMountedLog(ariaScreenMountedLogDepsRef, { userId, isAdmin });

  const webGreetingPrefetchDepsRef = useRef({} as InterviewWebGreetingPrefetchDeps);
  syncInterviewWebGreetingPrefetchDeps(
    webGreetingPrefetchDepsRef,
    createInterviewWebGreetingPrefetchSyncCtxFromScreen(servicesBaseCtx),
  );
  useInterviewWebGreetingPrefetch(webGreetingPrefetchDepsRef, {
    status,
    preInterviewConsentAge,
    preInterviewConsentData,
  });

  const interviewAttemptBootstrapDepsRef = useRef({} as InterviewAttemptBootstrapDeps);
  syncInterviewAttemptBootstrapDeps(
    interviewAttemptBootstrapDepsRef,
    createInterviewAttemptBootstrapSyncCtxFromScreen(servicesBaseCtx),
  );
  useInterviewAttemptBootstrap(interviewAttemptBootstrapDepsRef, { userId, isAdmin });

  const ariaInterviewDiagnosticSyncCtx = createAriaInterviewDiagnosticSyncCtxFromScreen(
    servicesBaseCtx,
    diagnostic,
  );

  const syncCurrentMessagesRefDepsRef = useRef({ currentMessagesRef } as SyncCurrentMessagesRefDeps);
  syncSyncCurrentMessagesRefDeps(syncCurrentMessagesRefDepsRef, ariaInterviewDiagnosticSyncCtx);
  useSyncCurrentMessagesRef(syncCurrentMessagesRefDepsRef, messages);

  const elongatingProbeFromMessagesDepsRef = useRef({} as ElongatingProbeFromMessagesDeps);
  syncElongatingProbeFromMessagesDeps(elongatingProbeFromMessagesDepsRef, ariaInterviewDiagnosticSyncCtx);
  useInterviewElongatingProbeFromMessages(elongatingProbeFromMessagesDepsRef, messages);

  const transcriptScenarioLogDepsRef = useRef({} as TranscriptScenarioLogDeps);
  syncTranscriptScenarioLogDeps(transcriptScenarioLogDepsRef, ariaInterviewDiagnosticSyncCtx);
  useInterviewTranscriptScenarioLog(transcriptScenarioLogDepsRef, {
    userId,
    messages: messages as MessageWithScenario[],
  });

  const adminScoreCardRenderLogDepsRef = useRef({} as AdminScoreCardRenderLogDeps);
  syncAdminScoreCardRenderLogDeps(adminScoreCardRenderLogDepsRef, ariaInterviewDiagnosticSyncCtx);
  useInterviewAdminScoreCardRenderLog(adminScoreCardRenderLogDepsRef, {
    isAdmin,
    messages,
    status,
    interviewStatus,
    userId,
  });

  const reasoningProgressResetDepsRef = useRef({ setReasoningProgress: diagnostic.setReasoningProgress } as ReasoningProgressResetDeps);
  syncReasoningProgressResetDeps(reasoningProgressResetDepsRef, ariaInterviewDiagnosticSyncCtx);
  useInterviewReasoningProgressReset(reasoningProgressResetDepsRef, status);

  const networkStatusCheckDepsRef = useRef({} as InterviewNetworkStatusCheckDeps);
  syncInterviewNetworkStatusCheckDeps(networkStatusCheckDepsRef, ariaInterviewDiagnosticSyncCtx);
  useInterviewNetworkStatusCheck(networkStatusCheckDepsRef);

  useStorageFallbackListener(setUsingMemoryFallback);

  const unhandledRejectionSaveDepsRef = useRef({} as InterviewUnhandledRejectionSaveDeps);
  syncInterviewUnhandledRejectionSaveDeps(
    unhandledRejectionSaveDepsRef,
    createInterviewUnhandledRejectionSaveSyncCtxFromScreen(servicesBaseCtx),
  );
  useInterviewUnhandledRejectionSave(unhandledRejectionSaveDepsRef, { userId });

  const ensureValidSessionDepsRef = useRef({} as EnsureValidSessionDeps);
  syncEnsureValidSessionDeps(
    ensureValidSessionDepsRef,
    createEnsureValidSessionSyncCtxFromScreen(servicesBaseCtx),
  );
  const ensureValidSession = useEnsureValidSessionCallback(ensureValidSessionDepsRef);

  const ariaInterviewServicesSyncCtx = createAriaInterviewServicesExtendedSyncCtxFromScreen(servicesBaseCtx, {
    ensureValidSession,
  });

  useMicPermissionOnMount(setMicPermission);

  const authSignedOutSaveDepsRef = useRef({} as InterviewAuthSignedOutSaveDeps);
  syncInterviewAuthSignedOutSaveDeps(
    authSignedOutSaveDepsRef,
    createInterviewAuthSignedOutSaveSyncCtxFromScreen(servicesBaseCtx),
  );
  useInterviewAuthSignedOutSave(authSignedOutSaveDepsRef, { userId });

  useAdminEmailFromSession(supabase, setIsAdmin, setUserEmail, isAmoraeaAdminConsoleEmail);

  const restorePreparingResultsDepsRef = useRef({} as RestorePreparingResultsInterviewStatusDeps);
  syncRestorePreparingResultsInterviewStatusDeps(
    restorePreparingResultsDepsRef,
    createRestorePreparingResultsInterviewStatusSyncCtxFromScreen(servicesBaseCtx),
  );
  useRestorePreparingResultsInterviewStatus(restorePreparingResultsDepsRef, { userId, isAdmin });

  const checkInterviewStatusDepsRef = useRef({} as CheckInterviewStatusDeps);
  syncCheckInterviewStatusDeps(
    checkInterviewStatusDepsRef,
    createCheckInterviewStatusSyncCtxFromScreen(servicesBaseCtx),
  );
  useCheckInterviewStatus(checkInterviewStatusDepsRef, {
    userId,
    userEmail,
    isInterviewAppRoute,
    preparingHandoffPollTick,
  });

  const pendingScoringSyncPollDepsRef = useRef({} as PendingScoringSyncPollDeps);
  syncPendingScoringSyncPollDeps(
    pendingScoringSyncPollDepsRef,
    createPendingScoringSyncPollSyncCtxFromScreen(servicesBaseCtx),
  );
  usePendingScoringSyncPoll(pendingScoringSyncPollDepsRef, {
    pendingScoringSyncAttemptId,
    userId,
    userEmail,
    isInterviewAppRoute,
  });

  const loadingStatusFailsafeDepsRef = useRef({} as InterviewLoadingStatusFailsafeDeps);
  syncInterviewLoadingStatusFailsafeDeps(
    loadingStatusFailsafeDepsRef,
    createInterviewLoadingStatusFailsafeSyncCtxFromScreen(servicesBaseCtx),
  );
  useInterviewLoadingStatusFailsafe(loadingStatusFailsafeDepsRef, { userId, isAdmin });

  const alphaModeCongratulationsFailsafeDepsRef = useRef({} as AlphaModeCongratulationsFailsafeDeps);
  syncAlphaModeCongratulationsFailsafeDeps(
    alphaModeCongratulationsFailsafeDepsRef,
    createAlphaModeCongratulationsFailsafeSyncCtxFromScreen(servicesBaseCtx),
  );
  useAlphaModeCongratulationsFailsafe(alphaModeCongratulationsFailsafeDepsRef, {
    alphaMode,
    userId,
    status,
    interviewStatus,
    hasResults: results != null,
  });

  const loadStandardResultsReferralCodeDepsRef = useRef({} as LoadStandardResultsReferralCodeDeps);
  syncLoadStandardResultsReferralCodeDeps(
    loadStandardResultsReferralCodeDepsRef,
    createLoadStandardResultsReferralCodeSyncCtxFromScreen(servicesBaseCtx),
  );
  useLoadStandardResultsReferralCode(loadStandardResultsReferralCodeDepsRef, {
    status,
    userId,
    userEmail,
    isAdmin,
  });

  const recoverPendingDatabaseSaveDepsRef = useRef({} as RecoverPendingDatabaseSaveDeps);
  syncRecoverPendingDatabaseSaveDeps(
    recoverPendingDatabaseSaveDepsRef,
    createRecoverPendingDatabaseSaveSyncCtxFromScreen(ariaInterviewServicesSyncCtx),
  );
  useRecoverPendingDatabaseSave(recoverPendingDatabaseSaveDepsRef, { userId, isAdmin });

  scenarioScoresRef.current = scenarioScores;

  const saveActiveInterviewProgressDepsRef = useRef({} as SaveActiveInterviewProgressDeps);
  syncSaveActiveInterviewProgressDeps(
    saveActiveInterviewProgressDepsRef,
    createSaveActiveInterviewProgressSyncCtxFromScreen(servicesBaseCtx),
  );
  useSaveActiveInterviewProgress(saveActiveInterviewProgressDepsRef, {
    userId,
    isAdmin,
    status,
    pendingCompletion,
    messages,
    scenarioScores,
  });

  const debouncedLiveTranscriptSyncDepsRef = useRef({} as DebouncedLiveTranscriptSyncDeps);
  syncDebouncedLiveTranscriptSyncDeps(
    debouncedLiveTranscriptSyncDepsRef,
    createDebouncedLiveTranscriptSyncCtxFromScreen(servicesBaseCtx),
  );
  useDebouncedLiveTranscriptSync(debouncedLiveTranscriptSyncDepsRef, {
    userId,
    isAdmin,
    status,
    interviewStatus,
    messages,
  });

  const interviewScenarioTransitionUiDepsRef = useRef({} as InterviewScenarioTransitionUiDeps);
  syncInterviewScenarioTransitionUiDeps(
    interviewScenarioTransitionUiDepsRef,
    createInterviewScenarioTransitionUiSyncCtxFromScreen(servicesBaseCtx),
  );
  useInterviewScenarioTransitionUi(interviewScenarioTransitionUiDepsRef, {
    status,
    isAdmin,
    messages,
  });

  const profileNameSourceDebugDepsRef = useRef({} as ProfileNameSourceDebugDeps);
  syncProfileNameSourceDebugDeps(
    profileNameSourceDebugDepsRef,
    createProfileNameSourceDebugSyncCtxFromScreen(servicesBaseCtx, {
      getInterviewUserFirstNameForPrompt,
      writeSessionLog,
    }),
  );
  useProfileNameSourceDebugLog(profileNameSourceDebugDepsRef, { userId, profile });

  const interviewScrollToEndDepsRef = useRef({ scrollViewRef } as InterviewScrollToEndDeps);
  syncInterviewScrollToEndDeps(
    interviewScrollToEndDepsRef,
    createInterviewScrollToEndSyncCtxFromScreen({ scrollViewRef }),
  );
  useInterviewScrollToEndOnMessages(interviewScrollToEndDepsRef, { messages, status });

  const showChatErrorDepsRef = useRef({ setMessages, setConversationErrorNotice } as ShowChatErrorDeps);
  syncShowChatErrorDeps(
    showChatErrorDepsRef,
    createShowChatErrorSyncCtxFromScreen({ setMessages, setConversationErrorNotice }),
  );
  const showChatError = useCallback(
    (message: string) => runShowChatError(showChatErrorDepsRef.current, message),
    [],
  );

  const applyReferenceCardFromAssistantSpeechRef = useRef<(rawText: string) => void>(() => {});

  const applyReferenceCardDepsRef = useRef({} as ApplyReferenceCardFromAssistantSpeechDeps);
  syncApplyReferenceCardFromAssistantSpeechDeps(
    applyReferenceCardDepsRef,
    {
      ...createApplyReferenceCardFromAssistantSpeechSyncCtxFromScreen(servicesBaseCtx),
      lastQuestionTextRef,
      scenarioAContemptProbeAskedRef,
      scenarioARepairQuestionAskedRef,
    } as AriaInterviewDepsSyncContext,
  );
  const applyReferenceCardFromAssistantSpeech = useCallback((rawText: string) => {
    runApplyReferenceCardFromAssistantSpeech(applyReferenceCardDepsRef.current, rawText);
  }, []);
  applyReferenceCardFromAssistantSpeechRef.current = applyReferenceCardFromAssistantSpeech;

  const applyInterviewSpeechCompleteDepsRef = useRef({} as ApplyInterviewSpeechCompleteDeps);
  syncApplyInterviewSpeechCompleteDeps(
    applyInterviewSpeechCompleteDepsRef,
    createApplyInterviewSpeechCompleteSyncCtxFromScreen({
      webTtsTabInterruptPendingReplayRef,
      applyReferenceCardFromAssistantSpeech,
      currentScenarioRef: servicesBaseCtx.currentScenarioRef,
      currentInterviewMomentRef: servicesBaseCtx.currentInterviewMomentRef,
      interviewMomentsCompleteRef: servicesBaseCtx.interviewMomentsCompleteRef,
      resumeActiveScenarioRef: servicesBaseCtx.resumeActiveScenarioRef,
      interviewSessionIdRef: servicesBaseCtx.interviewSessionIdRef,
    }),
  );
  const applyInterviewSpeechComplete = useCallback(
    (rawText: string) => runApplyInterviewSpeechComplete(applyInterviewSpeechCompleteDepsRef.current, rawText),
    [],
  );

  return {
    ariaInterviewServicesSyncCtx,
    ensureValidSession,
    showChatError,
    applyReferenceCardFromAssistantSpeech,
    applyReferenceCardFromAssistantSpeechRef,
    applyInterviewSpeechComplete,
  };
}
