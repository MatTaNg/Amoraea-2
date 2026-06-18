/**
 * Audit redundancy between holistic pillar floor breach and per-scenario composite floor.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/auditFloorRedundancy.ts
 *   npx tsx --env-file=.env scripts/auditFloorRedundancy.ts 6c0470b7 af88b820
 */
import { createClient } from '@supabase/supabase-js';
import { GATE_MARKER_FLOORS } from '../src/features/aria/computeGateResultCore';
import {
  recalculateAttemptScoresFromStoredSlices,
  type AdminRecalculateAttemptInput,
} from '../src/features/aria/adminRecalculateAttemptScores';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

const DEFAULT_PREFIXES = ['6c0470b7', 'c1ebbcdc', 'af88b820', 'ad23da2d', 'e725cdad', 'fa365f2a'];

const ATTEMPT_SELECT = `
  id,
  user_id,
  completed_at,
  transcript,
  scenario_1_scores,
  scenario_2_scores,
  scenario_3_scores,
  scenario_specific_patterns,
  ego_development_level,
  language_markers,
  skip_count,
  skip_penalty_total,
  auto_failed,
  defense_patterns,
  mentalizing_overcertainty_count,
  personal_moment_emotional_vocab_density,
  personal_moment_emotional_vocab_low,
  review_flags,
  reasoning_pending,
  is_phantom,
  gate_fail_reasons,
  weighted_score,
  modified_weighted_score,
  passed,
  scenario_composites
`;

type RawRow = AdminRecalculateAttemptInput & {
  id: string;
  user_id: string;
  gate_fail_reasons: unknown;
  passed: boolean | null;
};

type FloorFlags = {
  pillarFloor: boolean;
  scenarioFloor: boolean;
  pillarBreachMarkers: string[];
  scenarioBreachList: string[];
  gateReason: string;
  failReasonCodes: string[];
  failReason: string | null;
  weightedScore: number | null;
  modifiedWeightedScore: number | null;
};

function classifyGate(recalc: ReturnType<typeof recalculateAttemptScoresFromStoredSlices>): FloorFlags | null {
  if (recalc.kind !== 'success') return null;
  const gate = recalc.gate;
  const codes = gate.failReasonCodes ?? [];
  const pillarFloor = gate.reason === 'floor_breach' || (gate.failReason?.includes('floor_breach:') ?? false);

  const scenarioBreaches = gate.failReasonDetail?.scenario_floor?.breaches ?? [];
  const scenarioFloor =
    codes.includes('scenario_floor') ||
    scenarioBreaches.length > 0 ||
    (gate.failReason?.includes('scenario_floor:') ?? false);

  const pillarBreachMarkers: string[] = [];
  if (pillarFloor && recalc.pillar_scores) {
    for (const [id, floor] of Object.entries(GATE_MARKER_FLOORS)) {
      const score = recalc.pillar_scores[id];
      if (typeof score === 'number' && score < floor) {
        pillarBreachMarkers.push(`${id} (${score})`);
      }
    }
  }

  return {
    pillarFloor,
    scenarioFloor,
    pillarBreachMarkers,
    scenarioBreachList: scenarioBreaches.map((b) => `S${b.scenario}=${b.composite.toFixed(2)}`),
    gateReason: gate.reason,
    failReasonCodes: codes,
    failReason: gate.failReason,
    weightedScore: gate.weightedScore,
    modifiedWeightedScore: gate.modifiedWeightedScore ?? null,
  };
}

