/** Per-scenario Mentalizing / Repair must be ≥ this value unless fewer than 2 scenarios breach together. */
export const MENTALIZING_REPAIR_SCENARIO_PASS_MIN = 4;

/** Fail when this many scenarios have an assessed pillar score strictly below {@link MENTALIZING_REPAIR_SCENARIO_PASS_MIN}. */
export const MENTALIZING_REPAIR_LOW_SCENARIO_COUNT_FAIL = 2;

export type ScenarioGateIndex = 1 | 2 | 3;

/** Assessed in a scenario slice: non-null finite number (missing/null excluded from counts). */
export function pillarScoreAssessedInScenario(v: unknown): v is number {
  return v !== null && v !== undefined && typeof v === 'number' && Number.isFinite(v);
}

export type ScenarioPillarLow = { scenario: ScenarioGateIndex; score: number };

export function scenariosBelowMinForPillar(
  scenarioPillarScoresByScenario: Partial<
    Record<ScenarioGateIndex, Record<string, number | null | undefined> | null | undefined>
  >,
  pillarId: 'mentalizing' | 'repair',
): ScenarioPillarLow[] {
  const out: ScenarioPillarLow[] = [];
  for (const n of [1, 2, 3] as const) {
    const ps = scenarioPillarScoresByScenario[n];
    if (!ps || typeof ps !== 'object') continue;
    const v = ps[pillarId];
    if (!pillarScoreAssessedInScenario(v)) continue;
    if (v < MENTALIZING_REPAIR_SCENARIO_PASS_MIN) {
      out.push({ scenario: n, score: v });
    }
  }
  return out.slice().sort((a, b) => a.scenario - b.scenario);
}

export function mentalizingRepairFloorTriggered(
  scenarioPillarScoresByScenario: Partial<
    Record<ScenarioGateIndex, Record<string, number | null | undefined> | null | undefined>
  >,
): {
  mentalizingLowScenarios: ScenarioPillarLow[];
  repairLowScenarios: ScenarioPillarLow[];
  mentalizingFloorFails: boolean;
  repairFloorFails: boolean;
} {
  const mentalizingLowScenarios = scenariosBelowMinForPillar(scenarioPillarScoresByScenario, 'mentalizing');
  const repairLowScenarios = scenariosBelowMinForPillar(scenarioPillarScoresByScenario, 'repair');
  return {
    mentalizingLowScenarios,
    repairLowScenarios,
    mentalizingFloorFails: mentalizingLowScenarios.length >= MENTALIZING_REPAIR_LOW_SCENARIO_COUNT_FAIL,
    repairFloorFails: repairLowScenarios.length >= MENTALIZING_REPAIR_LOW_SCENARIO_COUNT_FAIL,
  };
}

export function formatMentalizingRepairFloorSnippet(
  kind: 'mentalizing_floor' | 'repair_floor',
  lows: ScenarioPillarLow[],
): string {
  const parts = lows.map((x) => `S${x.scenario}=${x.score.toFixed(2)}`).join(', ');
  return `${kind}: ${parts} (< ${MENTALIZING_REPAIR_SCENARIO_PASS_MIN} in ${MENTALIZING_REPAIR_LOW_SCENARIO_COUNT_FAIL}+ scenarios)`;
}
