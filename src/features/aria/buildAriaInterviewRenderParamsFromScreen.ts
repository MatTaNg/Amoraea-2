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
    interviewerOutputActive: boolean;
    useTapMicUi: boolean;
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
    audioRecorder: AriaInterviewScreenRenderScope['activeShell']['interviewerMic']['audioRecorder'];
    setMicError: (value: string | null) => void;
  };
  handlers: {
    handleAdminResetInterview: AriaInterviewScreenRenderScope['adminBar']['handleAdminResetInterview'];
    handleInterviewSignOut: AriaInterviewScreenRenderScope['adminBar']['handleInterviewSignOut'];
    handleSubmitPostInterviewFeedback: AriaInterviewScreenRenderScope['router']['postInterviewFeedback']['handlers']['handleSubmitPostInterviewFeedback'];
    handleBackToValidationReport: AriaInterviewScreenRenderScope['router']['postInterviewFeedback']['handlers']['handleBackToValidationReport'];
    startInterview: AriaInterviewScreenRenderScope['router']['startConsent']['startInterview'];
    handleRetake: AriaInterviewScreenRenderScope['router']['sessionAuth']['handleRetake'];
    handleEmotionInterviewAnswer: AriaInterviewScreenRenderScope['activeShell']['emotionModal']['onEmotionInterviewAnswer'];
    handlePressStart: AriaInterviewScreenRenderScope['activeShell']['interviewerMic']['handlePressStart'];
    handlePressEnd: AriaInterviewScreenRenderScope['activeShell']['interviewerMic']['handlePressEnd'];
    handleNativeOrWhisperMicPress: AriaInterviewScreenRenderScope['activeShell']['interviewerMic']['handleNativeOrWhisperMicPress'];
    handleSendTyped: AriaInterviewScreenRenderScope['activeShell']['adminResults']['handleSendTyped'];
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
  } = shell;
  const { interviewSessionIdRef } = gate.progressReset;
  const {
    status,
    voiceState,
    currentTranscript,
    interviewerOutputActive,
    useTapMicUi,
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
    audioRecorder,
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
        preInterviewConsentAge,
        preInterviewConsentData,
        interviewStartInFlight,
        interviewAttemptBootstrap,
        onboardingAutoStartRef,
        setMicError,
        setPreInterviewConsentAge,
        setPreInterviewConsentData,
        startInterview: handlers.startInterview,
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
      },
      emotionModal: {
        emotionModalVisible,
        emotionModalItemIndex,
        emotionItemsComplete,
        onEmotionInterviewAnswer: handlers.handleEmotionInterviewAnswer,
      },
      interviewerMic: {
        audioRecorder,
        voiceState,
        interviewerOutputActive,
        interviewUiPhase,
        referenceCardScenario,
        referenceCardPrompt,
        ttsPlaybackReliabilityNotice,
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
        interviewSessionAttemptIdRef,
      },
    },
  };
}
