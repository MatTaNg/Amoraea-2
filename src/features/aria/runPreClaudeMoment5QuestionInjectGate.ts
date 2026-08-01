import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { deliverMoment5ConflictProbe } from '@features/aria/deliverMoment5ConflictProbe';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';

export type PreClaudeMoment5QuestionInjectGateResult = {
  handled: boolean;
};

/** Legacy inject gate — delegates to shared M5 delivery (orchestrator-owned when collapse enabled). */
export async function runPreClaudeMoment5QuestionInjectGate(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
  participantFirstNameForSpoken: string,
): Promise<PreClaudeMoment5QuestionInjectGateResult> {
  const result = await deliverMoment5ConflictProbe({
    deps,
    messagesToUse,
    participantFirstNameForSpoken,
    logTag: '[M5_QUESTION_INJECT]',
  });
  return { handled: result.delivered };
}
