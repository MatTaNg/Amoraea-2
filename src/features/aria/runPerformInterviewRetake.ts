import { enableInterviewRetake } from '@features/interview/interviewRetake';
import type { PerformInterviewRetakeDeps } from '@features/aria/performInterviewRetakeTypes';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';

export async function runPerformInterviewRetake(deps: PerformInterviewRetakeDeps): Promise<void> {
  if (!deps.userId) return;
  if (
    deps.interviewStatusRef.current === 'in_progress' ||
    deps.interviewStatusRef.current === 'preparing_results'
  ) {
    const r = getSessionLogRuntime();
    writeSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 'session_dropout',
      eventData: {
        dropout_point: {
          moment_number: deps.currentInterviewMomentRef.current,
          last_question_delivered: (deps.lastQuestionTextRef.current ?? '').slice(0, 500),
        },
      },
      platform: r.platform,
    });
  }
  await enableInterviewRetake(deps.userId);
  deps.isInterviewCompleteRef.current = false;
  deps.setMessages([]);
  deps.setScenarioScores({});
  deps.scoredScenariosRef.current = new Set();
  deps.setClosingQuestionState({ 1: 'needed', 2: 'needed', 3: 'needed' });
  deps.closingQuestionAskedRef.current = { 1: false, 2: false, 3: false };
  deps.closingQuestionAnsweredRef.current = { 1: false, 2: false, 3: false };
  deps.lastClosingQuestionScenarioRef.current = null;
  deps.waitingForClosingAdditionRef.current = null;
  deps.setClosingQuestionPending(false);
  deps.setClosingQuestionScenario(null);
  deps.lastAnsweredClosingScenarioRef.current = null;
  deps.onboardingAutoStartRef.current = false;
  deps.hasResumedRef.current = false;
  deps.startInterviewInFlightRef.current = false;
  deps.resumeLoadingFlowActiveRef.current = false;
  deps.setInterviewStartInFlight(false);
  deps.setResumeLoadingVisible(false);
  deps.setMicError(null);
  deps.setPreInterviewConsentAge(false);
  deps.setPreInterviewConsentData(false);
  deps.setStatus('intro');
  deps.setResults(null);
  deps.responseTimingsRef.current = [];
  deps.probeLogRef.current = [];
  deps.setAnalysisAttemptId(null);
  deps.setPendingScoringSyncAttemptId(null);
  deps.setInterviewLastCommittedAttemptId(null);
  deps.setShowPostInterviewFeedback(false);
  deps.setPostInterviewRatings({
    conversation_quality: null,
    clarity_flow: null,
    trust_accuracy: null,
  });
  deps.setPostInterviewComments({
    conversation_quality: '',
    clarity_flow: '',
    trust_accuracy: '',
  });
  deps.setPostInterviewGeneralFeedback('');
  deps.setHasSubmittedPostInterviewFeedback(false);
  deps.setInterviewStatus('not_started');
}
