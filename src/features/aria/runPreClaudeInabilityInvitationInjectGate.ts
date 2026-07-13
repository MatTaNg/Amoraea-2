import { INABILITY_INVITATION_ROTATING_LINES } from '@features/aria/interviewPromptInstructions';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  finishPreClaudeSkipInjectionTurn,
  isPreClaudeTurnSkipInjectionRouteActive,
  scenarioTagForSkipMoment,
  type PreClaudeTurnSkipInjectionResult,
} from '@features/aria/preClaudeTurnSkipInjectionShared';

export async function runPreClaudeInabilityInvitationInjectGate(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
): Promise<PreClaudeTurnSkipInjectionResult | null> {
  if (!isPreClaudeTurnSkipInjectionRouteActive(deps)) {
    return null;
  }

  const tagInv = scenarioTagForSkipMoment(deps, messagesToUse);
  const momentInv = deps.currentInterviewMomentRef.current;
  deps.inabilityCountByMomentRef.current = {
    ...deps.inabilityCountByMomentRef.current,
    [momentInv]: 1,
  };
  const priorUserCount = messagesToUse.filter((m) => m.role === 'user').length;
  const inviteLine =
    INABILITY_INVITATION_ROTATING_LINES[
      (priorUserCount + momentInv) % INABILITY_INVITATION_ROTATING_LINES.length
    ];
  const inviteMsg: MessageWithScenario = {
    role: 'assistant',
    content: inviteLine,
    scenarioNumber: tagInv as 1 | 2 | 3,
  };
  deps.setMessages([...messagesToUse, inviteMsg]);
  await deps.speakTextSafe(inviteLine, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    allowDuplicateConsecutiveTts: true,
  });
  return finishPreClaudeSkipInjectionTurn(deps);
}
