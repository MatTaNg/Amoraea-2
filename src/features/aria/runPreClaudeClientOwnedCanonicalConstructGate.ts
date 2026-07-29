import { isDecline } from '@features/aria/interviewControlTokens';
import { looksLikeUnassessableScenarioAnswer } from '@features/aria/interviewAnswerRelevance';
import {
  chooseBriefScenarioAck,
  recentAssistantMessagesForAck,
} from '@features/aria/interviewReflectionAckVariation';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { commitDedupedAssistantTranscriptTurn } from '@features/aria/interviewTranscriptDedup';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from '@features/aria/scenarioAContemptProbeTtsStrip';
import {
  lastAssistantPromptIsScenarioBQ1OrPrematureRedirect,
  isDeliveredScenarioBJamesDifferentlyProbe,
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import { looksLikeIncompleteCutOffUserAnswer } from '@features/aria/interviewAnswerRelevance';
import {
  shouldDeliverScenarioFollowUpQuestion,
  transcriptContainsScenarioAContemptProbe,
} from '@features/aria/scenarioFollowUpTranscriptGuard';
import {
  looksLikeScenarioCSophiePerspectiveAssessableShortAnswer,
  looksLikeScenarioCSophiePerspectiveQuestion,
} from '@features/aria/scenarioCPromptDetection';
import { looksLikeScenarioAContemptProbeAssessableShortAnswer } from '@features/aria/scenarioAContemptProbeCoverage';
import { looksLikeScenarioAContemptProbeQuestion } from '@features/aria/scenarioAContemptProbeLogic';
import { remoteLog } from '@utilities/remoteLog';
import { assessablePromptQuestionBody } from '@features/aria/interviewAssessablePromptText';
import { markQuestionDelivered } from '@utilities/sessionLogging';
import { applySituation2FollowUpProbeReferenceCard } from '@features/aria/runReferenceCardFromAssistantSpeech';

export type PreClaudeClientOwnedCanonicalConstructGateResult = {
  handled: boolean;
};

function withOptionalBriefAck(
  probe: string,
  messages: readonly MessageWithScenario[],
): string {
  const ack = chooseBriefScenarioAck(recentAssistantMessagesForAck([...messages]));
  if (!ack) return probe;
  return `${ack} ${probe}`;
}

async function deliverCanonicalProbe(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
  probeText: string,
  scenarioNumber: 1 | 2 | 3,
  logTag: string,
): Promise<void> {
  const liveTranscript = (deps.currentMessagesRef.current.length > 0
    ? deps.currentMessagesRef.current
    : messagesToUse) as MessageWithScenario[];
  const questionBody = assessablePromptQuestionBody(probeText);
  commitDedupedAssistantTranscriptTurn(
    liveTranscript,
    messagesToUse,
    probeText,
    {
      scenarioNumber,
      interviewMoment: deps.currentInterviewMomentRef.current,
    },
    (next) => deps.setMessages(next),
  );
  deps.lastQuestionTextRef.current = questionBody;
  if (
    scenarioNumber === 2 &&
    deps.setReferenceCardScenario &&
    deps.committedScenarioRef &&
    deps.setInterviewUiPhase &&
    (looksLikeScenarioBJamesDifferentlyQuestion(probeText) ||
      looksLikeScenarioBRepairAsJamesQuestion(probeText))
  ) {
    applySituation2FollowUpProbeReferenceCard(deps, questionBody);
  }
  void remoteLog(logTag, {
    interviewSessionId: deps.interviewSessionIdRef.current,
    preview: probeText.slice(0, 220),
    scenarioNumber,
  });
  await deps.speakTextSafe(probeText, ASSISTANT_INTERVIEW_SPEECH);
  markQuestionDelivered(new Date().toISOString());
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
}

/**
 * Fixed scripted construct probes (S1 contempt/repair, S2 James Q2/Q3) never change —
 * deliver them client-side and skip Claude so paraphrases cannot leak into TTS.
 * Runs after client disengagement probes so thin-answer / refusal injects still win.
 */
export async function runPreClaudeClientOwnedCanonicalConstructGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  lastAssistantContent: string,
  constructProbeFlags: PreClaudeScenarioConstructProbeFlags,
  suppressForcedConstructProbesForMetaFrustration = false,
): Promise<PreClaudeClientOwnedCanonicalConstructGateResult> {
  if (isDecline(trimmed) || suppressForcedConstructProbesForMetaFrustration) {
    return { handled: false };
  }
  const questionToAssess =
    (deps.lastQuestionTextRef.current ?? '').trim() || lastAssistantContent.trim();
  const contemptProbeShortAnswer =
    (looksLikeScenarioAContemptProbeQuestion(questionToAssess) ||
      looksLikeScenarioAContemptProbeQuestion(lastAssistantContent)) &&
    looksLikeScenarioAContemptProbeAssessableShortAnswer(trimmed);
  const sophiePerspectiveShortAnswer =
    (looksLikeScenarioCSophiePerspectiveQuestion(questionToAssess) ||
      looksLikeScenarioCSophiePerspectiveQuestion(lastAssistantContent)) &&
    looksLikeScenarioCSophiePerspectiveAssessableShortAnswer(trimmed);
  // Incomplete / off-topic answers must not advance via client-owned construct delivery
  // (irrelevant-answer retry gate should speak first; this is defense in depth).
  if (
    looksLikeUnassessableScenarioAnswer(trimmed) &&
    !contemptProbeShortAnswer &&
    !sophiePerspectiveShortAnswer
  ) {
    return { handled: false };
  }

  const {
    shouldForceScenarioAContemptProbe,
    allowScenarioARepairAfterContemptAnswer,
    shouldForceScenarioBJamesRepairProbe,
    shouldForceScenarioCSophiePerspectiveProbe,
  } = constructProbeFlags;

  if (
    shouldForceScenarioAContemptProbe &&
    shouldDeliverScenarioFollowUpQuestion(messagesToUse, SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY) &&
    !transcriptContainsScenarioAContemptProbe(messagesToUse)
  ) {
    const probeText = SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
    deps.scenarioAContemptProbeAskedRef.current = true;
    /** Mute was armed for a Claude force path we are skipping — clear so later S1→S2 stream is not silenced. */
    deps.pendingScenarioAContemptProbeStreamMuteRef.current = false;
    await deliverCanonicalProbe(
      deps,
      messagesToUse,
      probeText,
      1,
      '[S1_CONTEMPT_CLIENT_OWNED_SKIP_CLAUDE]',
    );
    return { handled: true };
  }

  if (
    allowScenarioARepairAfterContemptAnswer &&
    shouldDeliverScenarioFollowUpQuestion(
      messagesToUse,
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    )
  ) {
    const probeText = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
    deps.scenarioARepairQuestionAskedRef.current = true;
    deps.pendingScenarioAContemptProbeStreamMuteRef.current = false;
    await deliverCanonicalProbe(
      deps,
      messagesToUse,
      probeText,
      1,
      '[S1_REPAIR_CLIENT_OWNED_SKIP_CLAUDE]',
    );
    return { handled: true };
  }

  const answeringScenarioBQ1 =
    deps.currentInterviewMomentRef.current === 2 &&
    lastAssistantPromptIsScenarioBQ1OrPrematureRedirect(lastAssistantContent);
  const transcriptHasJamesDifferently = messagesToUse.some(
    (m) =>
      m.role === 'assistant' &&
      isDeliveredScenarioBJamesDifferentlyProbe(m.content ?? ''),
  );
  const needsJamesDifferently =
    (answeringScenarioBQ1 || constructProbeFlags.replyingToScenarioBQ1) &&
    !transcriptHasJamesDifferently &&
    shouldDeliverScenarioFollowUpQuestion(messagesToUse, SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL);

  if (needsJamesDifferently) {
    const probeText = withOptionalBriefAck(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL, messagesToUse);
    await deliverCanonicalProbe(
      deps,
      messagesToUse,
      probeText,
      2,
      '[S2_JAMES_DIFF_CLIENT_OWNED_SKIP_CLAUDE]',
    );
    return { handled: true };
  }

  if (
    shouldForceScenarioBJamesRepairProbe &&
    shouldDeliverScenarioFollowUpQuestion(messagesToUse, SCENARIO_B_JAMES_REPAIR_CANONICAL)
  ) {
    const probeText = withOptionalBriefAck(SCENARIO_B_JAMES_REPAIR_CANONICAL, messagesToUse);
    deps.s2RepairProbeDeliveredRef.current = true;
    await deliverCanonicalProbe(
      deps,
      messagesToUse,
      probeText,
      2,
      '[S2_JAMES_REPAIR_CLIENT_OWNED_SKIP_CLAUDE]',
    );
    return { handled: true };
  }

  if (
    shouldForceScenarioCSophiePerspectiveProbe &&
    shouldDeliverScenarioFollowUpQuestion(messagesToUse, SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE)
  ) {
    const probeText = withOptionalBriefAck(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE, messagesToUse);
    deps.scenarioCSophiePerspectiveProbeFiredRef.current = true;
    await deliverCanonicalProbe(
      deps,
      messagesToUse,
      probeText,
      3,
      '[S3_SOPHIE_CLIENT_OWNED_SKIP_CLAUDE]',
    );
    return { handled: true };
  }

  return { handled: false };
}
