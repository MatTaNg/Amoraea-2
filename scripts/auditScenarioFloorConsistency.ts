/**
 * Audit whether scenario_floor considers cross-scenario consistency or any single breach.
 *
 * Usage: npx tsx --env-file=.env scripts/auditScenarioFloorConsistency.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  buildScenarioCompositesTriple,
  scenarioFloorBreaches,
  SCENARIO_COMPOSITE_PASS_MIN,
} from '../src/features/aria/scenarioCompositeFloor';
import {
  recalculateAttemptScoresFromStoredSlices,
  type AdminRecalculateAttemptInput,
} from '../src/features/aria/adminRecalculateAttemptScores';

const ATTEMPT_SELECT = `
  id,
  user_id,
  completed_at,
  is_phantom,
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
  gate_fail_reasons
`;

type RawRow = AdminRecalculateAttemptInput & {
  id: string;
  user_id: string;
  gate_fail_reasons: unknown;
};

type BreachRow = {
  userId: string;
  attemptId: string;
  composites: { s1: number | null; s2: number | null; s3: number | null };
  breaches: Array<{ scenario: 1 | 2 | 3; composite: number }>;
  category: 'isolated_strong' | 'isolated_mild' | 'multi';
  inGateFailReasons: boolean;
  finalPass: boolean;
};

function mergeEnvFromDotenvFile(): void {
  try {
    const path = join(process.cwd(), '.env');
    if (!existsSync(path)) return;
    const txt = readFileSync(path, 'utf8');
    for (const line of txt.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

function gateReasonsArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

function classifyBreach(
  composites: { s1: number | null; s2: number | null; s3: number | null },
  breaches: Array<{ scenario: 1 | 2 | 3; composite: number }>,
): BreachRow['category'] | null {
  if (breaches.length === 0) return null;
  if (breaches.length >= 2) return 'multi';

  const breaching = breaches[0]!.scenario;
  const others = ([1, 2, 3] as const)
    .filter((s) => s !== breaching)
    .map((s) => (s === 1 ? composites.s1 : s === 2 ? composites.s2 : composites.s3))
    .filter((v): v is number => v != null && Number.isFinite(v));

  if (others.length < 2) return 'multi';
  if (others.every((v) => v >= 6.0)) return 'isolated_strong';
  return 'isolated_mild';
}

function formatCompositeList(
  composites: { s1: number | null; s2: number | null; s3: number | null },
  breaching: 1 | 2 | 3,
): string {
  const vals = [
    `S1=${composites.s1?.toFixed(2) ?? '—'}`,
    `S2=${composites.s2?.toFixed(2) ?? '—'}`,
    `S3=${composites.s3?.toFixed(2) ?? '—'}`,
  ];
  const breachVal =
    breaching === 1 ? composites.s1 : breaching === 2 ? composites.s2 : composites.s3;
  const otherVals = ([1, 2, 3] as const)
    .filter((s) => s !== breaching)
    .map((s) => {
      const v = s === 1 ? composites.s1 : s === 2 ? composites.s2 : composites.s3;
      return `S${s}=${v?.toFixed(2) ?? '—'}`;
    });
  return `S${breaching}=${breachVal?.toFixed(2) ?? '—'} (breach); others: ${otherVals.join(', ')}`;
}

function renderReport(
  scorableN: number,
  breaches: BreachRow[],
  aa8Row: BreachRow | null,
): string {
  const isolatedStrong = breaches.filter((b) => b.category === 'isolated_strong');
  const isolatedMild = breaches.filter((b) => b.category === 'isolated_mild');
  const multi = breaches.filter((b) => b.category === 'multi');
  const n = breaches.length;
  const pct = (x: number) => (n > 0 ? ((100 * x) / n).toFixed(1) : '0.0');

  const lines = [
    'SCENARIO FLOOR CONSISTENCY AUDIT',
    '===================================',
    '',
    'Current logic:',
    `  buildScenarioCompositesTriple() computes the arithmetic mean of ALL finite pillar scores`,
    `  within each scenario slice (S1, S2, S3 only — M4/M5 excluded).`,
    `  scenarioFloorBreaches() returns every scenario where composite < ${SCENARIO_COMPOSITE_PASS_MIN}.`,
    `  Gate fails scenario_floor if breaches.length > 0 — pure OR logic with no cross-scenario`,
    `  averaging, no severity weighting, and no "2 of 3" consistency requirement.`,
    `  A single breaching scenario is structurally equivalent to three breaching together.`,
    '',
    `Dataset: ${scorableN} scorable completed attempts (recompute success).`,
    `Total scenario_floor composite breaches: N=${n} (${((100 * n) / scorableN).toFixed(1)}% of scorable cohort)`,
    '',
    'Historical breakdown (scenario_floor breaches):',
    `  Single-scenario breach, other 2 scenarios ≥ 6.0 (isolated collapse pattern): ${isolatedStrong.length} (${pct(isolatedStrong.length)}%)`,
  ];

  for (const row of isolatedStrong.sort((a, b) => a.userId.localeCompare(b.userId))) {
    const b = row.breaches[0]!;
    lines.push(
      `    ${row.userId.slice(0, 8)} | ${formatCompositeList(row.composites, b.scenario)} | gate_fail_reasons: ${row.inGateFailReasons ? 'yes' : 'no'} | final_pass: ${row.finalPass}`,
    );
  }

  lines.push(
    `  Single-scenario breach, other 2 scenarios 5.0–6.0 (mild overall weakness): ${isolatedMild.length} (${pct(isolatedMild.length)}%)`,
  );
  for (const row of isolatedMild.sort((a, b) => a.userId.localeCompare(b.userId))) {
    const b = row.breaches[0]!;
    lines.push(
      `    ${row.userId.slice(0, 8)} | ${formatCompositeList(row.composites, b.scenario)} | gate_fail_reasons: ${row.inGateFailReasons ? 'yes' : 'no'} | final_pass: ${row.finalPass}`,
    );
  }

  lines.push(`  Multi-scenario breach (2 or 3 scenarios < ${SCENARIO_COMPOSITE_PASS_MIN}): ${multi.length} (${pct(multi.length)}%)`);
  for (const row of multi.sort((a, b) => a.userId.localeCompare(b.userId))) {
    const breachParts = row.breaches.map((b) => `S${b.scenario}=${b.composite.toFixed(2)}`).join(', ');
    lines.push(
      `    ${row.userId.slice(0, 8)} | breaches: ${breachParts}; all: S1=${row.composites.s1?.toFixed(2) ?? '—'}, S2=${row.composites.s2?.toFixed(2) ?? '—'}, S3=${row.composites.s3?.toFixed(2) ?? '—'} | gate_fail_reasons: ${row.inGateFailReasons ? 'yes' : 'no'} | final_pass: ${row.finalPass}`,
    );
  }

  lines.push(
    '',
    'Reference case: aa8c081c / attempt 824326a2',
    aa8Row
      ? `  Present in breach set: yes | category: ${aa8Row.category} | ${formatCompositeList(aa8Row.composites, aa8Row.breaches[0]!.scenario)}`
      : '  Present in breach set: no (unexpected — verify composites)',
    '',
    'INTERPRETATION',
    '================',
    'If isolated single-scenario collapse (other two strong) represents a meaningful',
    'share of scenario_floor failures, the current binary "any breach fails" design',
    'may be over-weighting single atypical moments relative to consistent patterns.',
    'Consider whether the floor should require either (a) the breach to be severe',
    'enough on its own merits regardless of pattern, which may be the correct',
    'design if even one instance of contempt/poor mentalizing is considered',
    'disqualifying on principle, or (b) some form of cross-scenario averaging or',
    '"2 of 3 must breach" rule that better reflects consistency of pattern over',
    'a single moment.',
    '',
    'This is a policy decision, not a pure bug — both interpretations are valid',
    'pending product input.',
  );

  return lines.join('\n');
}

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_SELECT)
    .not('completed_at', 'is', null)
    .or('is_phantom.eq.false,is_phantom.is.null');

  if (error) throw error;

  const rows = (data ?? []) as RawRow[];
  const breachRows: BreachRow[] = [];
  let scorableN = 0;

  for (const row of rows) {
    const recalc = recalculateAttemptScoresFromStoredSlices(row, {
      skipScenarioTranscriptMutations: true,
      usePersistedGateContext: false,
    });
    if (recalc.kind !== 'success') continue;
    scorableN++;

    const gate = recalc.gate;
    const triple = gate.scenarioComposites ?? buildScenarioCompositesTriple({});
    const breaches =
      gate.failReasonDetail?.scenario_floor?.breaches ??
      scenarioFloorBreaches(triple);
    const category = classifyBreach(
      { s1: triple['1'], s2: triple['2'], s3: triple['3'] },
      breaches,
    );
    if (!category) continue;

    const storedReasons = gateReasonsArray(row.gate_fail_reasons);
    const recomputedReasons = gate.failReasonCodes ?? [];
    const inGate =
      storedReasons.includes('scenario_floor') ||
      recomputedReasons.includes('scenario_floor') ||
      (gate.failReason?.includes('scenario_floor:') ?? false);

    breachRows.push({
      userId: row.user_id,
      attemptId: row.id,
      composites: { s1: triple['1'], s2: triple['2'], s3: triple['3'] },
      breaches,
      category,
      inGateFailReasons: inGate,
      finalPass: gate.pass === true,
    });
  }

  const aa8Row =
    breachRows.find(
      (r) =>
        r.userId.toLowerCase().startsWith('aa8c081c') ||
        r.attemptId.toLowerCase().startsWith('824326a2'),
    ) ?? null;

  const report = renderReport(scorableN, breachRows, aa8Row);
  console.log(report);

  const outDir = join(process.cwd(), 'scripts', 'output');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'scenario-floor-consistency-audit.txt');
  writeFileSync(outPath, report, 'utf8');
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
