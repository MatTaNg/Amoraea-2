import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { AriaInterviewScreenInterviewSessionBindings } from '@features/aria/ariaInterviewScreenInterviewSessionBindings';
import type { AriaInterviewScreenInterviewSessionSource } from '@features/aria/ariaInterviewScreenInterviewSessionBindings';
import * as preamble from '@features/aria/ariaInterviewScreenPreambleBindings';
import * as wiring from '@features/aria/ariaInterviewScreenWiringImports';
import { buildAriaInterviewBootEffectWiringParamsFromScreen } from '@features/aria/buildAriaInterviewBootEffectWiringParamsFromScreen';
import { buildAriaInterviewBootMiscDepSyncWiringParamsFromScreen } from '@features/aria/buildAriaInterviewBootMiscDepSyncWiringParamsFromScreen';
import { buildAriaInterviewCoreTtsDepSyncWiringParamsFromScreen } from '@features/aria/buildAriaInterviewCoreTtsDepSyncWiringParamsFromScreen';
import { buildAriaInterviewDocumentTtsDepSyncWiringParamsFromScreen } from '@features/aria/buildAriaInterviewDocumentTtsDepSyncWiringParamsFromScreen';
import { buildAriaInterviewEmotionClosingDepSyncWiringParamsFromScreen } from '@features/aria/buildAriaInterviewEmotionClosingDepSyncWiringParamsFromScreen';
import { buildAriaInterviewGateDepSyncWiringParamsFromScreen } from '@features/aria/buildAriaInterviewGateDepSyncWiringParamsFromScreen';
import { buildAriaInterviewLifecycleDepSyncWiringParamsFromScreen } from '@features/aria/buildAriaInterviewLifecycleDepSyncWiringParamsFromScreen';
import { buildAriaInterviewRenderParamsFromScreen } from '@features/aria/buildAriaInterviewRenderParamsFromScreen';
import { buildAriaInterviewRuntimeDepSyncWiringParamsFromScreen } from '@features/aria/buildAriaInterviewRuntimeDepSyncWiringParamsFromScreen';
import { buildAriaInterviewServicesSyncCtxBaseParamsFromScreen } from '@features/aria/buildAriaInterviewServicesSyncCtxBaseParamsFromScreen';
import { buildAriaInterviewTurnClusterDepSyncWiringParamsFromScreen } from '@features/aria/buildAriaInterviewTurnClusterDepSyncWiringParamsFromScreen';
import { buildAriaInterviewWebTtsPreCoreDepSyncWiringParamsFromScreen } from '@features/aria/buildAriaInterviewWebTtsPreCoreDepSyncWiringParamsFromScreen';
import { useAriaInterviewBootEffectWiring } from '@features/aria/hooks/useAriaInterviewBootEffectWiring';
import { useAriaInterviewBootMiscDepSyncWiring } from '@features/aria/hooks/useAriaInterviewBootMiscDepSyncWiring';
import { useAriaInterviewCoreTtsDepSyncWiring } from '@features/aria/hooks/useAriaInterviewCoreTtsDepSyncWiring';
import { useAriaInterviewDocumentTtsDepSyncWiring } from '@features/aria/hooks/useAriaInterviewDocumentTtsDepSyncWiring';
import { useAriaInterviewEmotionClosingDepSyncWiring } from '@features/aria/hooks/useAriaInterviewEmotionClosingDepSyncWiring';
import { useAriaInterviewGateDepSyncWiring } from '@features/aria/hooks/useAriaInterviewGateDepSyncWiring';
import { useAriaInterviewLifecycleDepSyncWiring } from '@features/aria/hooks/useAriaInterviewLifecycleDepSyncWiring';
import { useAriaInterviewPostBootMiscEffectsWiring } from '@features/aria/hooks/useAriaInterviewPostBootMiscEffectsWiring';
import { useAriaInterviewRuntimeDepSyncWiring } from '@features/aria/hooks/useAriaInterviewRuntimeDepSyncWiring';
import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';
import { useAriaInterviewServicesSyncCtxBase } from '@features/aria/hooks/useAriaInterviewServicesSyncCtxBase';
import { useAriaInterviewTurnClusterDepSyncWiring } from '@features/aria/hooks/useAriaInterviewTurnClusterDepSyncWiring';
import { useAriaInterviewWebTtsPreCoreDepSyncWiring } from '@features/aria/hooks/useAriaInterviewWebTtsPreCoreDepSyncWiring';
import { useAriaScreenDevEnvCheck } from '@features/aria/hooks/useInterviewScreenBootEffects';
import type { AriaInterviewScreenSetupInput } from '@features/aria/ariaInterviewScreenTypes';
import type { AriaInterviewScreenRenderScope } from '@features/aria/renderAriaInterviewScreen';
import type { MutableRefObject } from 'react';

