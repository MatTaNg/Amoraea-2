import type { MutableRefObject } from 'react';

import type { ApplyRouteProbeAfterResumeDeps } from '@features/aria/applyRouteProbeAfterResumeTypes';
import type { FetchStageScoreDeps } from '@features/aria/fetchStageScoreTypes';
import type { HandleRecordingErrorDeps } from '@features/aria/handleRecordingErrorTypes';
import type { HandleSendTypedDeps } from '@features/aria/handleSendTypedTypes';
import type { LoadPostInterviewFeedbackDeps } from '@features/aria/loadPostInterviewFeedbackTypes';
import type { PerformAdminInterviewResetDeps } from '@features/aria/performAdminInterviewResetTypes';
import type { PerformInterviewRetakeDeps } from '@features/aria/performInterviewRetakeTypes';
import type { SubmitPostInterviewFeedbackDeps } from '@features/aria/submitPostInterviewFeedbackTypes';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsTypes';

export function syncPerformInterviewRetakeDeps(
  ref: MutableRefObject<PerformInterviewRetakeDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    userId: ctx.userId,
    interviewStatusRef: ctx.interviewStatusRef,
    currentInterviewMomentRef: ctx.currentInterviewMomentRef,
    lastQuestionTextRef: ctx.lastQuestionTextRef,
    isInterviewCompleteRef: ctx.isInterviewCompleteRef,
    scoredScenariosRef: ctx.scoredScenariosRef,
    closingQuestionAskedRef: ctx.closingQuestionAskedRef,
    closingQuestionAnsweredRef: ctx.closingQuestionAnsweredRef,
    lastClosingQuestionScenarioRef: ctx.lastClosingQuestionScenarioRef,
    waitingForClosingAdditionRef: ctx.waitingForClosingAdditionRef,
    lastAnsweredClosingScenarioRef: ctx.lastAnsweredClosingScenarioRef,
    onboardingAutoStartRef: ctx.onboardingAutoStartRef,
    hasResumedRef: ctx.hasResumedRef,
    startInterviewInFlightRef: ctx.startInterviewInFlightRef,
    resumeLoadingFlowActiveRef: ctx.resumeLoadingFlowActiveRef,
    setInterviewStartInFlight: ctx.setInterviewStartInFlight,
    setResumeLoadingVisible: ctx.setResumeLoadingVisible,
    responseTimingsRef: ctx.responseTimingsRef,
    probeLogRef: ctx.probeLogRef,
    setMessages: ctx.setMessages,
    setScenarioScores: ctx.setScenarioScores,
    setClosingQuestionState: ctx.setClosingQuestionState,
    setClosingQuestionPending: ctx.setClosingQuestionPending,
    setClosingQuestionScenario: ctx.setClosingQuestionScenario,
    setMicError: ctx.setMicError,
    setPreInterviewConsentAge: ctx.setPreInterviewConsentAge,
    setPreInterviewConsentData: ctx.setPreInterviewConsentData,
    setStatus: ctx.setStatus,
    setResults: ctx.setResults,
    setAnalysisAttemptId: ctx.setAnalysisAttemptId,
    setPendingScoringSyncAttemptId: ctx.setPendingScoringSyncAttemptId,
    setInterviewLastCommittedAttemptId: ctx.setInterviewLastCommittedAttemptId,
    setShowPostInterviewFeedback: ctx.setShowPostInterviewFeedback,
    setPostInterviewRatings: ctx.setPostInterviewRatings,
    setPostInterviewComments: ctx.setPostInterviewComments,
    setPostInterviewGeneralFeedback: ctx.setPostInterviewGeneralFeedback,
    setHasSubmittedPostInterviewFeedback: ctx.setHasSubmittedPostInterviewFeedback,
    setInterviewStatus: ctx.setInterviewStatus,
  } as PerformInterviewRetakeDeps;
}


export function syncHandleRecordingErrorDeps(
  ref: MutableRefObject<HandleRecordingErrorDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    useWebCopy: ctx.useWebCopy,
    setVoiceState: ctx.setVoiceState,
    setMessages: ctx.setMessages,
    speakTextSafe: ctx.speakTextSafe,
  } as HandleRecordingErrorDeps;
}

export function syncApplyRouteProbeAfterResumeDeps(
  ref: MutableRefObject<ApplyRouteProbeAfterResumeDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    userIdRef: ctx.userIdRef,
    lastAudioRouteFingerprintRef: ctx.lastAudioRouteFingerprintRef,
    lastHeadphoneProbeRef: ctx.lastHeadphoneProbeRef,
    setAudioRouteKind: ctx.setAudioRouteKind,
  } as ApplyRouteProbeAfterResumeDeps;
}

