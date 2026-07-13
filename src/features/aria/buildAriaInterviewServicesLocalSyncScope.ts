import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export type AriaInterviewServicesIdentityLocalScope = Pick<
  SyncExtraParams,
  | 'hasAnthropicConfigured'
  | 'userId'
  | 'isAdmin'
  | 'supabase'
  | 'navigation'
  | 'isAmoraeaAdminConsoleEmail'
  | 'remoteLog'
>;

export type AriaInterviewServicesSessionRefsLocalScope = Pick<
  SyncExtraParams,
  | 'statusRef'
  | 'interviewStatusRef'
  | 'isInterviewCompleteRef'
  | 'interviewSessionAttemptIdRef'
  | 'interviewSessionIdRef'
  | 'currentMessagesRef'
  | 'scoredScenariosRef'
  | 'scenarioScoresRef'
  | 'resumeActiveScenarioRef'
  | 'emotionItemResponsesRef'
  | 'committedScenarioRef'
  | 'moment5PrimaryAnchorDeliveredSessionRef'
  | 'responseTimingsRef'
>;

export type AriaInterviewServicesLiveStateLocalScope = Pick<
  SyncExtraParams,
  'messages' | 'scenarioScores'
>;

export type AriaInterviewServicesStoragePipelineLocalScope = Pick<
  SyncExtraParams,
  | 'resolveInterviewCompletedForUser'
  | 'takeInterviewJustCompletedInSession'
  | 'takeInterviewLastCommittedAttemptId'
  | 'hasPreparingResultsSession'
  | 'markPreparingResultsSession'
  | 'clearPreparingResultsSession'
  | 'waitForInterviewAttemptScoringReady'
  | 'clearInterviewFromStorage'
  | 'loadInterviewFromStorage'
  | 'saveInterviewProgress'
  | 'replaceWithStandardApplicantPostInterviewHandoffForUser'
  | 'runCommunicationStylePipelineAfterSave'
  | 'getSessionLogRuntime'
  | 'resolveStandardPostInterviewHandoffEligible'
  | 'isValidationTrackInterviewHandoffActive'
  | 'syncLiveInterviewTranscriptToAttempt'
>;

export type AriaInterviewServicesBootstrapLocalScope = Pick<
  SyncExtraParams,
  | 'setInterviewAttemptBootstrap'
  | 'resetSessionLogRuntime'
  | 'markSessionResumedForNextRecordingStart'
  | 'syncWebAudioRouteSessionEnvelopeFromCache'
>;

export type AriaInterviewServicesUiSettersLocalScope = Pick<
  SyncExtraParams,
  | 'setSessionExpired'
  | 'setInterviewStatus'
  | 'setAnalysisAttemptId'
  | 'setPendingScoringSyncAttemptId'
  | 'setStandardResultsReferralCode'
  | 'setInterviewUiPhase'
  | 'setReferenceCardPrompt'
  | 'setReferenceCardScenario'
>;

export type AriaInterviewServicesTranscriptHelpersLocalScope = Pick<
  SyncExtraParams,
  'isAssistantBubbleForTranscript' | 'stripControlTokens' | 'detectActiveScenarioFromMessage'
>;
