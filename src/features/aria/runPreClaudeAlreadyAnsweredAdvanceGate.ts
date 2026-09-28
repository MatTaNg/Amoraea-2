import { deliverClientOwnedScenario3OpeningAfterS2Repair } from '@features/aria/deliverClientOwnedScenarioHandoffOpening';
import { deliverInterviewCanonicalProbe } from '@features/aria/deliverInterviewCanonicalProbe';
import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import { getCanonicalProbeText } from '@features/aria/interviewCanonicalProbeRegistry';
import { buildAlreadyAnsweredOwnershipAckPrefix } from '@features/aria/interviewAlreadyAnsweredAck';
import {
  evaluateActiveProbeSubstantivelyAnswered,
  resolveAlreadyAnsweredSingleHopAdvanceProbeId,
} from '@features/aria/interviewAlreadyAnsweredActiveProbe';
import { assessablePromptQuestionBody } from '@features/aria/interviewAssessablePromptText';
import {
  buildCheckingInAckOnlySpeech,
  resolveCheckingInActiveQuestionText,
} from '@features/aria/interviewCheckingInAck';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  classifyScriptedFollowUpKind,
  type ScriptedFollowUpKind,
} from '@features/aria/interviewTranscriptDedup';
import { getPriorSubstantiveNonMetaUserContentInMoment } from '@features/aria/metaCommentClassification';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import { classifyPriorAnswerMetaKind } from '@features/aria/interviewPriorAnswerMetaDetection';
import {
  looksLikeMoment4GrudgePrompt,
  looksLikeMoment4OrientationQuestion,
  looksLikeMoment4ThresholdQuestion,
  looksLikeMomentSupportConditionalProbe,
  looksLikeMomentSupportQuestion,
} from '@features/aria/moment4ProbeLogic';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { resolvePreClaudeAssistantTurnContext } from '@features/aria/resolvePreClaudeAssistantTurnContext';
import {
  resolvePreClaudeScenarioConstructProbeFlags,
} from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import { remoteLog } from '@utilities/remoteLog';

export type PreClaudeAlreadyAnsweredAdvanceGateResult = { handled: boolean };

function scriptedFollowUpKindToCanonicalProbeId(
  kind: ScriptedFollowUpKind | null,
): InterviewCanonicalProbeId | null {
  switch (kind) {
    case 's1_contempt':
      return 's1_contempt';
    case 's1_repair':
      return 's1_repair';
    case 's2_james_differently':
    case 's2_appreciation':
      return 's2_james_differently';
    case 's2_james_repair':
      return 's2_james_repair';
    case 's3_sophie_perspective':
      return 's3_sophie_perspective';
    case 's3_repair':
      return 's3_repair';
    default:
      return null;
  }
}

function probeIdFromAssessableText(text: string): InterviewCanonicalProbeId | null {
  const body = assessablePromptQuestionBody(text);
  if (!body) return null;
  return scriptedFollowUpKindToCanonicalProbeId(classifyScriptedFollowUpKind(body));
}

/** Prefer lastQuestionTextRef — transcript scan can pick an older ownership+question combo. */
function resolveActiveProbeForAlreadyAnsweredGate(args: {
  messages: MessageWithScenario[];
  lastQuestionTextRef: string;
  lastAssistantContent: string;
  lastInterviewerContent: string;
  activeScenario: number;
  currentMoment: number;
}): InterviewCanonicalProbeId | null {
  if (args.currentMoment >= 4) {
    const m4Context = [
      args.lastQuestionTextRef,
      args.lastAssistantContent,
      args.lastInterviewerContent,
    ];
    for (const text of m4Context) {
      if (looksLikeMoment4GrudgePrompt(text)) return 'm4_grudge';
      if (looksLikeMoment4ThresholdQuestion(text)) return 'm4_commitment_threshold';
      if (looksLikeMoment4OrientationQuestion(text)) return 'm4_commitment_orientation';
      if (looksLikeMomentSupportConditionalProbe(text)) return 'm_support_need_recognition';
      if (looksLikeMomentSupportQuestion(text)) return 'm_support';
    }
  }

  const refProbe = probeIdFromAssessableText(args.lastQuestionTextRef);
  if (refProbe) return refProbe;

  const assistantProbe = probeIdFromAssessableText(args.lastAssistantContent);
  if (assistantProbe) return assistantProbe;

  const interviewerProbe = probeIdFromAssessableText(args.lastInterviewerContent);
  if (interviewerProbe) return interviewerProbe;

  const fromTranscript = resolveCheckingInActiveQuestionText({
    messages: args.messages,
    lastQuestionTextRef: args.lastQuestionTextRef,
    lastInterviewerContent: args.lastInterviewerContent,
    activeScenario: args.activeScenario,
  });
  return probeIdFromAssessableText(fromTranscript);
}

async function deliverScenarioHandoffBeforeAdvanceIfNeeded(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
  advanceProbeId: InterviewCanonicalProbeId,
): Promise<void> {
  if (advanceProbeId === 's3_sophie_perspective' || advanceProbeId === 's3_repair') {
    await deliverClientOwnedScenario3OpeningAfterS2Repair(deps, messagesToUse);
  }
}

/**
 * Client-owned already-answered path: verify the active construct is substantively answered,
 * then acknowledge and advance one step — or clarify what is still needed.
 */
