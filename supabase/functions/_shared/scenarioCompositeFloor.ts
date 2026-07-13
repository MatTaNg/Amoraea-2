/** Minimum mean pillar score per scenario (1–3) for gate pass; Moment 4/5 excluded by caller. */
export { SCENARIO_COMPOSITE_PASS_MIN } from '../../../src/config/scoring/scenarioFloors.ts';
import { SCENARIO_COMPOSITE_PASS_MIN } from '../../../src/config/scoring/scenarioFloors.ts';

export type ScenarioGateIndex = 1 | 2 | 3;

export type ScenarioCompositesTriple = Record<'1' | '2' | '3', number | null>;

/** Counts every finite numeric pillar value (null/undefined omitted). Zero counts toward the mean. */
function isPresentPillarScore(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Read pillar scores from a stored scenario bundle (camelCase or snake_case). */
export function readPillarScoresFromScenarioBundle(
  bundle: unknown,
): Record<string, number | null | undefined> | null | undefined {
  if (bundle == null || typeof bundle !== 'object' || Array.isArray(bundle)) return undefined;
  const o = bundle as Record<string, unknown>;
  const ps = o.pillarScores ?? o.pillar_scores;
  if (ps == null || typeof ps !== 'object' || Array.isArray(ps)) return undefined;
  return ps as Record<string, number | null | undefined>;
}

function normalizeScenarioPillarScoresInput(
  raw: Record<string, number | null | undefined> | null | undefined,
): Record<string, number | null | undefined> | null | undefined {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const asRecord = raw as Record<string, unknown>;
  if ('pillarScores' in asRecord || 'pillar_scores' in asRecord) {
    return readPillarScoresFromScenarioBundle(asRecord);
  }
  return raw;
}

export function buildScenarioPillarMapsFromStoredBundles(
  scenario1: unknown,
  scenario2: unknown,
  scenario3: unknown,
): Partial<Record<ScenarioGateIndex, Record<string, number | null | undefined> | null | undefined>> {
  return {
    1: readPillarScoresFromScenarioBundle(scenario1),
    2: readPillarScoresFromScenarioBundle(scenario2),
    3: readPillarScoresFromScenarioBundle(scenario3),
  };
}

/**
 * Mean of all non-null pillar scores in a scenario slice (null/missing omitted). Returns null if none present.
 */
export function meanScenarioCompositeFromPillarScores(
  pillarScores: Record<string, unknown> | null | undefined,
): number | null {
  if (!pillarScores || typeof pillarScores !== 'object') return null;
  let sum = 0;
  let n = 0;
  for (const v of Object.values(pillarScores)) {
    if (isPresentPillarScore(v)) {
      sum += v;
      n++;
    }
  }
  if (n === 0) return null;
  return sum / n;
}

export function buildScenarioCompositesTriple(
  scenarioPillarScoresByScenario: Partial<
    Record<ScenarioGateIndex, Record<string, number | null | undefined> | null | undefined>
  >,
): ScenarioCompositesTriple {
  const triple: ScenarioCompositesTriple = { '1': null, '2': null, '3': null };
  for (const idx of [1, 2, 3] as const) {
    const ps = normalizeScenarioPillarScoresInput(
      scenarioPillarScoresByScenario[idx] as Record<string, number | null | undefined> | null | undefined,
    );
    const key = String(idx) as keyof ScenarioCompositesTriple;
    triple[key] = meanScenarioCompositeFromPillarScores(ps as Record<string, unknown> | null | undefined);
  }
  return triple;
}

export function scenarioFloorBreaches(composites: ScenarioCompositesTriple): Array<{
  scenario: ScenarioGateIndex;
  composite: number;
}> {
  const out: Array<{ scenario: ScenarioGateIndex; composite: number }> = [];
  for (const idx of [1, 2, 3] as const) {
    const key = String(idx) as keyof ScenarioCompositesTriple;
    const c = composites[key];
    if (c != null && c < SCENARIO_COMPOSITE_PASS_MIN) {
      out.push({ scenario: idx, composite: c });
    }
  }
  return out;
}

export function formatScenarioFloorFailReason(
  breaches: Array<{ scenario: ScenarioGateIndex; composite: number }>,
  weightedThresholdMet: boolean,
): string {
  const parts = breaches.map((b) => `S${b.scenario}=${b.composite.toFixed(2)}`).join(', ');
  const base = `scenario_floor: ${parts} (min ${SCENARIO_COMPOSITE_PASS_MIN})`;
  return weightedThresholdMet ? `${base}; weighted_threshold_met` : base;
}

/**
 * Shape stored in `interview_attempts.scenario_composites` (jsonb).
 */
export function scenarioCompositesToStorageJson(
  triple: ScenarioCompositesTriple | null | undefined,
): Record<string, number | null> | null {
  if (triple == null) return null;
  return {
    scenario_1: triple['1'],
    scenario_2: triple['2'],
    scenario_3: triple['3'],
  };
}
