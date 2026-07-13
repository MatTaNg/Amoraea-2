import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export type InterviewSessionLifecycleLocalScope = {
  status: Pick<
    SyncExtraParams,
    | 'interviewStatus'
    | 'interviewAttemptBootstrap'
    | 'onboardingAutoStartRef'
    | 'webSpeechShouldDeferToUserGesture'
    | 'setWebDesktopAwaitingStartOverlay'
    | 'awaitScreenReadySignal'
    | 'logSessionResumeState'
    | 'awaitEmotionModalForIndex'
    | 'notifyScenarioStarted'
    | 'resetInterviewProgressRefs'
    | 'audioRecorder'
    | 'profile'
    | 'hasResumedRef'
    | 'interviewUserTurnEpochRef'
    | 'resumeLoadingFlowActiveRef'
    | 'setResumeLoadingVisible'
    | 'startInterviewInFlightRef'
    | 'setInterviewStartInFlight'
  >;
  setters: Pick<
    SyncExtraParams,
    | 'setHighestScenarioReached'
    | 'setEmotionItemResponses'
    | 'setEmotionItemsComplete'
    | 'resumeEmotionCatchUpIndicesRef'
    | 'setPendingCompletion'
    | 'setInterviewStatus'
    | 'setStageResults'
    | 'setTouchedConstructs'
    | 'setWebDesktopPendingTtsGestureOverlay'
    | 'setStatus'
    | 'setReferenceCardScenario'
    | 'setReferenceCardPrompt'
    | 'setInterviewUiPhase'
    | 'setMicError'
    | 'setMicPermission'
    | 'setWebResumeWelcomeTapPending'
  >;
  audioDevice: Pick<
    SyncExtraParams,
    | 'setAudioRouteKind'
    | 'setSessionLogPlatform'
    | 'setAudioSessionDeviceSnapshot'
    | 'setLastInterviewDeviceEnvironment'
    | 'setSessionAudioRoutes'
    | 'setSessionAudioHealthNotice'
  >;
};

export function buildInterviewSessionLifecycleLocalSyncExtra(
  scope: InterviewSessionLifecycleLocalScope,
): SyncExtraParams {
  return {
    ...scope.status,
    ...scope.setters,
    ...scope.audioDevice,
  };
}