function printHeader(): void {
  console.log('PILLAR FLOOR vs SCENARIO FLOOR REDUNDANCY AUDIT');
  console.log('==================================================');
  console.log('');
  console.log('Pillar floor breach computed from:');
  console.log('  computeGateResultCore() lines 427–434 — compares ROLLUP aggregated pillar_scores');
  console.log('  (aggregateMarkerScoresFromSlices: per-marker mean across allowed scenario moments)');
  console.log('  against GATE_MARKER_FLOORS (contempt/accountability/repair ≥5.0, regulation ≥4.5).');
  console.log('  Primary reason: gate.reason = "floor_breach" (NOT stored in gate_fail_reasons array).');
  console.log('');
  console.log('Scenario composite floor computed from:');
  console.log('  buildScenarioCompositesTriple() + scenarioFloorBreaches() — per-scenario mean of ALL');
  console.log('  numeric pillar scores in each scenario_1/2/3 slice; breach when composite < 5.0.');
  console.log('  Stored in gate_fail_reasons as code "scenario_floor".');
  console.log('');
  console.log('Shared input overlap:');
  console.log('  Both read scenario_1/2/3 pillarScores JSON (accountability, repair, mentalizing, etc.).');
  console.log('  Pillar floor: cross-scenario AVERAGE per marker (e.g. accountability = mean(S1,S2,S3)).');
  console.log('  Scenario floor: WITHIN-scenario AVERAGE across all scored pillars in that slice.');
  console.log('  Accountability sub-scores in S1/S2/S3 feed BOTH checks via different aggregation.');
  console.log('  M4/M5 slices excluded from scenario composites; commitment_threshold rollup is M4-only.');
  console.log('');
  console.log('Gate execution order (computeGateResultCore):');
  console.log('  1) Compute aggregated pillar floors → early return if any breach (reason=floor_breach)');
  console.log('  2) Still attach scenario_floor to failReasonCodes if composites also breach');
  console.log('  3) If no pillar floor, continue to weighted threshold + scenario_floor + mentalizing/repair floors');
  console.log('');
}

function printDownstreamCheck(): void {
  console.log('Downstream double-counting check (code inspection):');
  console.log('  uncertainty_score references gate_fail_reasons count/content: NO');
  console.log('    (computeUncertaintyScore.ts uses pillar_scores, scenario_composites variance,');
  console.log('     review_flags, disclosure_calibration — not gate_fail_reasons)');
  console.log('  review_flags logic references gate_fail_reasons count/content: NO');
  console.log('    (review_flags set inside computeGateResultCore from depth/ego/defense signals)');
  console.log('  gaming_correction references gate_fail_reasons count/content: NO');
  console.log('    (computeGamingCorrection.ts uses instrumentComponents, straightLineFlags, uncertaintyScore)');
  console.log('');
  console.log('  Note: scenario_composites variance in uncertainty CAN correlate with scenario_floor');
  console.log('  failures but is a separate formula (σ² across S1/S2/S3), not gate_fail_reasons length.');
  console.log('');
}

function printAttemptDetail(id: string, flags: FloorFlags): void {
  console.log(`--- ${id} ---`);
  console.log(`  gate.reason: ${flags.gateReason}`);
  console.log(`  gate_fail_reasons: [${flags.failReasonCodes.join(', ') || '(none)'}]`);
  console.log(`  failReason: ${flags.failReason ?? '(none)'}`);
  console.log(`  pillar floor breach: ${flags.pillarFloor ? 'YES' : 'NO'} ${flags.pillarBreachMarkers.join(', ')}`);
  console.log(`  scenario floor breach: ${flags.scenarioFloor ? 'YES' : 'NO'} ${flags.scenarioBreachList.join('; ')}`);
  console.log(`  weighted: ${flags.weightedScore} → modified: ${flags.modifiedWeightedScore}`);
  console.log('');
}

