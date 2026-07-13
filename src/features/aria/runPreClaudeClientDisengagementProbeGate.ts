import {
  evaluateRepairRefusalDetection,
  isClientOrElongatingInterviewProbeAssistant,
  looksLikeRepairInterviewQuestion,
  pickClientDisengagementProbe,
  transcriptContainsMentalizingSurfaceProbe,
} from '@features/aria/interviewDisengagementProbes';
import {
  countSpokenWords,
  isClientAudioRecoveryAssistantLine,
  isNamePromptInterviewMoment,
  isResumeReentryWelcomePrompt,
  isSimpleYesNoInterviewMoment,
} from '@features/aria/interviewLanguageGate';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { commitDedupedAssistantTranscriptTurn } from '@features/aria/interviewTranscriptDedup';
import { remoteLog } from '@utilities/remoteLog';

export type PreClaudeClientDisengagementProbeGateResult = {
  handled: boolean;
};

function baseDisengagementProbeEligible(deps: PreClaudeTurnGateDeps): boolean {
  return (
    deps.isInterviewAppRoute &&
    !deps.isAdmin &&
    deps.status === 'active' &&
    !deps.closingQuestionPending &&
    deps.waitingForClosingAdditionRef.current === null
  );
}

/**
 * Repair refusal, mentalizing, and Scenario C Sophie perspective client disengagement probes.
 */
export async function runPreClaudeClientDisengagementProbeGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  lastAssistantContent: string,
  userScenarioTag: number,
  metaCommentClassification: MetaCommentClassification | null,
  isNameEntryTurn: boolean,
): Promise<PreClaudeClientDisengagementProbeGateResult> {
  if (!baseDisengagementProbeEligible(deps) || metaCommentClassification) {
    return { handled: false };
  }

  const wcDisengage = countSpokenWords(trimmed);
  const answeringAfterProbe = isClientOrElongatingInterviewProbeAssistant(lastAssistantContent);
  const exemptMetaTurn =
    isSimpleYesNoInterviewMoment(deps.lastQuestionTextRef.current) ||
    isResumeReentryWelcomePrompt(deps.lastQuestionTextRef.current) ||
    isNamePromptInterviewMoment(deps.lastQuestionTextRef.current);
  const isAssistantRecoveryOrMetaLine = isClientAudioRecoveryAssistantLine(lastAssistantContent);

  const priorUserTurnsInScenario = deps.messages.filter(
    (m) =>
      m.role === 'user' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      (m as MessageWithScenario).scenarioNumber === userScenarioTag,
  ).length;
  const isFirstUserTurnInScenario = priorUserTurnsInScenario === 0;
  const repairQuestionForDisengagement = looksLikeRepairInterviewQuestion(lastAssistantContent);
  const repairRefusalDetail = repairQuestionForDisengagement
    ? evaluateRepairRefusalDetection(trimmed, wcDisengage, lastAssistantContent)
    : null;
  if (repairRefusalDetail) {
    void remoteLog('[REPAIR_REFUSAL_EVALUATION]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      scenario: userScenarioTag,
      repair_refusal_detected: repairRefusalDetail.repair_refusal_detected,
      trigger_condition: repairRefusalDetail.trigger_condition,
      trigger_reason: repairRefusalDetail.trigger_reason,
      response_word_count: repairRefusalDetail.response_word_count,
      repair_refusal_anomaly: repairRefusalDetail.repair_refusal_anomaly,
      has_concrete_repair_content: repairRefusalDetail.has_concrete_repair_content,
      preview: trimmed.slice(0, 200),
    });
  }

  const disengagePick = pickClientDisengagementProbe({
    userAnswer: trimmed,
    lastAssistantContent,
    wordCount: wcDisengage,
    answeringAfterProbe,
    exemptMetaTurn,
    isGreetingNameTurn: isNameEntryTurn,
    isAssistantRecoveryOrMetaLine,
    isFirstUserTurnInScenario,
    scenarioCSophiePerspectiveProbeAlreadyFired: deps.scenarioCSophiePerspectiveProbeFiredRef.current,
    mentalizingSurfaceProbeAlreadyFired: transcriptContainsMentalizingSurfaceProbe(messagesToUse),
  });

  if (!disengagePick) {
    return { handled: false };
  }

  void remoteLog('[CLIENT_DISENGAGEMENT_PROBE]', {
    kind: disengagePick.kind,
    wc: wcDisengage,
    preview: trimmed.slice(0, 120),
    ...(disengagePick.kind === 'repair_refusal' ? disengagePick.repairRefusal : {}),
  });
  if (disengagePick.kind === 'scenario_c_sophie_perspective') {
    deps.scenarioCSophiePerspectiveProbeFiredRef.current = true;
  }
  const probeConstruct =
    disengagePick.kind === 'mentalizing_surface'
      ? 'mentalizing'
      : disengagePick.kind === 'scenario_c_sophie_perspective'
        ? 'mentalizing'
        : disengagePick.kind === 'repair_refusal'
          ? 'repair'
          : disengagePick.kind;
  const probeTriggerReason =
    disengagePick.kind === 'mentalizing_surface'
      ? 'surface_label_no_reasoning'
      : disengagePick.kind === 'scenario_c_sophie_perspective'
        ? 'scenario_c_q1_no_sophie_perspective'
        : disengagePick.kind === 'repair_refusal'
          ? 'repair_refusal_detected'
          : disengagePick.kind;
  deps.probeLogRef.current.push({
    scenario: userScenarioTag,
    construct: probeConstruct,
    probe_fired: true,
    trigger_reason: probeTriggerReason,
    pre_probe_score: 0,
    post_probe_score: 0,
    score_delta: 0,
  });
  const probeText = disengagePick.probe;
  const probeMsg: MessageWithScenario = {
    role: 'assistant',
    content: probeText,
    scenarioNumber: userScenarioTag as 1 | 2 | 3,
  };
  const liveTranscript = (deps.currentMessagesRef.current.length > 0
    ? deps.currentMessagesRef.current
    : messagesToUse) as MessageWithScenario[];
  commitDedupedAssistantTranscriptTurn(
    liveTranscript,
    messagesToUse,
    probeText,
    { scenarioNumber: probeMsg.scenarioNumber },
    (next) => deps.setMessages(next),
  );
  await deps.speakTextSafe(probeText, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    skipLastQuestionRef: true,
  });
  deps.lastQuestionTextRef.current = probeText;
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
  return { handled: true };
}
