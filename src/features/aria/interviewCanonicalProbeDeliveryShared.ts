import {
  chooseBriefScenarioAck,
  recentAssistantMessagesForAck,
} from '@features/aria/interviewReflectionAckVariation';
import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import { INTERVIEW_CANONICAL_PROBES } from '@features/aria/interviewCanonicalProbeRegistry';
import { resolveWithinScenarioBriefAckForInterview } from '@features/aria/resolveWithinScenarioBriefAckForInterview';
import {
  prefixProbeWithCheckingInAck,
  resolveCheckingInBriefAckForInterview,
} from '@features/aria/interviewCheckingInAck';
import { looksLikeCheckingInSufficiencyAsk } from '@features/aria/metaCommentPatternScoring';
import { assessablePromptQuestionBody } from '@features/aria/interviewAssessablePromptText';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  isDeliveredScenarioBJamesDifferentlyProbe,
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
} from '@features/aria/scenarioBProbeLogic';
import { applySituation2FollowUpProbeReferenceCard } from '@features/aria/runReferenceCardFromAssistantSpeech';
import { commitDedupedAssistantTranscriptTurn } from '@features/aria/interviewTranscriptDedup';
import type { MutableRefObject } from 'react';

export type InterviewCanonicalProbeSideEffectDeps = {
  currentInterviewMomentRef?: MutableRefObject<number>;
  currentScenarioRef?: MutableRefObject<number>;
  lastQuestionTextRef?: MutableRefObject<string>;
  scenarioAContemptProbeAskedRef?: MutableRefObject<boolean>;
  pendingScenarioAContemptProbeStreamMuteRef?: MutableRefObject<boolean>;
  scenarioARepairQuestionAskedRef?: MutableRefObject<boolean>;
  s2RepairProbeDeliveredRef?: MutableRefObject<boolean>;
  scenarioCSophiePerspectiveProbeFiredRef?: MutableRefObject<boolean>;
  moment4ThresholdProbeAskedRef?: MutableRefObject<boolean>;
  moment5QuestionDeliveredRef?: MutableRefObject<boolean>;
  moment5PrimaryAnchorDeliveredSessionRef?: MutableRefObject<boolean>;
  setReferenceCardScenario?: (scenario: import('@app/screens/UserInterviewLayout').ActiveScenario | null) => void;
  committedScenarioRef?: MutableRefObject<import('@app/screens/UserInterviewLayout').ActiveScenario | null>;
  setInterviewUiPhase?: (phase: import('@features/aria/sessionLifecycleTypes').InterviewUiPhase) => void;
};

export function withOptionalBriefScenarioAck(
  probe: string,
  messages: readonly MessageWithScenario[],
  withBriefAck?: boolean,
): string {
  if (!withBriefAck) return probe;
  const ack = chooseBriefScenarioAck(recentAssistantMessagesForAck([...messages]));
  if (!ack) return probe;
  return `${ack} ${probe}`;
}

export async function withOptionalBriefScenarioAckAsync(args: {
  probe: string;
  messages: readonly MessageWithScenario[];
  withBriefAck?: boolean;
  userText: string;
  activeQuestionPreview: string;
  interviewSessionId?: string | null;
  ackPrefix?: string;
  priorSubstantiveText?: string;
  checkingInFrustrationAdjacent?: boolean;
}): Promise<string> {
  if (args.ackPrefix?.trim()) {
    return prefixProbeWithCheckingInAck(args.ackPrefix, args.probe);
  }
  if (looksLikeCheckingInSufficiencyAsk(args.userText)) {
    const { ack } = await resolveCheckingInBriefAckForInterview({
      messages: args.messages,
      priorSubstantiveText: args.priorSubstantiveText ?? '',
      activeQuestionPreview: args.activeQuestionPreview,
      interviewSessionId: args.interviewSessionId,
      checkingInFrustrationAdjacent: args.checkingInFrustrationAdjacent,
    });
    return prefixProbeWithCheckingInAck(ack, args.probe);
  }
  if (!args.withBriefAck) return args.probe;
  const { ack } = await resolveWithinScenarioBriefAckForInterview({
    messages: args.messages,
    userText: args.userText,
    activeQuestionPreview: args.activeQuestionPreview,
    interviewSessionId: args.interviewSessionId,
  });
  if (!ack) return args.probe;
  return `${ack} ${args.probe}`;
}

