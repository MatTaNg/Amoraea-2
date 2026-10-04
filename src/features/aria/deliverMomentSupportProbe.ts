import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  applyInterviewCanonicalProbeSideEffects,
  commitInterviewCanonicalProbeTranscriptTurn,
} from '@features/aria/interviewCanonicalProbeDeliveryShared';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import {
  looksLikeMomentSupportQuestion,
  MOMENT_SUPPORT_QUESTION_TEXT,
  transcriptIncludesAssistantMatch,
} from '@features/aria/moment4ProbeLogic';
import { applyMomentSupportReferenceCard } from '@features/aria/interviewReferenceCardResumeHelpers';
import { buildMoment4ToSupportBundle } from '@features/aria/interviewTransitionBundles';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { markQuestionDelivered } from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';

/**
 * Deliver the partner-support personal question with the standard personal-block transition pivot.
 * Used after Moment 4 threshold (second of three personal question blocks).
 */
export async function deliverMomentSupportProbe(args: {
  deps: PreClaudeTurnGateDeps;
  messagesToUse: MessageWithScenario[];
  logTag?: string;
}): Promise<boolean> {
  const { deps, messagesToUse } = args;
  if (
    !deps.isInterviewAppRoute ||
    deps.isAdmin ||
    deps.status !== 'active' ||
    deps.closingQuestionPending ||
    deps.waitingForClosingAdditionRef.current !== null
  ) {
    return false;
  }
  if (deps.currentInterviewMomentRef.current !== 4 && deps.currentInterviewMomentRef.current !== 5) {
    return false;
  }
  if (transcriptIncludesAssistantMatch(messagesToUse, looksLikeMomentSupportQuestion)) {
    return false;
  }

  const supportBundle = buildMoment4ToSupportBundle(MOMENT_SUPPORT_QUESTION_TEXT);
  void remoteLog(args.logTag ?? '[M_SUPPORT_HANDOFF]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    preview: supportBundle.slice(0, 240),
  });

  if (deps.parallelStreamingTtsRef.current.active) {
    deps.parallelStreamingTtsRef.current.cancelRequested = true;
  }

  if (deps.currentInterviewMomentRef.current < 4) {
    deps.currentInterviewMomentRef.current = 4;
  }

  const liveTranscript = (deps.currentMessagesRef.current.length > 0
    ? deps.currentMessagesRef.current
    : messagesToUse) as MessageWithScenario[];
  commitInterviewCanonicalProbeTranscriptTurn({
    liveTranscript,
    stagedMessages: messagesToUse,
    probeText: supportBundle,
    probeId: 'm_support',
    setMessages: (next) => deps.setMessages(next),
  });
  applyMomentSupportReferenceCard(deps);
  applyInterviewCanonicalProbeSideEffects(deps, 'm_support', MOMENT_SUPPORT_QUESTION_TEXT);

  await deps.speakTextSafe(supportBundle, ASSISTANT_INTERVIEW_SPEECH);
  markQuestionDelivered(new Date().toISOString());
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
  return true;
}
