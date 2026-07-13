import * as preamble from '@features/aria/ariaInterviewScreenPreambleBindings';
import * as wiring from '@features/aria/ariaInterviewScreenWiringImports';
import type { AriaInterviewServicesScreenRefsParams } from '@features/aria/buildAriaInterviewServicesScreenScopeInput';
import type { useAriaInterviewSession } from '@features/aria/hooks/useAriaInterviewSession';
import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';

export type BuildAriaInterviewServicesSyncCtxBaseParamsFromScreenInput = {
  navigation: unknown;
  userId: string;
  session: AriaInterviewScreenSessionState;
  interview: ReturnType<typeof useAriaInterviewSession>;
};

/** Assemble services-base sync-ctx params from grouped session state + live interview refs. */
export function buildAriaInterviewServicesSyncCtxBaseParamsFromScreen(
  input: BuildAriaInterviewServicesSyncCtxBaseParamsFromScreenInput,
): AriaInterviewServicesScreenRefsParams {
  const { navigation, userId, session, interview } = input;
  const { messages, currentMessagesRef } = interview;
  const { shell, gate } = session;
  const {
    isAdmin,
    scenarioScores,
    scoredScenariosRef,
    scenarioScoresRef,
    statusRef,
    interviewStatusRef,
    isInterviewCompleteRef,
    interviewSessionAttemptIdRef,
    committedScenarioRef,
    setInterviewAttemptBootstrap,
    setSessionExpired,
    setInterviewStatus,
    setAnalysisAttemptId,
    setPendingScoringSyncAttemptId,
    setStandardResultsReferralCode,
    setInterviewUiPhase,
    setReferenceCardPrompt,
    setReferenceCardScenario,
  } = shell;
  const { interviewSessionIdRef } = gate.progressReset;
  const { resumeActiveScenarioRef, emotionItemResponsesRef } = gate.resumeEmotion;
  const { moment5PrimaryAnchorDeliveredSessionRef, responseTimingsRef } = gate.moments;

  return {
    identity: {
      hasAnthropicConfigured: !!preamble.ANTHROPIC_API_KEY || !!preamble.ANTHROPIC_PROXY_URL,
      userId,
      isAdmin,
      supabase: wiring.supabase,
      navigation,
      isAmoraeaAdminConsoleEmail: wiring.isAmoraeaAdminConsoleEmail,
      remoteLog: wiring.remoteLog,
    },
    sessionRefs: {
      statusRef,
      interviewStatusRef,
      isInterviewCompleteRef,
      interviewSessionAttemptIdRef,
      interviewSessionIdRef,
      currentMessagesRef,
      scoredScenariosRef,
      scenarioScoresRef,
      resumeActiveScenarioRef,
      emotionItemResponsesRef,
      committedScenarioRef,
      moment5PrimaryAnchorDeliveredSessionRef,
      responseTimingsRef,
    },
    liveState: {
      messages,
      scenarioScores,
    },
    storagePipeline: {
      resolveInterviewCompletedForUser: wiring.resolveInterviewCompletedForUser,
      takeInterviewJustCompletedInSession: wiring.takeInterviewJustCompletedInSession,
      takeInterviewLastCommittedAttemptId: wiring.takeInterviewLastCommittedAttemptId,
      hasPreparingResultsSession: wiring.hasPreparingResultsSession,
      markPreparingResultsSession: wiring.markPreparingResultsSession,
      clearPreparingResultsSession: wiring.clearPreparingResultsSession,
      waitForInterviewAttemptScoringReady: wiring.waitForInterviewAttemptScoringReady,
      clearInterviewFromStorage: wiring.clearInterviewFromStorage,
      loadInterviewFromStorage: wiring.loadInterviewFromStorage,
      saveInterviewProgress: wiring.saveInterviewProgress,
      replaceWithStandardApplicantPostInterviewHandoffForUser:
        preamble.replaceWithStandardApplicantPostInterviewHandoffForUser,
      runCommunicationStylePipelineAfterSave: wiring.runCommunicationStylePipelineAfterSave,
      getSessionLogRuntime: wiring.getSessionLogRuntime,
      resolveStandardPostInterviewHandoffEligible: preamble.resolveStandardPostInterviewHandoffEligible,
      isValidationTrackInterviewHandoffActive: wiring.isValidationTrackInterviewHandoffActive,
      syncLiveInterviewTranscriptToAttempt: wiring.syncLiveInterviewTranscriptToAttempt,
    },
    bootstrap: {
      setInterviewAttemptBootstrap,
      resetSessionLogRuntime: wiring.resetSessionLogRuntime,
      markSessionResumedForNextRecordingStart: wiring.markSessionResumedForNextRecordingStart,
      syncWebAudioRouteSessionEnvelopeFromCache: wiring.syncWebAudioRouteSessionEnvelopeFromCache,
    },
    uiSetters: {
      setSessionExpired,
      setInterviewStatus,
      setAnalysisAttemptId,
      setPendingScoringSyncAttemptId,
      setStandardResultsReferralCode,
      setInterviewUiPhase,
      setReferenceCardPrompt,
      setReferenceCardScenario,
    },
    transcriptHelpers: {
      isAssistantBubbleForTranscript: preamble.isAssistantBubbleForTranscript,
      stripControlTokens: wiring.stripControlTokens,
      detectActiveScenarioFromMessage: wiring.detectActiveScenarioFromMessage,
    },
  };
}
