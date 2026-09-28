import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { InterviewTurnStateSnapshot } from '@features/aria/interviewTurnOrchestratorTypes';

export function buildInterviewTurnStateSnapshot(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: readonly MessageWithScenario[],
  lastAssistantContent: string,
): InterviewTurnStateSnapshot {
  return {
    currentInterviewMoment: deps.currentInterviewMomentRef.current,
    currentScenario: deps.currentScenarioRef.current,
    lastAssistantContent,
    lastQuestionText: (deps.lastQuestionTextRef.current ?? '').trim(),
    userText: trimmed,
    transcriptTurnCount: messagesToUse.length,
  };
}
