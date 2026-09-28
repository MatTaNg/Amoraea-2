import type { InterviewTurnOrchestratorDecision } from '@features/aria/interviewTurnOrchestratorTypes';

function probeIdForAction(decision: InterviewTurnOrchestratorDecision): string | null {
  const { action } = decision;
  if (action.kind === 'speak_canonical' || action.kind === 'skip_probe_already_satisfied') {
    return action.probeId;
  }
  if (action.kind === 'speak_fixed_line') {
    return action.lineId;
  }
  return null;
}

/** Compare heuristic vs LLM planner outputs for shadow telemetry. */
export function compareInterviewTurnOrchestratorDecisions(
  heuristic: InterviewTurnOrchestratorDecision,
  llm: InterviewTurnOrchestratorDecision,
): {
  actionKindAgrees: boolean;
  userIntentAgrees: boolean;
  pendingProbeAgrees: boolean;
  probeActionAgrees: boolean;
  fullyAgrees: boolean;
} {
  const actionKindAgrees = heuristic.action.kind === llm.action.kind;
  const userIntentAgrees = heuristic.userIntent === llm.userIntent;
  const pendingProbeAgrees = heuristic.pendingProbeId === llm.pendingProbeId;

  const heuristicProbe = probeIdForAction(heuristic);
  const llmProbe = probeIdForAction(llm);
  const probeActionAgrees =
    heuristicProbe == null && llmProbe == null
      ? true
      : heuristicProbe != null && llmProbe != null && heuristicProbe === llmProbe;

  const fullyAgrees =
    actionKindAgrees && userIntentAgrees && pendingProbeAgrees && probeActionAgrees;

  return {
    actionKindAgrees,
    userIntentAgrees,
    pendingProbeAgrees,
    probeActionAgrees,
    fullyAgrees,
  };
}
