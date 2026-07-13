import * as preamble from '@features/aria/ariaInterviewScreenPreambleBindings';
import * as wiring from '@features/aria/ariaInterviewScreenWiringImports';
import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';
import type { AriaInterviewScreenRenderScope } from '@features/aria/renderAriaInterviewScreen';
import type { MutableRefObject } from 'react';

export type BuildAriaInterviewRenderParamsFromScreenInput = {
  session: AriaInterviewScreenSessionState;
  navigation: unknown;
  route: { name?: string; params?: { onComplete?: (results: unknown) => void } };
  user: { email?: string | null } | null | undefined;
  userId: string;
  signOut: () => void | Promise<void>;
  fromValidationTrack: boolean;
  isAdminAccount: boolean;
  shouldShowAdminPanel: boolean;
  interviewSession: {
    status: string;
    voiceState: AriaInterviewScreenRenderScope['activeShell']['interviewerMic']['voiceState'];
    currentTranscript: string;
    useMediaRecorderPath: boolean;
    webInterviewerOutputActive: boolean;
    useTapMicUi: boolean;
    mobileWebTapToBeginDone: boolean;
    webDesktopAwaitingStartOverlay: boolean;
    webDesktopPendingTtsGestureOverlay: boolean;
    webTabGestureRestoreOverlay: boolean;
    interviewStartInFlight: boolean;
    onboardingAutoStartRef: MutableRefObject<boolean>;
    micError: string | null;
    micPermission: 'granted' | 'denied' | 'prompt' | 'unavailable';
    micWarning: string | null;
    preInitMeterLevel: number;
    micSessionRecovering: boolean;
    micNeedsReconnect: boolean;
    setMicNeedsReconnect: (value: boolean) => void;
    lateStartIdleCueVisible: boolean;
    webInsecureContextMessage: string | null;
    audioRecorder: AriaInterviewScreenRenderScope['activeShell']['interviewerMic']['audioRecorder'];
    setWebDesktopAwaitingStartOverlay: (value: boolean) => void;
    setMicError: (value: string | null) => void;
  };
  handlers: {
    handleAdminResetInterview: AriaInterviewScreenRenderScope['adminBar']['handleAdminResetInterview'];
    handleInterviewSignOut: AriaInterviewScreenRenderScope['adminBar']['handleInterviewSignOut'];
    handleSubmitPostInterviewFeedback: AriaInterviewScreenRenderScope['router']['postInterviewFeedback']['handlers']['handleSubmitPostInterviewFeedback'];
    handleBackToValidationReport: AriaInterviewScreenRenderScope['router']['postInterviewFeedback']['handlers']['handleBackToValidationReport'];
    startInterview: AriaInterviewScreenRenderScope['router']['startConsent']['startInterview'];
    handleMobileWebTapToBegin: AriaInterviewScreenRenderScope['router']['startConsent']['handleMobileWebTapToBegin'];
    handleRetake: AriaInterviewScreenRenderScope['router']['sessionAuth']['handleRetake'];
    handleEmotionInterviewAnswer: AriaInterviewScreenRenderScope['activeShell']['emotionModal']['onEmotionInterviewAnswer'];
    handlePressStart: AriaInterviewScreenRenderScope['activeShell']['interviewerMic']['handlePressStart'];
    handlePressEnd: AriaInterviewScreenRenderScope['activeShell']['interviewerMic']['handlePressEnd'];
    handleNativeOrWhisperMicPress: AriaInterviewScreenRenderScope['activeShell']['interviewerMic']['handleNativeOrWhisperMicPress'];
    handleWebMicPressIn: AriaInterviewScreenRenderScope['activeShell']['interviewerMic']['handleWebMicPressIn'];
    handleSendTyped: AriaInterviewScreenRenderScope['activeShell']['adminResults']['handleSendTyped'];
    runWebGestureTtsFlush: AriaInterviewScreenRenderScope['activeShell']['webGestures']['runWebGestureTtsFlush'];
    handleWebTabGestureRestoreTap: AriaInterviewScreenRenderScope['activeShell']['webGestures']['handleWebTabGestureRestoreTap'];
    handleWebResumeWelcomeTap: AriaInterviewScreenRenderScope['activeShell']['webGestures']['handleWebResumeWelcomeTap'];
  };
};