async function main(): Promise<void> {
  const prefixes = process.argv.slice(2);
  const highlightPrefixes = prefixes.length > 0 ? prefixes : DEFAULT_PREFIXES;

  const { data, error } = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_SELECT)
    .not('completed_at', 'is', null)
    .or('is_phantom.eq.false,is_phantom.is.null');

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const rows = (data ?? []) as RawRow[];
  const classified: Array<{ id: string; flags: FloorFlags }> = [];

  let pillarOnly = 0;
  let scenarioOnly = 0;
  let both = 0;
  let pillarTotal = 0;
  let scenarioTotal = 0;
  let neitherFail = 0;

  for (const row of rows) {
    const recalc = recalculateAttemptScoresFromStoredSlices(row, {
      skipScenarioTranscriptMutations: true,
      usePersistedGateContext: false,
    });
    const flags = classifyGate(recalc);
    if (!flags) continue;

    classified.push({ id: row.id, flags });

    if (flags.pillarFloor) pillarTotal++;
    if (flags.scenarioFloor) scenarioTotal++;

    if (flags.pillarFloor && flags.scenarioFloor) both++;
    else if (flags.pillarFloor) pillarOnly++;
    else if (flags.scenarioFloor) scenarioOnly++;
    else if (!recalc.gate.pass) neitherFail++;
  }

  const total = classified.length;
  const coOccurrenceRate = pillarTotal > 0 ? Math.round((both / pillarTotal) * 1000) / 10 : 0;
  const coOccurrenceRateScenario = scenarioTotal > 0 ? Math.round((both / scenarioTotal) * 1000) / 10 : 0;

  printHeader();

  console.log('Historical co-occurrence (recomputed from stored slices, n=' + total + ' completed non-phantom):');
  console.log(`  Cases where pillar floor breach fired: ${pillarTotal}`);
  console.log(`  Cases where scenario floor fired: ${scenarioTotal}`);
  console.log(`  Cases where BOTH fired together: ${both}`);
  console.log(`  Cases where pillar floor fired WITHOUT scenario floor: ${pillarOnly}`);
  console.log(`  Cases where scenario floor fired WITHOUT pillar floor: ${scenarioOnly}`);
  console.log(`  Co-occurrence given pillar floor: ${coOccurrenceRate}%`);
  console.log(`  Co-occurrence given scenario floor: ${coOccurrenceRateScenario}%`);
  console.log('');

  if (pillarOnly > 0) {
    console.log('Pillar-only examples (no scenario composite breach):');
    for (const { id, flags } of classified.filter((c) => c.flags.pillarFloor && !c.flags.scenarioFloor).slice(0, 5)) {
      printAttemptDetail(id, flags);
    }
  }

  if (scenarioOnly > 0) {
    console.log('Scenario-only examples (aggregated pillars pass floors):');
    for (const { id, flags } of classified.filter((c) => !c.flags.pillarFloor && c.flags.scenarioFloor).slice(0, 5)) {
      printAttemptDetail(id, flags);
    }
  }

  console.log('Reference attempts:');
  for (const prefix of highlightPrefixes) {
    const match = classified.find((c) => c.id.startsWith(prefix));
    if (match) printAttemptDetail(match.id, match.flags);
    else console.log(`  (not found: ${prefix})`);
  }

  printDownstreamCheck();

  console.log('CONCLUSION:');
  if (coOccurrenceRate >= 90) {
    console.log(
      `  High co-occurrence (${coOccurrenceRate}% of pillar-floor cases also breach scenario floor) —`,
    );
    console.log('  the two checks largely articulate the same weak performance when scores are uniformly low.');
  } else {
    console.log(
      `  Co-occurrence is ${coOccurrenceRate}% when pillar floor fires — checks are partially independent.`,
    );
    console.log(`  ${scenarioOnly} attempt(s) fail scenario floor without holistic pillar floor breach.`);
    console.log(`  ${pillarOnly} attempt(s) fail pillar floor without scenario composite breach.`);
  }
  console.log('  final_gate_pass is binary; multiple fail codes do not stack additional score penalties.');
  console.log('  floor_breach is NOT in gate_fail_reasons — only scenario_floor / weighted_score / etc. are.');
  console.log('  No downstream logic counts gate_fail_reasons entries as severity — no double-penalization.');
  console.log('');
  console.log('  Recommended: keep both only if product wants belt-and-suspenders logging; otherwise');
  console.log('  scenario_floor alone catches per-scenario weakness; pillar floor catches cross-scenario');
  console.log('  aggregate weakness (e.g. contempt pool) that scenario composites can miss.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