export type UseAriaInterviewScreenWiringParams = {
  navigation: AriaInterviewScreenSetupInput['navigation'];
  route: AriaInterviewScreenSetupInput['route'];
  user: { email?: string | null } | null | undefined;
  signOut: () => void | Promise<void>;
  userId: string;
  userIdRef: MutableRefObject<string>;
  fromValidationTrack: boolean;
  interview: AriaInterviewScreenInterviewSessionSource;
  interviewBindings: AriaInterviewScreenInterviewSessionBindings;
  session: AriaInterviewScreenSessionState;
};

export function useAriaInterviewScreenWiring(
  params: UseAriaInterviewScreenWiringParams,
): AriaInterviewScreenRenderScope {
  const {
    navigation,
    route,
    user,
    signOut,
    userId,
    userIdRef,
    fromValidationTrack,
    interview,
    interviewBindings,
    session,
  } = params;

  const {
    ariaInterviewGateSyncCtx,
    resetInterviewProgressRefs,
    closingQuestionActionsDepsRef,
    interviewAssistantMetaExemptionDepsRef,
  } = useAriaInterviewGateDepSyncWiring(
    buildAriaInterviewGateDepSyncWiringParamsFromScreen({
      userId,
      session,
      micSession: interviewBindings.micSession,
    }),
  );

  const {
    emotionModalOrchestrationDepsRef,
    loadEmotionResponsesForCompletion,
    applyEmotionResponsesToSession,
    handleEmotionInterviewAnswer,
    awaitEmotionModalForIndex,
    runEmotionModalAfterScenarioTransition,
    markClosingQuestionAsked,
    markClosingQuestionAnswered,
  } = useAriaInterviewEmotionClosingDepSyncWiring(
    buildAriaInterviewEmotionClosingDepSyncWiringParamsFromScreen({
      closingQuestionActionsDepsRef,
      interviewAssistantMetaExemptionDepsRef,
      session,
      interview,
    }),
  );

  const isAdminUser = wiring.isAmoraeaAdminConsoleEmail(user?.email);
  const isAdminAccount = session.shell.isAdmin || isAdminUser;
  const shouldShowAdminPanel = session.shell.showAdminPanel && isAdminAccount;

  const openAdminPanelParam = (route.params as { openAdminPanel?: boolean } | undefined)?.openAdminPanel;

  const {
    resolveAssistantScenarioNumber,
    processTurnAudioWithRetry,
    deleteTurnAudioFile,
    handleInterviewSignOut,
    handleBackToValidationReport,
  } = useAriaInterviewBootMiscDepSyncWiring(
    buildAriaInterviewBootMiscDepSyncWiringParamsFromScreen({
      userId,
      navigation,
      signOut,
      session,
      openAdminPanelParam,
      isAdminAccount,
    }),
  );

  /** Once we move to scenario N, scenarios 1..N-1 are locked. */
  const [, setHighestScenarioReached] = useState(1);

  useAriaScreenDevEnvCheck({
    alphaMode: preamble.ALPHA_MODE,
    anthropicApiKey: preamble.ANTHROPIC_API_KEY,
    anthropicProxyUrl: preamble.ANTHROPIC_PROXY_URL,
    getResolvedSupabaseUrl: preamble.getResolvedSupabaseUrl,
  });

  const ariaInterviewServicesSyncCtxBase = useAriaInterviewServicesSyncCtxBase(
    buildAriaInterviewServicesSyncCtxBaseParamsFromScreen({
      navigation,
      userId,
      session,
      interview,
    }),
  );

  const ariaInterviewServicesGateSyncCtx = wiring.composeAriaInterviewServicesGateSyncContextLayer(
    ariaInterviewServicesSyncCtxBase,
    ariaInterviewGateSyncCtx,
  );

  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => preamble.profileRepository.getProfile(userId),
    enabled: !!userId,
  });
  const queryClient = useQueryClient();

  const {
    ariaInterviewServicesSyncCtx,
    ensureValidSession,
    showChatError,
    applyReferenceCardFromAssistantSpeechRef,
    applyInterviewSpeechComplete,
  } = useAriaInterviewBootEffectWiring(
    buildAriaInterviewBootEffectWiringParamsFromScreen({
      servicesBaseCtx: ariaInterviewServicesSyncCtxBase,
      userId,
      userEmail: user?.email,
      profile,
      session,
      interview,
    }),
  );

  const typologyContext = ''; // Optional: load from profile/assessments later

  useAriaInterviewPostBootMiscEffectsWiring({
    egoRepair: {
      userId,
      isAdmin: session.shell.isAdmin,
      typologyContext,
      sourceScreen: route?.name ?? 'unknown',
      enabled: route?.name === 'Amoraea' || route?.name === 'OnboardingInterview',
    },
  });

  const {
    webTtsRuntimeDepsRef,
    isInterviewerOutputActiveForMicGate,
    waitForWebInterviewTtsQuiescentBeforeEmotionModal,
    waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal,
    clearStaleWebInterviewTtsRuntimeLocks,
    interruptAllWebInterviewTtsOutput,
    resolveStaleWebTtsRuntimeLockThresholdMs,
    isMobileWebInterviewTtsSessionActive,
    armMobileWebBackgroundTtsContinue,
    queueMobileWebHtmlResumeAfterScreenReturn,
    speak,
    runWebGestureTtsFlush,
    ensureWebGestureFlushListener,
    detachWebGestureFlushListener,
    dismissTabRestoreOverlay,
    dismissAfterAndroidBackgroundPlaybackEnd,
  } = useAriaInterviewWebTtsPreCoreDepSyncWiring(
    buildAriaInterviewWebTtsPreCoreDepSyncWiringParamsFromScreen({
      session,
      userIdRef,
      boot: { applyInterviewSpeechComplete },
      interviewSession: interviewBindings.webTtsPreCore,
    }),
  );

  const { ariaInterviewWebRuntimeSyncCtx, ariaInterviewRuntimeGateSyncCtx } =
    useAriaInterviewRuntimeDepSyncWiring(
      buildAriaInterviewRuntimeDepSyncWiringParamsFromScreen({
        gateCtx: ariaInterviewGateSyncCtx,
        servicesGateCtx: ariaInterviewServicesGateSyncCtx,
        emotionModalOrchestrationDepsRef,
        webTtsRuntimeDepsRef,
        session,
        interview,
        userIdRef,
        interviewSession: interviewBindings.runtime,
        webTts: {
          ensureWebGestureFlushListener,
          detachWebGestureFlushListener,
          interruptAllWebInterviewTtsOutput,
          waitForWebInterviewTtsQuiescentBeforeEmotionModal,
          waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal,
        },
      }),
    );

  const {
    ariaInterviewCoreSyncCtx,
    ariaInterviewCoreGateServicesBaseSyncCtx,
    ariaInterviewCoreGateServicesFullSyncCtx,
    claudeParallelStreamTtsDepsRef,
  } = useAriaInterviewCoreTtsDepSyncWiring(
    buildAriaInterviewCoreTtsDepSyncWiringParamsFromScreen({
      syncContexts: {
        runtimeGateCtx: ariaInterviewRuntimeGateSyncCtx,
        gateCtx: ariaInterviewGateSyncCtx,
        servicesBaseCtx: ariaInterviewServicesSyncCtxBase,
        servicesFullCtx: ariaInterviewServicesSyncCtx,
      },
      session,
      interviewSession: interviewBindings.coreTts,
      webTts: {
        dismissTabRestoreOverlay,
        dismissAfterAndroidBackgroundPlaybackEnd,
        speak,
      },
      boot: {
        applyInterviewSpeechComplete,
        applyReferenceCardFromAssistantSpeechRef,
      },
    }),
  );

  const {
    webTabRestoreSessionDepsRef,
    deliverRecordingRetryLine,
    fetchStageScoreDepsRef,
    saveScenarioCheckpointDepsRef,
    syncInterviewTtsAfterScreenReturn,
    handleWebTabGestureRestoreTap,
  } = useAriaInterviewDocumentTtsDepSyncWiring(
    buildAriaInterviewDocumentTtsDepSyncWiringParamsFromScreen({
      syncContexts: {
        coreCtx: ariaInterviewCoreSyncCtx,
        servicesBaseCtx: ariaInterviewServicesSyncCtxBase,
        coreGateServicesBaseCtx: ariaInterviewCoreGateServicesBaseSyncCtx,
        webRuntimeCtx: ariaInterviewWebRuntimeSyncCtx,
      },
      session,
      typologyContext,
      interviewSession: interviewBindings.documentTts,
      webTts: {
        ensureWebGestureFlushListener,
        isMobileWebInterviewTtsSessionActive,
        armMobileWebBackgroundTtsContinue,
        isInterviewerOutputActiveForMicGate,
        queueMobileWebHtmlResumeAfterScreenReturn,
        resolveStaleWebTtsRuntimeLockThresholdMs,
        clearStaleWebInterviewTtsRuntimeLocks,
        dismissAfterAndroidBackgroundPlaybackEnd,
        dismissTabRestoreOverlay,
      },
    }),
  );

  const {
    notifyScenarioStarted,
    scoreScenario,
    audioRecorder,
    handlePressStart,
    handlePressEnd,
    handleWebMicPressIn,
    handleNativeOrWhisperMicPress,
    handleSendTyped,
  } = useAriaInterviewTurnClusterDepSyncWiring(
    buildAriaInterviewTurnClusterDepSyncWiringParamsFromScreen({
      syncContexts: {
        coreCtx: ariaInterviewCoreSyncCtx,
        coreGateServicesBaseCtx: ariaInterviewCoreGateServicesBaseSyncCtx,
        gateSyncCtx: ariaInterviewGateSyncCtx,
        webRuntimeCtx: ariaInterviewWebRuntimeSyncCtx,
        servicesGateCtx: ariaInterviewServicesGateSyncCtx,
      },
      documentTts: {
        webTabRestoreSessionDepsRef,
        claudeParallelStreamTtsDepsRef,
        fetchStageScoreDepsRef,
        saveScenarioCheckpointDepsRef,
        deliverRecordingRetryLine,
        syncInterviewTtsAfterScreenReturn,
      },
      webTts: {
        runWebGestureTtsFlush,
        clearStaleWebInterviewTtsRuntimeLocks,
        queueMobileWebHtmlResumeAfterScreenReturn,
        isInterviewerOutputActiveForMicGate,
        isMobileWebInterviewTtsSessionActive,
        armMobileWebBackgroundTtsContinue,
      },
      boot: {
        applyInterviewSpeechComplete,
        showChatError,
        resolveAssistantScenarioNumber,
        processTurnAudioWithRetry,
        deleteTurnAudioFile,
      },
      emotion: {
        awaitEmotionModalForIndex,
        runEmotionModalAfterScenarioTransition,
        markClosingQuestionAsked,
        markClosingQuestionAnswered,
      },
      session,
      interview,
      queryClient,
      setHighestScenarioReached,
      interviewSession: interviewBindings.turnCluster,
    }),
  );

  const {
    handleWebResumeWelcomeTap,
    startInterview,
    handleMobileWebTapToBegin,
    handleRetake,
    handleAdminResetInterview,
    handleSubmitPostInterviewFeedback,
  } = useAriaInterviewLifecycleDepSyncWiring(
    buildAriaInterviewLifecycleDepSyncWiringParamsFromScreen({
      syncContexts: {
        coreCtx: ariaInterviewCoreSyncCtx,
        coreGateServicesBaseCtx: ariaInterviewCoreGateServicesBaseSyncCtx,
        coreGateServicesFullSyncCtx: ariaInterviewCoreGateServicesFullSyncCtx,
        servicesBaseCtx: ariaInterviewServicesSyncCtxBase,
      },
      session,
      route,
      navigation,
      user,
      userId,
      fromValidationTrack,
      typologyContext,
      queryClient,
      profile,
      interview,
      interviewSession: interviewBindings.lifecycle,
      boot: {
        ensureValidSession,
        resetInterviewProgressRefs,
      },
      emotion: {
        awaitEmotionModalForIndex,
        loadEmotionResponsesForCompletion,
        applyEmotionResponsesToSession,
      },
      turnCluster: {
        notifyScenarioStarted,
        scoreScenario,
        audioRecorder,
      },
      setHighestScenarioReached,
    }),
  );

  return buildAriaInterviewRenderParamsFromScreen({
    session,
    navigation,
    route,
    user,
    userId,
    signOut,
    fromValidationTrack,
    isAdminAccount,
    shouldShowAdminPanel,
    interviewSession: {
      ...interviewBindings.render,
      audioRecorder,
    },
    handlers: {
      handleAdminResetInterview,
      handleInterviewSignOut,
      handleSubmitPostInterviewFeedback,
      handleBackToValidationReport,
      startInterview,
      handleMobileWebTapToBegin,
      handleRetake,
      handleEmotionInterviewAnswer,
      handlePressStart,
      handlePressEnd,
      handleNativeOrWhisperMicPress,
      handleWebMicPressIn,
      handleSendTyped,
      runWebGestureTtsFlush,
      handleWebTabGestureRestoreTap,
      handleWebResumeWelcomeTap,
    },
  });
}
