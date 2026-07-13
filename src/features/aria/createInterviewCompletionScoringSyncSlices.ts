import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewCompletionScoringIdentitySyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userId: params.userId,
    isAdmin: params.isAdmin,
    typologyContext: params.typologyContext,
    routeName: params.routeName,
    userEmail: params.userEmail,
    profile: params.profile,
    fromValidationTrack: params.fromValidationTrack,
    navigation: params.navigation,
    queryClient: params.queryClient,
  };
}

export function createInterviewCompletionScoringActionsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    ensureValidSession: params.ensureValidSession,
    scoreScenario: params.scoreScenario,
    setScenarioScores: params.setScenarioScores,
    setResults: params.setResults,
    setStageResults: params.setStageResults,
    setInterviewStatus: params.setInterviewStatus,
    setStatus: params.setStatus,
    setPendingScoringSyncAttemptId: params.setPendingScoringSyncAttemptId,
    loadEmotionResponsesForCompletion: params.loadEmotionResponsesForCompletion,
    applyEmotionResponsesToSession: params.applyEmotionResponsesToSession,
    markCompletionScoringInFlight: params.markCompletionScoringInFlight,
    replaceWithStandardApplicantPostInterviewHandoffForUser:
      params.replaceWithStandardApplicantPostInterviewHandoffForUser,
    setInterviewLastCommittedAttemptId: params.setInterviewLastCommittedAttemptId,
    setReasoningProgress: params.setReasoningProgress,
    setAnalysisAttemptId: params.setAnalysisAttemptId,
  };
}

export function createInterviewCompletionScoringRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    scoreInterviewInFlightRef: params.scoreInterviewInFlightRef,
    scoreInterviewAttemptedRef: params.scoreInterviewAttemptedRef,
    interviewSessionAttemptIdRef: params.interviewSessionAttemptIdRef,
    interviewSessionIdRef: params.interviewSessionIdRef,
    interviewStatusRef: params.interviewStatusRef,
    emotionItemResponsesRef: params.emotionItemResponsesRef,
    scenarioScoresRef: params.scenarioScoresRef,
    scoredScenariosRef: params.scoredScenariosRef,
    probeLogRef: params.probeLogRef,
    moment4SpecificityScoringRef: params.moment4SpecificityScoringRef,
    moment5ClientScoringMetaRef: params.moment5ClientScoringMetaRef,
    moment5AccountabilityProbeFiredRef: params.moment5AccountabilityProbeFiredRef,
    responseTimingsRef: params.responseTimingsRef,
    scenarioSkipConfirmedCountRef: params.scenarioSkipConfirmedCountRef,
    deferredMoment4NarrativeRef: params.deferredMoment4NarrativeRef,
  };
}
