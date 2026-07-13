export function defaultScenarioDisplayName(scenarioNumber: 1 | 2 | 3): string {
  return scenarioNumber === 1
    ? 'Scenario A (Emma/Ryan)'
    : scenarioNumber === 2
      ? 'Scenario B (Sarah/James)'
      : 'Scenario C (Sophie/Daniel)';
}