export async function runPreClaudeAlreadyAnsweredAdvanceGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  metaCommentClassification: MetaCommentClassification | null,
): Promise<PreClaudeAlreadyAnsweredAdvanceGateResult> {
  if (
    classifyPriorAnswerMetaKind(trimmed) !== 'already_answered_claim' &&
    metaCommentClassification?.type !== 'already_answered'
  ) {
    return { handled: false };
  }

  const moment = deps.currentInterviewMomentRef.current ?? 0;
  const scenario = (deps.currentScenarioRef.current ?? 1) as 1 | 2 | 3;
  const scenarioTag = moment >= 4 ? (3 as const) : scenario;
  const { lastAssistantContent, lastInterviewerContent } = resolvePreClaudeAssistantTurnContext(
    deps,
    trimmed,
    messagesToUse,
  );
  const activeQuestionPreview = assessablePromptQuestionBody(
    deps.lastQuestionTextRef.current ?? lastAssistantContent,
  );
  const activeProbeId = resolveActiveProbeForAlreadyAnsweredGate({
    messages: messagesToUse,
    lastQuestionTextRef: deps.lastQuestionTextRef.current ?? '',
    lastAssistantContent,
    lastInterviewerContent,
    activeScenario: scenario,
    currentMoment: moment,
  });

  const priorSubstantive =
    getPriorSubstantiveNonMetaUserContentInMoment(
      messagesToUse.length > 0 ? messagesToUse : deps.messages,
      scenarioTag,
      moment,
    ) ?? '';

  if (!activeProbeId) {
    return { handled: false };
  }

  const reaskQuestionPreview =
    activeQuestionPreview || getCanonicalProbeText(activeProbeId);

  if (!priorSubstantive.trim()) {
    const ackPrefix = buildCheckingInAckOnlySpeech({
      messages: messagesToUse,
      priorSubstantiveText: '',
      activeQuestionPreview: reaskQuestionPreview,
      priorAnswerSatisfiesActiveQuestion: false,
    });
    await deliverInterviewCanonicalProbe({
      deps,
      messagesToUse,
      probeId: activeProbeId,
      userText: trimmed,
      ackPrefix,
      logTag: '[ALREADY_ANSWERED_CLARIFY_REASK_CLIENT_OWNED]',
    });
    void remoteLog('[ALREADY_ANSWERED_CLARIFY_REASK_CLIENT_OWNED]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      activeProbeId,
      preview: ackPrefix.slice(0, 160),
      activeQuestionPreview: reaskQuestionPreview.slice(0, 120),
      verificationReason: 'no_prior_substantive_in_moment',
    });
    return { handled: true };
  }

  const constructFlags = resolvePreClaudeScenarioConstructProbeFlags(
    deps,
    priorSubstantive,
    messagesToUse,
    lastAssistantContent,
    lastInterviewerContent,
    false,
  );

  const activeAnswered = evaluateActiveProbeSubstantivelyAnswered({
    probeId: activeProbeId,
    messages: messagesToUse,
    userText: priorSubstantive,
    constructFlags,
  });

  if (!activeAnswered.satisfied) {
    const ackPrefix = buildCheckingInAckOnlySpeech({
      messages: messagesToUse,
      priorSubstantiveText: priorSubstantive,
      activeQuestionPreview: reaskQuestionPreview,
      priorAnswerSatisfiesActiveQuestion: false,
    });
    await deliverInterviewCanonicalProbe({
      deps,
      messagesToUse,
      probeId: activeProbeId,
      userText: trimmed,
      ackPrefix,
      priorSubstantiveText: priorSubstantive,
      logTag: '[ALREADY_ANSWERED_CLARIFY_REASK_CLIENT_OWNED]',
    });
    void remoteLog('[ALREADY_ANSWERED_CLARIFY_REASK_CLIENT_OWNED]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      activeProbeId,
      preview: ackPrefix.slice(0, 160),
      activeQuestionPreview: reaskQuestionPreview.slice(0, 120),
      verificationReason: activeAnswered.reason,
    });
    return { handled: true };
  }

  const advanceProbeId = resolveAlreadyAnsweredSingleHopAdvanceProbeId({
    activeProbeId,
    messages: messagesToUse,
    userText: priorSubstantive,
    constructFlags,
  });

  if (!advanceProbeId) {
    return { handled: false };
  }

  await deliverScenarioHandoffBeforeAdvanceIfNeeded(deps, messagesToUse, advanceProbeId);

  const ackPrefix = buildAlreadyAnsweredOwnershipAckPrefix(priorSubstantive);
  await deliverInterviewCanonicalProbe({
    deps,
    messagesToUse,
    probeId: advanceProbeId,
    userText: trimmed,
    ackPrefix,
    priorSubstantiveText: priorSubstantive,
    logTag: '[ALREADY_ANSWERED_ADVANCE_CLIENT_OWNED]',
  });
  void remoteLog('[ALREADY_ANSWERED_ADVANCE_CLIENT_OWNED]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    activeProbeId,
    advanceProbeId,
    preview: ackPrefix.slice(0, 120),
    activeQuestionPreview: activeQuestionPreview.slice(0, 120),
    verificationReason: activeAnswered.reason,
  });
  return { handled: true };
}