export function syncPerformAdminInterviewResetDeps(
  ref: MutableRefObject<PerformAdminInterviewResetDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
    audioRecorder: ctx.audioRecorder,
    recognitionRef: ctx.recognitionRef,
    stopElevenLabsPlayback: ctx.stopElevenLabsPlayback,
    stopElevenLabsSpeech: ctx.stopElevenLabsSpeech,
    clearInterviewFromStorage: ctx.clearInterviewFromStorage,
    setInterviewJustCompletedInSession: ctx.setInterviewJustCompletedInSession,
    isInterviewCompleteRef: ctx.isInterviewCompleteRef,
    hasResumedRef: ctx.hasResumedRef,
    scoredScenariosRef: ctx.scoredScenariosRef,
    closingQuestionAskedRef: ctx.closingQuestionAskedRef,
    closingQuestionAnsweredRef: ctx.closingQuestionAnsweredRef,
    lastClosingQuestionScenarioRef: ctx.lastClosingQuestionScenarioRef,
    waitingForClosingAdditionRef: ctx.waitingForClosingAdditionRef,
    lastAnsweredClosingScenarioRef: ctx.lastAnsweredClosingScenarioRef,
    onboardingAutoStartRef: ctx.onboardingAutoStartRef,
    currentScenarioRef: ctx.currentScenarioRef,
    timingRef: ctx.timingRef,
    lastQuestionTextRef: ctx.lastQuestionTextRef,
    transcriptAtReleaseRef: ctx.transcriptAtReleaseRef,
    pendingCompletionTranscriptRef: ctx.pendingCompletionTranscriptRef,
    waitingMessageIdRef: ctx.waitingMessageIdRef,
    committedScenarioRef: ctx.committedScenarioRef,
    isSpeakingRef: ctx.isSpeakingRef,
    responseTimingsRef: ctx.responseTimingsRef,
    probeLogRef: ctx.probeLogRef,
    setMessages: ctx.setMessages,
    setScenarioScores: ctx.setScenarioScores,
    setClosingQuestionState: ctx.setClosingQuestionState,
    setClosingQuestionPending: ctx.setClosingQuestionPending,
    setClosingQuestionScenario: ctx.setClosingQuestionScenario,
    setMicError: ctx.setMicError,
    setMicWarning: ctx.setMicWarning,
    setResults: ctx.setResults,
    setAnalysisAttemptId: ctx.setAnalysisAttemptId,
    setPendingScoringSyncAttemptId: ctx.setPendingScoringSyncAttemptId,
    setInterviewLastCommittedAttemptId: ctx.setInterviewLastCommittedAttemptId,
    setShowPostInterviewFeedback: ctx.setShowPostInterviewFeedback,
    setPostInterviewRatings: ctx.setPostInterviewRatings,
    setPostInterviewComments: ctx.setPostInterviewComments,
    setPostInterviewGeneralFeedback: ctx.setPostInterviewGeneralFeedback,
    setHasSubmittedPostInterviewFeedback: ctx.setHasSubmittedPostInterviewFeedback,
    setHighestScenarioReached: ctx.setHighestScenarioReached,
    setStageResults: ctx.setStageResults,
    setTouchedConstructs: ctx.setTouchedConstructs,
    setExchangeCount: ctx.setExchangeCount,
    setIsWaiting: ctx.setIsWaiting,
    setCurrentTranscript: ctx.setCurrentTranscript,
    setTypedAnswer: ctx.setTypedAnswer,
    setUsedPersonalExamples: ctx.setUsedPersonalExamples,
    setPendingCompletion: ctx.setPendingCompletion,
    setInterviewUiPhase: ctx.setInterviewUiPhase,
    setReferenceCardScenario: ctx.setReferenceCardScenario,
    setReferenceCardPrompt: ctx.setReferenceCardPrompt,
    setVoiceState: ctx.setVoiceState,
    resetInterviewProgressRefs: ctx.resetInterviewProgressRefs,
    startInterview: ctx.startInterview,
  } as PerformAdminInterviewResetDeps;
}

export function syncHandleSendTypedDeps(
  ref: MutableRefObject<HandleSendTypedDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    userId: ctx.userId,
    ttsLineInFlightRef: ctx.ttsLineInFlightRef,
    lastVoiceTurnLanguageRef: ctx.lastVoiceTurnLanguageRef,
    lastVoiceTurnConfidenceRef: ctx.lastVoiceTurnConfidenceRef,
    touchActivity: ctx.touchActivity,
    setTypedAnswer: ctx.setTypedAnswer,
    setMicWarning: ctx.setMicWarning,
    stopElevenLabsSpeech: ctx.stopElevenLabsSpeech,
    processUserSpeech: ctx.processUserSpeech,
  } as HandleSendTypedDeps;
}

export function syncFetchStageScoreDeps(
  ref: MutableRefObject<FetchStageScoreDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    typologyContext: ctx.typologyContext,
  } as FetchStageScoreDeps;
}

export function syncSubmitPostInterviewFeedbackDeps(
  ref: MutableRefObject<SubmitPostInterviewFeedbackDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    userId: ctx.userId,
    hasSubmittedPostInterviewFeedback: ctx.hasSubmittedPostInterviewFeedback,
    analysisAttemptId: ctx.analysisAttemptId,
    postInterviewRatings: ctx.postInterviewRatings,
    postInterviewComments: ctx.postInterviewComments,
    postInterviewGeneralFeedback: ctx.postInterviewGeneralFeedback,
    supabase: ctx.supabase,
    setPostInterviewFeedbackError: ctx.setPostInterviewFeedbackError,
    setHasSubmittedPostInterviewFeedback: ctx.setHasSubmittedPostInterviewFeedback,
    setShowPostInterviewFeedback: ctx.setShowPostInterviewFeedback,
    showFeedbackNotice: ctx.showFeedbackNotice,
    showMissingAttemptAlert: ctx.showMissingAttemptAlert,
  } as SubmitPostInterviewFeedbackDeps;
}

export function syncLoadPostInterviewFeedbackDeps(
  ref: MutableRefObject<LoadPostInterviewFeedbackDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    userId: ctx.userId,
    interviewStatus: ctx.interviewStatus,
    analysisAttemptId: ctx.analysisAttemptId,
    supabase: ctx.supabase,
    setPostInterviewRatings: ctx.setPostInterviewRatings,
    setPostInterviewComments: ctx.setPostInterviewComments,
    setPostInterviewGeneralFeedback: ctx.setPostInterviewGeneralFeedback,
    setHasSubmittedPostInterviewFeedback: ctx.setHasSubmittedPostInterviewFeedback,
  } as LoadPostInterviewFeedbackDeps;
}