export function applyInterviewCanonicalProbeSideEffects(
  deps: InterviewCanonicalProbeSideEffectDeps,
  probeId: InterviewCanonicalProbeId,
  probeText: string,
): void {
  const questionBody = assessablePromptQuestionBody(probeText);
  if (deps.lastQuestionTextRef) {
    deps.lastQuestionTextRef.current = questionBody;
  }

  const entry = INTERVIEW_CANONICAL_PROBES[probeId];
  const scenarioNumber = entry.scenarioNumber ?? ((deps.currentScenarioRef?.current ?? 3) as 1 | 2 | 3);
  if (
    scenarioNumber === 2 &&
    deps.setReferenceCardScenario &&
    deps.committedScenarioRef &&
    deps.setInterviewUiPhase &&
    (looksLikeScenarioBJamesDifferentlyQuestion(probeText) ||
      looksLikeScenarioBRepairAsJamesQuestion(probeText))
  ) {
    applySituation2FollowUpProbeReferenceCard(deps as never, questionBody);
  }

  if (probeId === 's1_contempt') {
    if (deps.scenarioAContemptProbeAskedRef) deps.scenarioAContemptProbeAskedRef.current = true;
    if (deps.pendingScenarioAContemptProbeStreamMuteRef) {
      deps.pendingScenarioAContemptProbeStreamMuteRef.current = false;
    }
  }
  if (probeId === 's1_repair' && deps.scenarioARepairQuestionAskedRef) {
    deps.scenarioARepairQuestionAskedRef.current = true;
    if (deps.pendingScenarioAContemptProbeStreamMuteRef) {
      deps.pendingScenarioAContemptProbeStreamMuteRef.current = false;
    }
  }
  if (probeId === 's2_james_repair' && deps.s2RepairProbeDeliveredRef) {
    deps.s2RepairProbeDeliveredRef.current = true;
  }
  if (probeId === 's3_sophie_perspective' && deps.scenarioCSophiePerspectiveProbeFiredRef) {
    deps.scenarioCSophiePerspectiveProbeFiredRef.current = true;
  }
  if (probeId === 'm4_commitment_threshold' && deps.moment4ThresholdProbeAskedRef) {
    deps.moment4ThresholdProbeAskedRef.current = true;
  }
  if (
    probeId === 'm4_commitment_orientation' ||
    probeId === 'm_support' ||
    probeId === 'm_support_need_recognition'
  ) {
    if (deps.currentInterviewMomentRef && deps.currentInterviewMomentRef.current < 4) {
      deps.currentInterviewMomentRef.current = 4;
    }
  }
  if (probeId === 'm5_conflict') {
    if (deps.moment5QuestionDeliveredRef) deps.moment5QuestionDeliveredRef.current = true;
    if (deps.moment5PrimaryAnchorDeliveredSessionRef) {
      deps.moment5PrimaryAnchorDeliveredSessionRef.current = true;
    }
    if (deps.currentInterviewMomentRef) deps.currentInterviewMomentRef.current = 5;
  }
}

export function commitInterviewCanonicalProbeTranscriptTurn<T extends MessageWithScenario>(args: {
  liveTranscript: readonly T[];
  stagedMessages: readonly T[];
  probeText: string;
  probeId: InterviewCanonicalProbeId;
  scenarioNumberOverride?: number;
  interviewMomentOverride?: number;
  setMessages: (next: T[]) => void;
}): T[] {
  const entry = INTERVIEW_CANONICAL_PROBES[args.probeId];
  return commitDedupedAssistantTranscriptTurn(
    args.liveTranscript,
    args.stagedMessages,
    args.probeText,
    {
      scenarioNumber: args.scenarioNumberOverride ?? entry.scenarioNumber ?? undefined,
      interviewMoment: args.interviewMomentOverride ?? entry.momentNumber,
    },
    args.setMessages,
  ) as T[];
}
