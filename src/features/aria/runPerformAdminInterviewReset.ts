import { Platform } from 'react-native';

import type { PerformAdminInterviewResetDeps } from '@features/aria/performAdminInterviewResetTypes';

/** Admin-only: full local reset + restart opening line. Does not update `users` (unlike retake). */
export async function runPerformAdminInterviewReset(
  deps: PerformAdminInterviewResetDeps,
): Promise<void> {
  if (!deps.userId || !deps.isAdmin) {
    return;
  }
  await deps.stopElevenLabsPlayback();
  deps.stopElevenLabsSpeech();
  if (true && deps.audioRecorder.isRecording) {
    try {
      await deps.audioRecorder.stopRecording();
    } catch {
      /* non-fatal */
    }
  }
  if (Platform.OS === 'web' && deps.recognitionRef.current) {
    try {
      deps.recognitionRef.current.stop();
    } catch {
      /* non-fatal */
    }
  }
  await deps.clearInterviewFromStorage(deps.userId);
  deps.setInterviewJustCompletedInSession(false);
  deps.isInterviewCompleteRef.current = false;
  deps.hasResumedRef.current = false;
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
  deps.setMicError(null);
  deps.setMicWarning(null);
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
  deps.setHighestScenarioReached(1);
  deps.currentScenarioRef.current = 1;
  deps.setStageResults([]);
  deps.setTouchedConstructs([]);
  deps.setExchangeCount(0);
  deps.setIsWaiting(false);
  deps.timingRef.current = {
    questionEndTime: null,
    recordingStartTime: null,
    recordingEndTime: null,
  };
  deps.lastQuestionTextRef.current = '';
  deps.transcriptAtReleaseRef.current = '';
  deps.setCurrentTranscript('');
  deps.setTypedAnswer('');
  deps.setUsedPersonalExamples(false);
  deps.setPendingCompletion(false);
  deps.pendingCompletionTranscriptRef.current = null;
  deps.waitingMessageIdRef.current = null;
  deps.committedScenarioRef.current = null;
  deps.setInterviewUiPhase('pre_scenario');
  deps.setReferenceCardScenario(null);
  deps.setReferenceCardPrompt(null);
  deps.isSpeakingRef.current = false;
  deps.setVoiceState('idle');
  deps.resetInterviewProgressRefs();
  if (Platform.OS === 'web') {
    deps.audioRecorder.resetWebMicInputFallbackState();
  }
  void deps.startInterview({ fromUserGesture: true });
}
