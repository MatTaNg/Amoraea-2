/**
 * Phase 1 turn orchestrator — unifies "what should happen next?" into one decision object.
 * Uses existing transcript guards + construct flags (same signals as pre-Claude gates).
 * Phase 3: unified construct-satisfaction module replaces ad-hoc skip lists.
 */
import { looksLikeUnassessableScenarioAnswer, looksLikeInterviewProcessMetaComment } from '@features/aria/interviewAnswerRelevance';
import { looksLikeNeedRecognitionInSupportAnswer } from '@features/aria/moment4ProbeLogic';
import { looksLikeGoBackToPreviousScenarioRequest } from '@features/aria/interviewGoBackRequest';
import { looksLikeInterviewScoreStatusRequest } from '@features/aria/interviewScoreStatusRequest';
import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import { isInterviewCanonicalProbeRetired } from '@features/aria/interviewCanonicalProbeRegistry';
import { looksLikeScenarioARepairQuestion } from '@features/aria/scenarioARepairQuestionHelpers';
import { userAnswerIncludesExplicitScenarioARepairAsRyan } from '@features/aria/interviewRepairRefusalDetection';
import { evaluateInterviewProbeConstructSatisfaction } from '@features/aria/evaluateInterviewProbeConstructSatisfaction';
import type { ConstructSatisfactionResolvedByProbe } from '@features/aria/interviewConstructSatisfactionLlmTypes';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import {
  isDeliveredScenarioBJamesDifferentlyProbe,
  lastAssistantPromptIsScenarioBQ1OrPrematureRedirect,
} from '@features/aria/scenarioBProbeLogic';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from '@features/aria/scenarioAContemptProbeTtsStrip';
import {
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import { SCENARIO_C_REPAIR_QUESTION_CANONICAL } from '@features/aria/scenarioCPromptDetection';
import {
  shouldDeliverScenarioFollowUpQuestion,
} from '@features/aria/scenarioFollowUpTranscriptGuard';
import { resolvePendingPersonalMomentProbe } from '@features/aria/resolvePendingPersonalMomentProbe';
import type {
  InterviewTurnAction,
  InterviewTurnOrchestratorDecision,
  InterviewTurnStateSnapshot,
  InterviewUserTurnIntent,
} from '@features/aria/interviewTurnOrchestratorTypes';

function resolveUserIntent(
  userText: string,
  meta: MetaCommentClassification | null,
): InterviewUserTurnIntent {
  if (looksLikeGoBackToPreviousScenarioRequest(userText)) return 'go_back_request';
  if (looksLikeInterviewScoreStatusRequest(userText)) return 'score_request';
  if (looksLikeInterviewProcessMetaComment(userText)) return 'meta_question';
  if (meta?.type === 'confusion') return 'confusion_repeat';
  if (meta?.type === 'skip_request' || meta?.type === 'inability') return 'skip_request';
  if (meta?.type === 'frustration' || meta?.type === 'checking_in') return 'meta_question';
  if (meta?.type === 'already_answered') return 'meta_question';
  if (looksLikeNeedRecognitionInSupportAnswer(userText)) return 'substantive_answer';
  if (looksLikeUnassessableScenarioAnswer(userText)) return 'off_topic';
  if ((userText ?? '').trim().split(/\s+/).filter(Boolean).length >= 8) return 'substantive_answer';
  return 'unclear';
}

function collectSatisfiedProbes(
  messages: readonly MessageWithScenario[],
  constructFlags: PreClaudeScenarioConstructProbeFlags,
  userText: string,
  resolvedByProbe?: ConstructSatisfactionResolvedByProbe,
): InterviewCanonicalProbeId[] {
  const satisfied: InterviewCanonicalProbeId[] = [];
  const probeIds: InterviewCanonicalProbeId[] = [
    's1_contempt',
    's2_james_differently',
    's3_sophie_perspective',
    's3_repair',
    'm4_grudge',
    'm4_commitment_threshold',
    'm4_commitment_orientation',
    'm_support',
    'm_support_need_recognition',
    'm5_conflict',
  ];
  for (const id of probeIds) {
    const resolved = resolvedByProbe?.[id];
    if (resolved?.satisfied) {
      satisfied.push(id);
      continue;
    }
    const result = evaluateInterviewProbeConstructSatisfaction({
      probeId: id,
      messages,
      userText,
      constructFlags,
    });
    if (result.satisfied) {
      satisfied.push(id);
    }
  }
  return satisfied;
}

const SCENARIO_PROBE_ADVANCE_ORDER: InterviewCanonicalProbeId[] = [
  's1_contempt',
  's2_james_differently',
  's3_sophie_perspective',
  's3_repair',
  'm4_grudge',
  'm4_commitment_orientation',
  'm4_commitment_threshold',
  'm_support',
  'm_support_need_recognition',
  'm5_conflict',
];

function nextProbeAfterSkip(
  skipped: InterviewCanonicalProbeId,
  satisfiedProbeIds: InterviewCanonicalProbeId[],
): InterviewCanonicalProbeId | undefined {
  const idx = SCENARIO_PROBE_ADVANCE_ORDER.indexOf(skipped);
  if (idx < 0) return undefined;
  // Walk-away is a conditional fallback, not the next mandatory probe after keep-investing.
  const start =
    skipped === 'm4_commitment_orientation'
      ? SCENARIO_PROBE_ADVANCE_ORDER.indexOf('m_support')
      : idx + 1;
  for (let i = start; i < SCENARIO_PROBE_ADVANCE_ORDER.length; i++) {
    const candidate = SCENARIO_PROBE_ADVANCE_ORDER[i];
    if (!satisfiedProbeIds.includes(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function isProbeStrictlyAfter(
  candidate: InterviewCanonicalProbeId,
  current: InterviewCanonicalProbeId,
): boolean {
  const currentIdx = SCENARIO_PROBE_ADVANCE_ORDER.indexOf(current);
  const candidateIdx = SCENARIO_PROBE_ADVANCE_ORDER.indexOf(candidate);
  if (currentIdx < 0 || candidateIdx < 0) return false;
  return candidateIdx > currentIdx;
}

/** Next canonical probe after the active one when the active construct is already satisfied. */
export function resolveForwardAdvanceProbeAfterActiveProbe(args: {
  activeProbeId: InterviewCanonicalProbeId;
  messages: readonly MessageWithScenario[];
  userText: string;
  constructFlags: PreClaudeScenarioConstructProbeFlags;
  resolvedByProbe?: ConstructSatisfactionResolvedByProbe;
}): InterviewCanonicalProbeId | null {
  const satisfied = collectSatisfiedProbes(
    args.messages,
    args.constructFlags,
    args.userText,
    args.resolvedByProbe,
  );
  const activeSatisfaction = evaluateInterviewProbeConstructSatisfaction({
    probeId: args.activeProbeId,
    messages: args.messages,
    userText: args.userText,
    constructFlags: args.constructFlags,
  });
  if (!activeSatisfaction.satisfied && !satisfied.includes(args.activeProbeId)) {
    return null;
  }
  const allSatisfied = satisfied.includes(args.activeProbeId)
    ? satisfied
    : [...satisfied, args.activeProbeId];
  const advance = nextProbeAfterSkip(args.activeProbeId, allSatisfied);
  if (!advance || !isProbeStrictlyAfter(advance, args.activeProbeId)) {
    return null;
  }
  return advance;
}

function resolvePendingProbe(
  snapshot: InterviewTurnStateSnapshot,
  messages: readonly MessageWithScenario[],
  constructFlags: PreClaudeScenarioConstructProbeFlags,
  lastAssistantContent: string,
): InterviewCanonicalProbeId | null {
  const { currentInterviewMoment, currentScenario } = snapshot;

  if (
    constructFlags.shouldForceScenarioAContemptProbe &&
    shouldDeliverScenarioFollowUpQuestion(messages, SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY)
  ) {
    return 's1_contempt';
  }
  if (
    constructFlags.allowScenarioARepairAfterContemptAnswer &&
    shouldDeliverScenarioFollowUpQuestion(messages, SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY)
  ) {
    return 's1_repair';
  }

  const answeringScenarioBQ1 =
    currentInterviewMoment === 2 &&
    lastAssistantPromptIsScenarioBQ1OrPrematureRedirect(lastAssistantContent);
  const transcriptHasJamesDifferently = messages.some(
    (m) =>
      m.role === 'assistant' &&
      isDeliveredScenarioBJamesDifferentlyProbe(m.content ?? ''),
  );
  if (
    (answeringScenarioBQ1 || constructFlags.replyingToScenarioBQ1) &&
    !transcriptHasJamesDifferently &&
    shouldDeliverScenarioFollowUpQuestion(messages, SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL)
  ) {
    return 's2_james_differently';
  }
  if (
    constructFlags.shouldForceScenarioBJamesRepairProbe &&
    shouldDeliverScenarioFollowUpQuestion(messages, SCENARIO_B_JAMES_REPAIR_CANONICAL)
  ) {
    // S2 hypothetical repair probe retired — spontaneous repair still scores.
  }
  if (
    constructFlags.shouldForceScenarioCSophiePerspectiveProbe &&
    shouldDeliverScenarioFollowUpQuestion(messages, SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE)
  ) {
    return 's3_sophie_perspective';
  }
  if (
    !isInterviewCanonicalProbeRetired('s3_repair') &&
    constructFlags.shouldForceScenarioCRepairProbe &&
    shouldDeliverScenarioFollowUpQuestion(messages, SCENARIO_C_REPAIR_QUESTION_CANONICAL)
  ) {
    return 's3_repair';
  }

  const personalMomentProbe = resolvePendingPersonalMomentProbe({
    snapshot,
    messages,
    lastAssistantContent,
  });
  if (personalMomentProbe) {
    return personalMomentProbe;
  }

  return null;
}

/** Exported for live LLM prefetch before client-owned canonical delivery. */
export function resolvePendingCanonicalProbeForTurn(args: {
  snapshot: InterviewTurnStateSnapshot;
  messages: readonly MessageWithScenario[];
  constructFlags: PreClaudeScenarioConstructProbeFlags;
  lastAssistantContent: string;
}): InterviewCanonicalProbeId | null {
  return resolvePendingProbe(
    args.snapshot,
    args.messages,
    args.constructFlags,
    args.lastAssistantContent,
  );
}

function resolveAction(args: {
  userIntent: InterviewUserTurnIntent;
  pendingProbeId: InterviewCanonicalProbeId | null;
  satisfiedProbeIds: InterviewCanonicalProbeId[];
  activeConstructEngaged: boolean;
  constructFlags: PreClaudeScenarioConstructProbeFlags;
  userText: string;
  messages: readonly MessageWithScenario[];
}): InterviewTurnAction {
  const { userIntent, pendingProbeId, activeConstructEngaged, satisfiedProbeIds } = args;

  if (userIntent === 'go_back_request') {
    return { kind: 'speak_fixed_line', lineId: 'go_back_decline' };
  }
  if (userIntent === 'score_request') {
    return { kind: 'speak_fixed_line', lineId: 'score_decline' };
  }

  if (pendingProbeId && isInterviewCanonicalProbeRetired(pendingProbeId)) {
    return {
      kind: 'skip_probe_already_satisfied',
      probeId: pendingProbeId,
      advanceToProbeId: nextProbeAfterSkip(pendingProbeId, satisfiedProbeIds),
    };
  }

  if (pendingProbeId && satisfiedProbeIds.includes(pendingProbeId)) {
    const repairQuestionNeverAsked =
      pendingProbeId === 's1_repair' &&
      !args.messages.some(
        (m) => m.role === 'assistant' && looksLikeScenarioARepairQuestion(m.content ?? ''),
      ) &&
      !userAnswerIncludesExplicitScenarioARepairAsRyan(args.userText);
    if (repairQuestionNeverAsked) {
      return {
        kind: 'speak_canonical',
        probeId: 's1_repair',
        withBriefAck: true,
      };
    }
    const eligibleIntent =
      userIntent === 'substantive_answer' ||
      userIntent === 'unclear' ||
      (userIntent === 'meta_question' && args.constructFlags.specificEmmaLineAlreadyAddressed);
    if (eligibleIntent || activeConstructEngaged) {
      return {
        kind: 'skip_probe_already_satisfied',
        probeId: pendingProbeId,
        advanceToProbeId: nextProbeAfterSkip(pendingProbeId, satisfiedProbeIds),
      };
    }
  }

  if (
    pendingProbeId &&
    activeConstructEngaged &&
    (userIntent === 'substantive_answer' || userIntent === 'unclear')
  ) {
    const satisfaction = evaluateInterviewProbeConstructSatisfaction({
      probeId: pendingProbeId,
      messages: args.messages,
      userText: args.userText,
      constructFlags: args.constructFlags,
    });
    if (satisfaction.satisfied) {
      return {
        kind: 'skip_probe_already_satisfied',
        probeId: pendingProbeId,
        advanceToProbeId: nextProbeAfterSkip(pendingProbeId, [
          ...satisfiedProbeIds,
          pendingProbeId,
        ]),
      };
    }
  }

  if (
    pendingProbeId &&
    (userIntent === 'substantive_answer' || userIntent === 'unclear') &&
    !activeConstructEngaged &&
    args.constructFlags.shouldForceScenarioAContemptProbe === false
  ) {
    return {
      kind: 'speak_canonical',
      probeId: pendingProbeId,
      withBriefAck: true,
    };
  }

  if (pendingProbeId && args.constructFlags.shouldForceScenarioAContemptProbe) {
    return {
      kind: 'speak_canonical',
      probeId: pendingProbeId,
    };
  }

  if (
    pendingProbeId === 's1_repair' &&
    !isInterviewCanonicalProbeRetired('s1_repair') &&
    !satisfiedProbeIds.includes('s1_repair') &&
    userIntent !== 'go_back_request' &&
    userIntent !== 'score_request' &&
    userIntent !== 'off_topic'
  ) {
    return {
      kind: 'speak_canonical',
      probeId: 's1_repair',
      withBriefAck: true,
    };
  }

  if (
    pendingProbeId === 's3_repair' &&
    !isInterviewCanonicalProbeRetired('s3_repair') &&
    (userIntent === 'substantive_answer' || userIntent === 'unclear') &&
    !satisfiedProbeIds.includes('s3_repair')
  ) {
    return {
      kind: 'speak_canonical',
      probeId: 's3_repair',
      withBriefAck: true,
    };
  }

  if (
    pendingProbeId &&
    (pendingProbeId === 'm4_commitment_threshold' ||
      pendingProbeId === 'm4_commitment_orientation' ||
      pendingProbeId === 'm_support' ||
      pendingProbeId === 'm_support_need_recognition' ||
      pendingProbeId === 'm5_conflict') &&
    (userIntent === 'substantive_answer' || userIntent === 'unclear') &&
    !satisfiedProbeIds.includes(pendingProbeId)
  ) {
    return {
      kind: 'speak_canonical',
      probeId: pendingProbeId,
      withBriefAck: pendingProbeId === 'm4_commitment_orientation',
    };
  }

  if (userIntent === 'off_topic' || userIntent === 'confusion_repeat') {
    return { kind: 'delegate_claude', hint: 'gentle_redirect' };
  }
  if (userIntent === 'meta_question' || userIntent === 'skip_request') {
    return { kind: 'delegate_claude', hint: 'answer_meta_then_continue' };
  }

  return { kind: 'delegate_claude', hint: 'check_before_ask' };
}

/**
 * Heuristic v1 — mirrors construct-probe + meta routing without calling Claude.
 * Safe to run in shadow mode every turn.
 */
export function evaluateInterviewTurnOrchestratorDecision(args: {
  snapshot: InterviewTurnStateSnapshot;
  messages: readonly MessageWithScenario[];
  constructFlags: PreClaudeScenarioConstructProbeFlags;
  metaCommentClassification: MetaCommentClassification | null;
  constructSatisfactionResolvedByProbe?: ConstructSatisfactionResolvedByProbe;
}): InterviewTurnOrchestratorDecision {
  const {
    snapshot,
    messages,
    constructFlags,
    metaCommentClassification,
    constructSatisfactionResolvedByProbe,
  } = args;
  const activeQuestionPreview = (
    snapshot.lastQuestionText || snapshot.lastAssistantContent
  ).slice(0, 160);

  const userIntent = resolveUserIntent(snapshot.userText, metaCommentClassification);
  const satisfiedProbeIds = collectSatisfiedProbes(
    messages,
    constructFlags,
    snapshot.userText,
    constructSatisfactionResolvedByProbe,
  );
  const pendingProbeId = resolvePendingProbe(
    snapshot,
    messages,
    constructFlags,
    snapshot.lastAssistantContent,
  );

  const activeConstructEngaged =
    userIntent === 'substantive_answer' &&
    !looksLikeUnassessableScenarioAnswer(snapshot.userText);

  const action = resolveAction({
    userIntent,
    pendingProbeId,
    satisfiedProbeIds,
    activeConstructEngaged,
    constructFlags,
    userText: snapshot.userText,
    messages,
  });

  let reason = `intent=${userIntent}`;
  if (pendingProbeId) reason += `; pending=${pendingProbeId}`;
  if (satisfiedProbeIds.length) reason += `; satisfied=${satisfiedProbeIds.join(',')}`;
  const llmLiveSkip = pendingProbeId
    ? constructSatisfactionResolvedByProbe?.[pendingProbeId]?.resolution === 'llm_live'
    : false;
  if (llmLiveSkip) reason += '; llm_live_skip';
  reason += `; action=${action.kind}`;

  return {
    source: llmLiveSkip ? 'llm_v1' : 'heuristic_v1',
    userIntent,
    activeQuestionPreview,
    satisfiedProbeIds,
    pendingProbeId,
    activeConstructEngaged,
    action,
    reason,
  };
}