/** Assemble renderAriaInterviewScreen scope from session state + hook handlers. */
export function buildAriaInterviewRenderParamsFromScreen(
  input: BuildAriaInterviewRenderParamsFromScreenInput,
): AriaInterviewScreenRenderScope {
  const {
    session,
    navigation,
    route,
    user,
    userId,
    signOut,
    fromValidationTrack,
    isAdminAccount,
    shouldShowAdminPanel,
    interviewSession,
    handlers,
  } = input;
  const { shell, gate } = session;
  const {
    sessionExpired,
    setSessionExpired,
    setShowAdminPanel,
    interviewStatus,
    pendingCompletion,
    resumeLoadingVisible,
    analysisAttemptId,
    isAdmin,
    postInterviewFeedback,
    preInterviewConsentAge,
    setPreInterviewConsentAge,
    preInterviewConsentData,
    setPreInterviewConsentData,
    interviewAttemptBootstrap,
    emotionModalVisible,
    emotionModalItemIndex,
    emotionItemsComplete,
    interviewUiPhase,
    referenceCardScenario,
    referenceCardPrompt,
    ttsPlaybackReliabilityNotice,
    sessionAudioHealthNotice,
    conversationErrorNotice,
    isWaiting,
    results,
    stageResults,
    messages,
    scrollViewRef,
    reasoningProgress,
    standardResultsReferralCode,
    standardResultsReferralCopyFeedback,
    typedAnswer,
    setTypedAnswer,
    setStatus,
    setInterviewStatus,
    setStandardResultsReferralCopyFeedback,
    interviewSessionAttemptIdRef,
    webResumeWelcomeTapPending,
  } = shell;
  const { resumeOfferWelcomeTtsRef } = gate.resumeEmotion;
  const { webTabRestoreReplayInFlightRef } = gate.webTts;
  const { interviewSessionIdRef } = gate.progressReset;
  const {
    status,
    voiceState,
    currentTranscript,
    useMediaRecorderPath,
    webInterviewerOutputActive,
    useTapMicUi,
    mobileWebTapToBeginDone,
    webDesktopAwaitingStartOverlay,
    webDesktopPendingTtsGestureOverlay,
    webTabGestureRestoreOverlay,
    interviewStartInFlight,
    onboardingAutoStartRef,
    micError,
    micPermission,
    micWarning,
    preInitMeterLevel,
    micSessionRecovering,
    micNeedsReconnect,
    setMicNeedsReconnect,
    lateStartIdleCueVisible,
    webInsecureContextMessage,
    audioRecorder,
    setWebDesktopAwaitingStartOverlay,
    setMicError,
  } = interviewSession;

  return {
    adminBar: {
      isAdminAccount,
      setShowAdminPanel,
      handleAdminResetInterview: handlers.handleAdminResetInterview,
      handleInterviewSignOut: handlers.handleInterviewSignOut,
    },
    router: {
      routing: {
        sessionExpired,
        interviewStatus,
        status,
        fromValidationTrack,
        pendingCompletion,
        resumeLoadingVisible,
      },
      adminAccess: {
        shouldShowAdminPanel,
        alphaMode: preamble.ALPHA_MODE,
        analysisAttemptId,
        isAdmin,
        isAdminAccount,
        userId,
      },
      postInterviewFeedback: {
        state: postInterviewFeedback,
        handlers: {
          handleSubmitPostInterviewFeedback: handlers.handleSubmitPostInterviewFeedback,
          handleBackToValidationReport: handlers.handleBackToValidationReport,
        },
      },
      startConsent: {
        micError,
        micPermission,
        micWarning,
        mobileWebTapToBeginDone,
        webDesktopAwaitingStartOverlay,
        preInterviewConsentAge,
        preInterviewConsentData,
        interviewStartInFlight,
        interviewAttemptBootstrap,
        onboardingAutoStartRef,
        webSpeechShouldDeferToUserGesture: wiring.webSpeechShouldDeferToUserGesture,
        setMicError,
        setWebDesktopAwaitingStartOverlay,
        setPreInterviewConsentAge,
        setPreInterviewConsentData,
        startInterview: handlers.startInterview,
        handleMobileWebTapToBegin: handlers.handleMobileWebTapToBegin,
      },
      sessionAuth: {
        supabase: wiring.supabase,
        signOut,
        setSessionExpired,
        setShowAdminPanel,
        handleInterviewSignOut: handlers.handleInterviewSignOut,
        handleRetake: handlers.handleRetake,
      },
    },
    activeShell: {
      layout: {
        isAdmin,
        status,
        emotionModalVisible,
        webTabGestureRestoreOverlay,
        webResumeWelcomeTapPending,
        webDesktopPendingTtsGestureOverlay,
      },
      emotionModal: {
        emotionModalVisible,
        emotionModalItemIndex,
        emotionItemsComplete,
        onEmotionInterviewAnswer: handlers.handleEmotionInterviewAnswer,
      },
      interviewerMic: {
        useMediaRecorderPath,
        audioRecorder,
        voiceState,
        webInterviewerOutputActive,
        interviewUiPhase,
        referenceCardScenario,
        referenceCardPrompt,
        ttsPlaybackReliabilityNotice,
        webInsecureContextMessage,
        sessionAudioHealthNotice,
        conversationErrorNotice,
        micPermission,
        isWaiting,
        handlePressStart: handlers.handlePressStart,
        handlePressEnd: handlers.handlePressEnd,
        micError,
        micWarning,
        useTapMicUi,
        handleNativeOrWhisperMicPress: handlers.handleNativeOrWhisperMicPress,
        handleWebMicPressIn: handlers.handleWebMicPressIn,
        handleInterviewSignOut: handlers.handleInterviewSignOut,
        preInitMeterLevel,
        micSessionRecovering,
        micNeedsReconnect,
        setMicNeedsReconnect,
        lateStartIdleCueVisible,
      },
      adminResults: {
        results,
        stageResults,
        messages,
        scrollViewRef,
        currentTranscript,
        reasoningProgress,
        userId,
        userEmail: user?.email,
        standardResultsReferralCode,
        standardResultsReferralCopyFeedback,
        typedAnswer,
        handleSendTyped: handlers.handleSendTyped,
        setTypedAnswer,
        setStatus,
        setInterviewStatus,
        setStandardResultsReferralCopyFeedback,
      },
      handoff: {
        navigation,
        route,
        interviewSessionIdRef,
        replaceWithStandardApplicantPostInterviewHandoffForUser:
          preamble.replaceWithStandardApplicantPostInterviewHandoffForUser,
      },
      webGestures: {
        resumeOfferWelcomeTtsRef,
        webTabRestoreReplayInFlightRef,
        runWebGestureTtsFlush: handlers.runWebGestureTtsFlush,
        handleWebTabGestureRestoreTap: handlers.handleWebTabGestureRestoreTap,
        handleWebResumeWelcomeTap: handlers.handleWebResumeWelcomeTap,
        interviewSessionAttemptIdRef,
      },
    },
  };
}
