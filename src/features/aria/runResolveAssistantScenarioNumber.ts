import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { ResolveAssistantScenarioNumberDeps } from '@features/aria/resolveAssistantScenarioNumberTypes';

export function runResolveAssistantScenarioNumber(
  deps: ResolveAssistantScenarioNumberDeps,
  content: string,
  prev: MessageWithScenario[],
): 1 | 2 | 3 {
  if (deps.currentInterviewMomentRef.current >= 4) return 3;
  const detected = deps.detectScenarioFromResponse(content);
  if (detected != null) return detected;
  if (deps.currentInterviewMomentRef.current === 3 && deps.isScenarioCQ1Prompt(content)) return 3;
  const refScenario = deps.currentScenarioRef.current;
  if (refScenario === 1 || refScenario === 2 || refScenario === 3) return refScenario;
  const inferred = deps.getScenarioNumberForNewMessage(prev, 'assistant', content);
  return (inferred === 1 || inferred === 2 || inferred === 3 ? inferred : 1) as 1 | 2 | 3;
}
