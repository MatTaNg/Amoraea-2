import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import {
  getCanonicalProbeText,
  isInterviewCanonicalProbeRetired,
} from '@features/aria/interviewCanonicalProbeRegistry';
import { checkingInAckEmbedsConstructReask } from '@features/aria/interviewCheckingInAck';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  applyInterviewCanonicalProbeSideEffects,
  commitInterviewCanonicalProbeTranscriptTurn,
  withOptionalBriefScenarioAckAsync,
} from '@features/aria/interviewCanonicalProbeDeliveryShared';
import { markQuestionDelivered } from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';

/** Shared verbatim canonical probe delivery for pre-Claude gates and orchestrator executor. */
export async function deliverInterviewCanonicalProbe(args: {
  deps: PreClaudeTurnGateDeps;
  messagesToUse: MessageWithScenario[];
  probeId: InterviewCanonicalProbeId;
  withBriefAck?: boolean;
  logTag: string;
  userText?: string;
  ackPrefix?: string;
  priorSubstantiveText?: string;
  checkingInFrustrationAdjacent?: boolean;
}): Promise<void> {
  if (isInterviewCanonicalProbeRetired(args.probeId)) {
    void remoteLog('[CANONICAL_PROBE_RETIRED_SKIP]', {
      interviewSessionId: args.deps.interviewSessionIdRef.current,
      probeId: args.probeId,
      logTag: args.logTag,
    });
    return;
  }
  const activeQuestionPreview = (
    args.deps.lastQuestionTextRef?.current ??
    args.messagesToUse.filter((m) => m.role === 'assistant').slice(-1)[0]?.content ??
    ''
  ).slice(0, 240);
  const canonicalProbe = getCanonicalProbeText(args.probeId);
  const probeText = await withOptionalBriefScenarioAckAsync({
    probe: canonicalProbe,
    messages: args.messagesToUse,
    withBriefAck: args.withBriefAck,
    userText: args.userText ?? '',
    activeQuestionPreview,
    interviewSessionId: args.deps.interviewSessionIdRef.current,
    ackPrefix: args.ackPrefix,
    priorSubstantiveText: args.priorSubstantiveText,
    checkingInFrustrationAdjacent: args.checkingInFrustrationAdjacent,
  });
  const clarifyAckOnly =
    !!args.ackPrefix?.trim() &&
    checkingInAckEmbedsConstructReask(args.ackPrefix) &&
    probeText.trim() === args.ackPrefix.trim();
  const liveTranscript = (args.deps.currentMessagesRef.current.length > 0
    ? args.deps.currentMessagesRef.current
    : args.messagesToUse) as MessageWithScenario[];

  commitInterviewCanonicalProbeTranscriptTurn({
    liveTranscript,
    stagedMessages: args.messagesToUse,
    probeText,
    probeId: args.probeId,
    setMessages: (next) => args.deps.setMessages(next),
  });
  applyInterviewCanonicalProbeSideEffects(
    args.deps,
    args.probeId,
    clarifyAckOnly ? canonicalProbe : probeText,
  );

  void remoteLog(args.logTag, {
    interviewSessionId: args.deps.interviewSessionIdRef.current,
    probeId: args.probeId,
    preview: probeText.slice(0, 220),
    clarifyAckOnly,
    scenarioNumber:
      args.probeId === 'm4_grudge' ||
      args.probeId === 'm4_commitment_threshold' ||
      args.probeId === 'm4_commitment_orientation' ||
      args.probeId === 'm_support' ||
      args.probeId === 'm_support_need_recognition' ||
      args.probeId === 'm5_conflict'
        ? args.deps.currentScenarioRef.current
        : undefined,
  });
  await args.deps.speakTextSafe(probeText, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    ...(clarifyAckOnly
      ? {
          skipLastQuestionRef: true,
          skipQuestionDeliveredTelemetry: true,
          allowDuplicateConsecutiveTts: true,
        }
      : {}),
  });
  if (!clarifyAckOnly) {
    markQuestionDelivered(new Date().toISOString());
  }
  args.deps.setVoiceState('idle');
  args.deps.setIsWaiting(false);
}
