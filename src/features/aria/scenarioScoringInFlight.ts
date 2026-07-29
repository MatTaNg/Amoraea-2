/** Tracks parallel scenario scoring promises so completion can await in-flight work. */
const inFlightByScenario = new Map<1 | 2 | 3, Promise<void>>();

export function trackScenarioScoringInFlight(
  scenarioNumber: 1 | 2 | 3,
  promise: Promise<void>,
): void {
  inFlightByScenario.set(scenarioNumber, promise);
  void promise.finally(() => {
    if (inFlightByScenario.get(scenarioNumber) === promise) {
      inFlightByScenario.delete(scenarioNumber);
    }
  });
}

export async function awaitInFlightScenarioScoring(): Promise<void> {
  const pending = [...inFlightByScenario.values()];
  if (pending.length === 0) return;
  await Promise.all(pending);
}

export function resetScenarioScoringInFlightForTests(): void {
  inFlightByScenario.clear();
}
