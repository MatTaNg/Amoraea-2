import type {
  ClosingPhase,
  ClosingQuestionActionsDeps,
} from '@features/aria/interviewClosingQuestionTypes';

export function runCanAdvanceFromScenario(
  closingQuestionState: Record<1 | 2 | 3, ClosingPhase>,
  scenarioNumber: 1 | 2 | 3,
): boolean {
  return closingQuestionState[scenarioNumber] === 'answered';
}

export function runMarkClosingQuestionAsked(
  deps: ClosingQuestionActionsDeps,
  scenarioNumber: 1 | 2 | 3,
): void {
  deps.closingQuestionAskedRef.current[scenarioNumber] = true;
  deps.lastClosingQuestionScenarioRef.current = scenarioNumber;
  deps.setClosingQuestionState((prev) => ({ ...prev, [scenarioNumber]: 'asked' }));
}

export function runMarkClosingQuestionAnswered(
  deps: ClosingQuestionActionsDeps,
  scenarioNumber: 1 | 2 | 3,
): void {
  deps.closingQuestionAnsweredRef.current[scenarioNumber] = true;
  deps.lastAnsweredClosingScenarioRef.current = scenarioNumber;
  deps.lastClosingQuestionScenarioRef.current = null;
  deps.setClosingQuestionState((prev) => ({ ...prev, [scenarioNumber]: 'answered' }));
}
