import { evaluateInterviewTurnOrchestratorDecision } from '@features/aria/evaluateInterviewTurnOrchestratorDecision';
import { buildInterviewTurnStateSnapshot } from '@features/aria/buildInterviewTurnStateSnapshot';
import type { ConstructSatisfactionResolvedByProbe } from '@features/aria/interviewConstructSatisfactionLlmTypes';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import {
  INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_LIVE_ENABLED,
  INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_SHADOW_ENABLED,
  INTERVIEW_TURN_ORCHESTRATOR_SHADOW_ENABLED,
} from '@features/aria/interviewTurnOrchestratorConfig';
import type { ResolvedInterviewTurnOrchestratorDecision } from '@features/aria/prefetchInterviewTurnOrchestratorLlmForTurn';
import { evaluateInterviewProbeConstructSatisfaction } from '@features/aria/evaluateInterviewProbeConstructSatisfaction';
import { scheduleInterviewConstructSatisfactionLlmShadow } from '@features/aria/scheduleInterviewConstructSatisfactionLlmShadow';
import { remoteLog } from '@utilities/remoteLog';

/** Shadow-mode telemetry — compare orchestrator plan vs legacy gate outcomes before cutover. */
export function logInterviewTurnOrchestratorShadow(args: {
  deps: PreClaudeTurnGateDeps;
  trimmed: string;
  messagesToUse: MessageWithScenario[];
  lastAssistantContent: string;
  constructProbeFlags: PreClaudeScenarioConstructProbeFlags;
  metaCommentClassification: MetaCommentClassification | null;
  constructSatisfactionResolvedByProbe?: ConstructSatisfactionResolvedByProbe;
  resolvedOrchestrator?: ResolvedInterviewTurnOrchestratorDecision;
}): void {
  if (!INTERVIEW_TURN_ORCHESTRATOR_SHADOW_ENABLED) return;
  const snapshot = buildInterviewTurnStateSnapshot(
    args.deps,
    args.trimmed,
    args.messagesToUse,
    args.lastAssistantContent,
  );
  const decision =
    args.resolvedOrchestrator?.decision ??
    evaluateInterviewTurnOrchestratorDecision({
      snapshot,
      messages: args.messagesToUse,
      constructFlags: args.constructProbeFlags,
      metaCommentClassification: args.metaCommentClassification,
      constructSatisfactionResolvedByProbe: args.constructSatisfactionResolvedByProbe,
    });

  void remoteLog('[INTERVIEW_TURN_ORCHESTRATOR_SHADOW]', {
    interviewSessionId: args.deps.interviewSessionIdRef.current,
    moment: snapshot.currentInterviewMoment,
    scenario: snapshot.currentScenario,
    userIntent: decision.userIntent,
    pendingProbeId: decision.pendingProbeId,
    satisfiedProbeIds: decision.satisfiedProbeIds,
    activeConstructEngaged: decision.activeConstructEngaged,
    actionKind: decision.action.kind,
    decisionSource: decision.source,
    reason: decision.reason,
    userPreview: snapshot.userText.slice(0, 120),
    activeQuestionPreview: decision.activeQuestionPreview,
    orchestratorResolution: args.resolvedOrchestrator?.resolution ?? 'heuristic_only',
  });

  if (!decision.pendingProbeId) return;

  const pendingResolved = args.constructSatisfactionResolvedByProbe?.[decision.pendingProbeId];
  const liveAlreadyRan =
    INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_LIVE_ENABLED &&
    pendingResolved != null &&
    pendingResolved.llm != null;

  if (liveAlreadyRan || !INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_SHADOW_ENABLED) {
    return;
  }

  const heuristic = evaluateInterviewProbeConstructSatisfaction({
    probeId: decision.pendingProbeId,
    messages: args.messagesToUse,
    userText: args.trimmed,
    constructFlags: args.constructProbeFlags,
  });
  if (heuristic.source === 'transcript_delivered') return;

  scheduleInterviewConstructSatisfactionLlmShadow({
    interviewSessionId: args.deps.interviewSessionIdRef.current,
    probeId: decision.pendingProbeId,
    activeQuestionPreview: decision.activeQuestionPreview,
    userText: args.trimmed,
    messages: args.messagesToUse,
    currentScenario: snapshot.currentScenario,
    heuristic,
  });
}
