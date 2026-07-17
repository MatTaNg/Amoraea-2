import type { AriaInterviewActiveShellProps } from '@features/aria/screens/AriaInterviewActiveShell';

export type AriaInterviewActiveShellScope = {
  layout: Pick<
    AriaInterviewActiveShellProps,
    'adminInterviewTopBar' | 'isAdmin' | 'status' | 'isInterviewerView' | 'inputDisabled'
  >;
  emotionModal: Pick<
    AriaInterviewActiveShellProps,
    | 'emotionModalVisible'
    | 'emotionModalItemIndex'
    | 'emotionItemsComplete'
    | 'onEmotionInterviewAnswer'
  >;
  interviewerMic: Pick<
    AriaInterviewActiveShellProps,
    | 'audioRecorder'
    | 'voiceState'
    | 'interviewerOutputActive'
    | 'interviewUiPhase'
    | 'referenceCardScenario'
    | 'referenceCardPrompt'
    | 'ttsPlaybackReliabilityNotice'
    | 'sessionAudioHealthNotice'
    | 'conversationErrorNotice'
    | 'micPermission'
    | 'isWaiting'
    | 'handlePressStart'
    | 'handlePressEnd'
    | 'micError'
    | 'micWarning'
    | 'useTapMicUi'
    | 'handleNativeOrWhisperMicPress'
    | 'handleInterviewSignOut'
    | 'preInitMeterLevel'
    | 'micSessionRecovering'
    | 'micNeedsReconnect'
    | 'setMicNeedsReconnect'
    | 'lateStartIdleCueVisible'
  >;
  adminResults: Pick<
    AriaInterviewActiveShellProps,
    | 'results'
    | 'stageResults'
    | 'messages'
    | 'scrollViewRef'
    | 'currentTranscript'
    | 'reasoningProgress'
    | 'userId'
    | 'userEmail'
    | 'standardResultsReferralCode'
    | 'standardResultsReferralCopyFeedback'
    | 'typedAnswer'
    | 'handleSendTyped'
    | 'setTypedAnswer'
    | 'setStatus'
    | 'setInterviewStatus'
    | 'setStandardResultsReferralCopyFeedback'
  >;
  handoff: Pick<
    AriaInterviewActiveShellProps,
    | 'navigation'
    | 'routeName'
    | 'interviewSessionIdRef'
    | 'replaceWithStandardApplicantPostInterviewHandoffForUser'
    | 'routeOnComplete'
  >;
  webGestures: Pick<AriaInterviewActiveShellProps, 'interviewSessionAttemptIdRef'>;
};

/** Merge grouped active-shell props into the flat shape expected by AriaInterviewActiveShell. */
export function buildAriaInterviewActiveShellProps(
  scope: AriaInterviewActiveShellScope,
): AriaInterviewActiveShellProps {
  return {
    ...scope.layout,
    ...scope.emotionModal,
    ...scope.interviewerMic,
    ...scope.adminResults,
    ...scope.handoff,
    ...scope.webGestures,
  };
}
