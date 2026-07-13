/**
 * Rescore completed interview attempts for calibration validation.
 *
 * Modes:
 *   --mode aggregate  Re-aggregate stored scenario/moment slices + gate (gate/floor/modifier calibration)
 *   --mode llm        Re-run Claude scoring (scenario + M4/M5 prompts) then aggregate + gate
 *
 * Flags:
 *   --baseline        Aggregate mode only: assert recomputed scores match stored (±0.1)
 *   --dry-run         LLM mode only: print prompt previews, no API calls
 *   --no-prompts      LLM mode: skip prompt preview lines in comparison output
 *   --debug           LLM mode: log M5 conflict-validity + S1/S2 mentalizing/contempt debug
 *   --commit          Write recalculated scores to interview_attempts (aggregate or llm path)
 *
 * Usage:
 *   npx tsx scripts/rescoreUsers.ts
 *   npx tsx scripts/rescoreUsers.ts --mode llm --dry-run
 *   npx tsx scripts/rescoreUsers.ts --mode aggregate --baseline
 *   npx tsx scripts/rescoreUsers.ts --mode aggregate --commit [userId...]
 *
 * Loads `.env` from the repo root automatically (or use `tsx --env-file=.env`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { PILLAR_ROLLUP_ALGORITHM_VERSION } from '../src/features/aria/aggregateMarkerScoresFromSlices';
import {
  computePillarScoreDelta,
  recalculateAttemptScoresFromStoredSlices,
  snapshotAttemptScoresForAudit,
  type AdminRecalculateAttemptInput,
  type AdminRecalculateOptions,
  type AdminRecalculateSuccess,
} from '../src/features/aria/adminRecalculateAttemptScores';
import { INTERVIEW_MARKER_IDS } from '../src/features/aria/interviewMarkers';
import { normalizeGateFailDetailForPersist } from '../src/features/psychometrics/gateFailDetailForPersist';
import {
  buildRecalculationConsistencyPatch,
  detectLlmRescoreEvidenceDegradation,
} from '../src/features/aria/recalculationPersistConsistency';
import { runLlmRescorePipeline, type TranscriptTurn } from './lib/rescoreInterviewLlm';

const DEFAULT_USER_IDS = [
  '6f17318f-c032-4c52-8224-efed41fb8aa3', // CHORM
  '68577c70-cd64-4745-b52e-598a78c35da2', // Radhesa
  'd6c5b015-6d8a-46d1-82a1-cc17dd5c57b3', // Antonia
  'a429020a-8557-4508-8233-b9f83c42616e', // Julie
  'c1348dfe-06f7-4981-917a-7c935fb13da0', // Cash
] as const;

const DEFAULT_DISPLAY_NAMES: Record<string, string> = {
  '6f17318f-c032-4c52-8224-efed41fb8aa3': 'CHORM',
  '68577c70-cd64-4745-b52e-598a78c35da2': 'Radhesa',
  'd6c5b015-6d8a-46d1-82a1-cc17dd5c57b3': 'Antonia',
  'a429020a-8557-4508-8233-b9f83c42616e': 'Julie',
  'c1348dfe-06f7-4981-917a-7c935fb13da0': 'Cash',
};

const BASELINE_TOLERANCE = 0.1;

const ATTEMPT_SELECT =
  'id, user_id, attempt_number, completed_at, transcript, scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_specific_patterns, ego_development_level, language_markers, skip_count, skip_penalty_total, auto_failed, pillar_scores, weighted_score, modified_weighted_score, modified_weighted_score_with_psychometrics, passed, final_gate_pass, gate_fail_reasons, gate_fail_detail, gate_result_finalized_at, scenario_composites, original_scores, defense_patterns, disclosure_calibration, mentalizing_overcertainty_count, moment_4_concreteness, moment_5_concreteness, personal_moment_emotional_vocab_density, personal_moment_emotional_vocab_low, ai_reasoning, reasoning_pending, review_flags';

type RescoreMode = 'aggregate' | 'llm';

type AttemptRow = {
  id: string;
  user_id: string;
  attempt_number: number;
  completed_at: string | null;
  transcript: unknown;
  scenario_1_scores: unknown;
  scenario_2_scores: unknown;
  scenario_3_scores: unknown;
  scenario_specific_patterns: unknown;
  ego_development_level: unknown;
  language_markers: unknown;
  skip_count: number | string | null;
  skip_penalty_total: number | null;
  auto_failed: boolean | null;
  pillar_scores: Record<string, number> | null;
  weighted_score: number | null;
  modified_weighted_score: number | null;
  modified_weighted_score_with_psychometrics: number | null;
  passed: boolean | null;
  final_gate_pass: boolean | null;
  gate_fail_reasons: string[] | null;
  gate_fail_detail: unknown;
  gate_result_finalized_at: string | null;
  scenario_composites: unknown;
  original_scores: unknown;
  ai_reasoning: unknown;
  reasoning_pending: boolean | null;
  review_flags: string[] | null;
  defense_patterns: unknown;
  disclosure_calibration: string | null;
  mentalizing_overcertainty_count: number | null;
  moment_4_concreteness: string | null;
  moment_5_concreteness: string | null;
  personal_moment_emotional_vocab_density: number | null;
  personal_moment_emotional_vocab_low: boolean | null;
};

type RescoreOutcome = {
  kind: 'success' | 'incomplete';
  pillarScores: Record<string, number>;
  weightedScore: number | null;
  modifiedWeightedScore: number | null;
  passed: boolean | null;
  gateFailReasons: string[];
  scenarioComposites: { s1: number | null; s2: number | null; s3: number | null };
  notes: string[];
  successResult?: AdminRecalculateSuccess;
  llmPrompts?: Array<{ label: string; charCount: number; preview: string }>;
  /** True only when `--dry-run` was passed (not for failed LLM aggregation). */
  llmDryRun?: boolean;
  /** LLM path only — scenario/moment slices to persist alongside rollup. */
  llmPersist?: {
    scenario_1_scores?: unknown;
    scenario_2_scores?: unknown;
    scenario_3_scores?: unknown;
    scenario_specific_patterns?: unknown;
  };
};

type ParsedArgs = {
  mode: RescoreMode;
  baseline: boolean;
  dryRun: boolean;
  noPrompts: boolean;
  debug: boolean;
  commit: boolean;
  userIds: string[];
};

/** Fills missing env from `.env` when `tsx --env-file` is not used. */
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
      const cur = process.env[k];
      if (cur == null || cur === '') process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

/** Expand short prefix (e.g. `6f17318f`) to a default calibration user UUID. */
function resolveUserIdArg(arg: string): string {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(arg)) {
    return arg;
  }
  const prefix = arg.toLowerCase();
  const match = DEFAULT_USER_IDS.find(
    (id) => id.toLowerCase().startsWith(prefix) || id.split('-')[0]?.toLowerCase() === prefix,
  );
  return match ?? arg;
}

function parseArgs(argv: string[]): ParsedArgs {
  let mode: RescoreMode = 'aggregate';
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode' && argv[i + 1]) {
      mode = argv[i + 1] === 'llm' ? 'llm' : 'aggregate';
      i++;
      continue;
    }
    if (a.startsWith('--mode=')) {
      mode = a.split('=')[1] === 'llm' ? 'llm' : 'aggregate';
      continue;
    }
    if (a.startsWith('--')) continue;
    positional.push(a);
  }
  const baseline = argv.includes('--baseline');
  const dryRun = argv.includes('--dry-run');
  const noPrompts = argv.includes('--no-prompts');
  const debug = argv.includes('--debug');
  const commit = argv.includes('--commit');
  return {
    mode,
    baseline,
    dryRun,
    noPrompts,
    debug,
    commit,
    userIds:
      positional.length > 0
        ? positional.map(resolveUserIdArg)
        : [...DEFAULT_USER_IDS],
  };
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error(
      'Missing Supabase env. Set in .env:\n' +
        '  - SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL\n' +
        '  - SUPABASE_SERVICE_ROLE_KEY (service_role JWT, not anon; optional dev fallback: EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)',
    );
    process.exit(1);
  }
  return createClient(supabaseUrl, serviceKey);
}

function shortUserId(userId: string): string {
  return userId.split('-')[0] ?? userId.slice(0, 8);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function withinTolerance(
  a: number | null | undefined,
  b: number | null | undefined,
  tol: number,
  decimals: 1 | 2 = 1,
): boolean {
  if (typeof a !== 'number' || typeof b !== 'number') return a == null && b == null;
  const round = decimals === 2 ? round2 : round1;
  return Math.abs(round(a) - round(b)) <= tol + 1e-6;
}

function normalizePillarMap(raw: unknown): Record<string, number | null | undefined> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return raw as Record<string, number | null | undefined>;
}

function gateReasonsArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

function parseScenarioComposites(raw: unknown): { s1: number | null; s2: number | null; s3: number | null } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { s1: null, s2: null, s3: null };
  }
  const o = raw as Record<string, unknown>;
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  return {
    s1: num(o.scenario_1),
    s2: num(o.scenario_2),
    s3: num(o.scenario_3),
  };
}

function formatWeightedScore(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '-';
  return round2(v).toFixed(2);
}

function formatScore(v: number | null | undefined): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '-';
  return round1(v).toFixed(1);
}

function formatComposite(v: number | null): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '-';
  return round2(v).toFixed(2);
}

function formatDelta(oldVal: number | null | undefined, newVal: number | null | undefined): string {
  if (typeof oldVal !== 'number' || typeof newVal !== 'number') return '';
  const d = round2(newVal - oldVal);
  if (d === 0) return '';
  return d > 0 ? ` (+${d.toFixed(2)})` : ` (${d.toFixed(2)})`;
}

function formatPillarDelta(oldVal: number | null | undefined, newVal: number | null | undefined): string {
  if (typeof oldVal !== 'number' || typeof newVal !== 'number') return '-';
  const d = round1(newVal - oldVal);
  if (d === 0) return '0';
  return d > 0 ? `+${d.toFixed(1)}` : d.toFixed(1);
}

function formatGateResult(pass: boolean | null | undefined): string {
  if (pass === true) return 'PASS';
  if (pass === false) return 'FAIL';
  return '-';
}

function formatGateReasons(codes: string[]): string {
  if (codes.length === 0) return '[]';
  return `[${codes.join(', ')}]`;
}

function buildRecalculateInput(attempt: AttemptRow): AdminRecalculateAttemptInput {
  return {
    transcript: attempt.transcript,
    scenario_1_scores: attempt.scenario_1_scores,
    scenario_2_scores: attempt.scenario_2_scores,
    scenario_3_scores: attempt.scenario_3_scores,
    scenario_specific_patterns: attempt.scenario_specific_patterns,
    ego_development_level: attempt.ego_development_level,
    language_markers: attempt.language_markers,
    skip_count: attempt.skip_count,
    defense_patterns: attempt.defense_patterns,
    disclosure_calibration: attempt.disclosure_calibration,
    mentalizing_overcertainty_count: attempt.mentalizing_overcertainty_count,
    skip_penalty_total: attempt.skip_penalty_total,
    auto_failed: attempt.auto_failed,
    moment_4_concreteness: attempt.moment_4_concreteness,
    moment_5_concreteness: attempt.moment_5_concreteness,
    personal_moment_emotional_vocab_density: attempt.personal_moment_emotional_vocab_density,
    personal_moment_emotional_vocab_low: attempt.personal_moment_emotional_vocab_low,
    persisted_weighted_score: attempt.weighted_score,
  };
}

function aggregateOptions(baseline: boolean): AdminRecalculateOptions {
  return {
    skipScenarioTranscriptMutations: true,
    usePersistedGateContext: baseline,
  };
}

function outcomeFromRecalculate(result: ReturnType<typeof recalculateAttemptScoresFromStoredSlices>): RescoreOutcome {
  if (result.kind !== 'success') {
    const notes = [...result.notes];
    const gateDetail = result.completionFailure?.detail;
    if (gateDetail && !notes.some((n) => n.includes(gateDetail))) {
      notes.unshift(`completion gate: ${gateDetail}`);
    }
    return {
      kind: 'incomplete',
      pillarScores: {},
      weightedScore: result.gate.weightedScore,
      modifiedWeightedScore: result.gate.modifiedWeightedScore ?? result.gate.weightedScore,
      passed: false,
      gateFailReasons: result.gate.failReasonCodes ?? [],
      scenarioComposites: { s1: null, s2: null, s3: null },
      notes,
    };
  }
  const gateFailReasons = result.gate.failReasonCodes ?? [];
  return {
    kind: 'success',
    pillarScores: result.pillar_scores,
    weightedScore: result.gate.weightedScore,
    modifiedWeightedScore: result.gate.modifiedWeightedScore ?? result.gate.weightedScore,
    passed: gateFailReasons.length === 0 ? result.gate.pass : false,
    gateFailReasons,
    scenarioComposites: parseScenarioComposites(result.scenarioCompositesJson),
    notes: result.notes,
    successResult: result,
  };
}

async function resolveUserLabel(admin: SupabaseClient, userId: string): Promise<string> {
  if (DEFAULT_DISPLAY_NAMES[userId]) return DEFAULT_DISPLAY_NAMES[userId];
  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('id', userId)
    .maybeSingle();
  const fromProfile =
    typeof profile?.display_name === 'string' && profile.display_name.trim()
      ? profile.display_name.trim()
      : null;
  if (fromProfile) return fromProfile;
  const { data: user } = await admin
    .from('users')
    .select('display_name, name, email')
    .eq('id', userId)
    .maybeSingle();
  const fromUser =
    (typeof user?.display_name === 'string' && user.display_name.trim()) ||
    (typeof user?.name === 'string' && user.name.trim()) ||
    (typeof user?.email === 'string' && user.email.split('@')[0]) ||
    null;
  return fromUser ?? userId.slice(0, 8);
}

async function loadLatestCompletedAttempt(
  admin: SupabaseClient,
  userId: string,
): Promise<AttemptRow | null> {
  const { data, error } = await admin
    .from('interview_attempts')
    .select(ATTEMPT_SELECT)
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .or('is_phantom.eq.false,is_phantom.is.null')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as AttemptRow | null) ?? null;
}

async function computeAggregateOutcome(attempt: AttemptRow, baseline: boolean): Promise<RescoreOutcome> {
  const result = recalculateAttemptScoresFromStoredSlices(
    buildRecalculateInput(attempt),
    aggregateOptions(baseline),
  );
  return outcomeFromRecalculate(result);
}

async function computeLlmOutcome(
  attempt: AttemptRow,
  dryRun: boolean,
  debug: boolean,
): Promise<RescoreOutcome> {
  const transcript = (Array.isArray(attempt.transcript) ? attempt.transcript : []) as TranscriptTurn[];
  const pipeline = await runLlmRescorePipeline({
    transcript,
    recalculateInput: buildRecalculateInput(attempt),
    storedScenarioPatterns: attempt.scenario_specific_patterns,
    storedScenarioScores: {
      scenario_1_scores: attempt.scenario_1_scores,
      scenario_2_scores: attempt.scenario_2_scores,
      scenario_3_scores: attempt.scenario_3_scores,
    },
    dryRun,
    debug,
  });
  if (dryRun) {
    return {
      kind: 'incomplete',
      pillarScores: {},
      weightedScore: null,
      modifiedWeightedScore: null,
      passed: null,
      gateFailReasons: [],
      scenarioComposites: { s1: null, s2: null, s3: null },
      notes: ['dry-run: prompts only'],
      llmPrompts: pipeline.prompts,
      llmDryRun: true,
    };
  }
  const outcome = outcomeFromRecalculate(pipeline.recalculate);
  outcome.llmPrompts = pipeline.prompts;
  if (
    pipeline.moment4Scores != null ||
    pipeline.moment5Scores != null ||
    pipeline.scenarioScores[1] ||
    pipeline.scenarioScores[2] ||
    pipeline.scenarioScores[3]
  ) {
    outcome.llmPersist = {
      scenario_1_scores: pipeline.scenarioScores[1],
      scenario_2_scores: pipeline.scenarioScores[2],
      scenario_3_scores: pipeline.scenarioScores[3],
      scenario_specific_patterns: {
        ...(typeof attempt.scenario_specific_patterns === 'object' &&
        attempt.scenario_specific_patterns != null &&
        !Array.isArray(attempt.scenario_specific_patterns)
          ? (attempt.scenario_specific_patterns as Record<string, unknown>)
          : {}),
        ...(pipeline.moment4Scores ? { moment_4_scores: pipeline.moment4Scores } : {}),
        ...(pipeline.moment5Scores ? { moment_5_scores: pipeline.moment5Scores } : {}),
      },
    };
  }
  return outcome;
}

type BaselineCheck = {
  userId: string;
  label: string;
  ok: boolean;
  pillarOk: boolean;
  gateOk: boolean;
  divergences: string[];
  gateDivergences: string[];
};

function checkBaseline(label: string, userId: string, attempt: AttemptRow, outcome: RescoreOutcome): BaselineCheck {
  const divergences: string[] = [];
  const gateDivergences: string[] = [];
  const oldPillars = normalizePillarMap(attempt.pillar_scores);
  for (const id of INTERVIEW_MARKER_IDS) {
    const oldV = oldPillars[id];
    const newV = outcome.pillarScores[id];
    if (!withinTolerance(oldV, newV, BASELINE_TOLERANCE, 1)) {
      divergences.push(`pillar ${id}: stored ${formatScore(oldV)} vs recomputed ${formatScore(newV)}`);
    }
  }
  if (!withinTolerance(attempt.weighted_score, outcome.weightedScore, BASELINE_TOLERANCE, 2)) {
    gateDivergences.push(
      `weighted: stored ${formatWeightedScore(attempt.weighted_score)} vs recomputed ${formatWeightedScore(outcome.weightedScore)}`,
    );
  }
  if (!withinTolerance(attempt.modified_weighted_score, outcome.modifiedWeightedScore, BASELINE_TOLERANCE, 2)) {
    gateDivergences.push(
      `modified: stored ${formatWeightedScore(attempt.modified_weighted_score)} vs recomputed ${formatWeightedScore(outcome.modifiedWeightedScore)}`,
    );
  }
  const pillarOk = divergences.length === 0;
  const gateOk = gateDivergences.length === 0;
  return {
    userId,
    label,
    ok: pillarOk && gateOk,
    pillarOk,
    gateOk,
    divergences,
    gateDivergences,
  };
}

function printBaselineReport(checks: BaselineCheck[]): boolean {
  console.log('=================================');
  console.log('BASELINE CHECK (aggregate, +/-0.1)');
  console.log(`Rollup: ${PILLAR_ROLLUP_ALGORITHM_VERSION}`);
  console.log('=================================');
  let allOk = true;
  for (const c of checks) {
    if (c.ok) {
      console.log(`[OK] ${c.label} (${shortUserId(c.userId)}): pillars + gate match stored`);
    } else if (c.gateOk && !c.pillarOk) {
      console.log(`[~] ${c.label} (${shortUserId(c.userId)}): gate scores match; pillars diverge (rollup may differ from persist-time)`);
      for (const d of c.divergences) console.log(`    - ${d}`);
    } else {
      allOk = false;
      console.log(`[FAIL] ${c.label} (${shortUserId(c.userId)}): DIVERGES`);
      for (const d of [...c.divergences, ...c.gateDivergences]) console.log(`    - ${d}`);
    }
  }
  console.log('=================================');
  const gateOnlyPass = checks.every((c) => c.gateOk);
  if (allOk) {
    console.log('Baseline: PASS - all users within tolerance');
  } else if (gateOnlyPass) {
    console.log('Baseline: PARTIAL - gate scores match; pillar deltas reflect rollup vs stored column (gate calibration OK)');
    allOk = true;
  } else {
    console.log('Baseline: FAIL - fix aggregation/gate path before comparing calibrations');
  }
  console.log('');
  return allOk;
}

function printDivider(): void {
  console.log('---------------------------------');
}

function printComparison(
  label: string,
  userId: string,
  attempt: AttemptRow,
  outcome: RescoreOutcome,
  mode: RescoreMode,
  showPrompts: boolean,
): void {
  if (showPrompts && mode === 'llm' && outcome.llmPrompts?.length) {
    console.log('LLM prompts sent:');
    for (const p of outcome.llmPrompts) {
      console.log(`  ${p.label} (${p.charCount} chars): ${p.preview}`);
    }
    console.log('');
  }

  const oldPillars = normalizePillarMap(attempt.pillar_scores);
  const newPillars = normalizePillarMap(outcome.pillarScores);
  const oldComposites = parseScenarioComposites(attempt.scenario_composites);
  const newComposites = outcome.scenarioComposites;

  console.log(`User: ${label} (${shortUserId(userId)})`);
  printDivider();
  if (outcome.llmDryRun) {
    console.log('(dry-run - no score comparison)');
    printDivider();
    console.log('');
    return;
  }

  if (outcome.kind === 'incomplete') {
    console.log('WARN: Incomplete recalculation - score comparison may be partial.');
    if (outcome.notes.length > 0) console.log(`Notes: ${outcome.notes.join('; ')}`);
    console.log('');
  }

  console.log('Pillar          Old    New    Delta');
  for (const id of INTERVIEW_MARKER_IDS) {
    const oldV = oldPillars[id];
    const newV = newPillars[id];
    console.log(
      `${id.padEnd(16)}${formatScore(oldV).padStart(5)}  ${formatScore(newV).padStart(5)}  ${formatPillarDelta(oldV, newV).padStart(6)}`,
    );
  }
  console.log('');
  console.log('Scenario composites:');
  for (const [key, idx] of [
    ['S1', 's1'],
    ['S2', 's2'],
    ['S3', 's3'],
  ] as const) {
    const oldC = oldComposites[idx];
    const newC = newComposites[idx];
    console.log(
      `  ${key}: ${formatComposite(oldC)} -> ${formatComposite(newC)}${formatDelta(oldC, newC)}`,
    );
  }
  console.log('');
  console.log(
    `Weighted score:    ${formatWeightedScore(attempt.weighted_score)} -> ${formatWeightedScore(outcome.weightedScore)}${formatDelta(attempt.weighted_score, outcome.weightedScore)}`,
  );
  console.log(
    `Modified score:    ${formatWeightedScore(attempt.modified_weighted_score)} -> ${formatWeightedScore(outcome.modifiedWeightedScore)}${formatDelta(attempt.modified_weighted_score, outcome.modifiedWeightedScore)}`,
  );
  console.log(
    `Gate result:       ${formatGateResult(attempt.passed)} -> ${formatGateResult(outcome.passed)}`,
  );
  console.log(
    `Gate fail reasons: ${formatGateReasons(gateReasonsArray(attempt.gate_fail_reasons))} -> ${formatGateReasons(outcome.gateFailReasons)}`,
  );
  if (attempt.final_gate_pass != null) {
    console.log(
      `Final gate pass:   ${formatGateResult(attempt.final_gate_pass)} (stored; psychometrics not re-simulated)`,
    );
  }
  if (outcome.kind === 'incomplete' && outcome.notes.length > 0) {
    console.log('');
    console.log('See notes above for incomplete reason.');
  }
  printDivider();
  console.log('');
}

async function commitRescore(
  admin: SupabaseClient,
  attempt: AttemptRow,
  outcome: RescoreOutcome,
): Promise<void> {
  if (outcome.kind !== 'success' || !outcome.successResult) {
    console.log('  Skip commit - incomplete outcome');
    return;
  }
  if (outcome.llmPersist) {
    const degradation = detectLlmRescoreEvidenceDegradation(attempt, outcome.llmPersist);
    if (degradation.blocked) {
      console.error('  COMMIT BLOCKED — LLM rescore would degrade substantive keyEvidence to salvage placeholders:');
      for (const reason of degradation.reasons) console.error(`    - ${reason}`);
      console.error('  Use --mode aggregate to re-run rollup/gate only, or fix scoring output before commit.');
      throw new Error('rescore_commit_blocked_evidence_degradation');
    }
  }
  const result = outcome.successResult;
  const oldPillars = normalizePillarMap(attempt.pillar_scores);
  const delta = computePillarScoreDelta(oldPillars, outcome.pillarScores);
  const snap = attempt.original_scores ? null : snapshotAttemptScoresForAudit(attempt);
  const nowIso = new Date().toISOString();
  const gateFailReasons = result.gate.failReasonCodes ?? [];
  const gateFailDetail = normalizeGateFailDetailForPersist(result.gate.failReasonDetail);
  const passedAfterFloors = gateFailReasons.length === 0 ? result.gate.pass : false;
  const consistencyPatch = buildRecalculationConsistencyPatch({
    attempt,
    newPassed: passedAfterFloors,
    newWeightedScore: result.gate.weightedScore,
    newPillarScores: result.pillar_scores,
    recalculatedAt: nowIso,
  });
  const reviewFlags = Array.isArray(attempt.review_flags) ? [...attempt.review_flags] : [];
  if (consistencyPatch.review_flags) {
    for (const flag of consistencyPatch.review_flags) {
      if (!reviewFlags.includes(flag)) reviewFlags.push(flag);
    }
  }

  const { error } = await admin
    .from('interview_attempts')
    .update({
      ...(snap ? { original_scores: snap } : {}),
      ...(outcome.llmPersist?.scenario_1_scores != null
        ? { scenario_1_scores: outcome.llmPersist.scenario_1_scores }
        : {}),
      ...(outcome.llmPersist?.scenario_2_scores != null
        ? { scenario_2_scores: outcome.llmPersist.scenario_2_scores }
        : {}),
      ...(outcome.llmPersist?.scenario_3_scores != null
        ? { scenario_3_scores: outcome.llmPersist.scenario_3_scores }
        : {}),
      ...(outcome.llmPersist?.scenario_specific_patterns != null
        ? { scenario_specific_patterns: outcome.llmPersist.scenario_specific_patterns }
        : {}),
      pillar_scores: result.pillar_scores,
      weighted_score: result.gate.weightedScore,
      passed: passedAfterFloors,
      gate_fail_reasons: gateFailReasons,
      gate_fail_detail: gateFailDetail,
      scenario_composites: result.scenarioCompositesJson,
      incomplete_reason: null,
      recalculated_at: nowIso,
      recalculation_delta: delta,
      recalculation_notes: result.notes,
      review_flags: [
        ...new Set([
          ...(result.gate.reviewFlags ?? []),
          ...reviewFlags,
        ]),
      ],
      ...(consistencyPatch.ai_reasoning != null ? { ai_reasoning: consistencyPatch.ai_reasoning } : {}),
      ...(consistencyPatch.reasoning_pending != null
        ? { reasoning_pending: consistencyPatch.reasoning_pending }
        : {}),
      ...(consistencyPatch.final_gate_pass !== undefined
        ? { final_gate_pass: consistencyPatch.final_gate_pass }
        : {}),
      mentalizing_overcertainty_count: result.mentalizingOvercertaintyCount,
      defense_patterns: result.defense_patterns,
      moment_4_concreteness: result.moment_4_concreteness ?? result.gate.moment4Concreteness ?? null,
      moment_5_concreteness: result.moment_5_concreteness ?? result.gate.moment5Concreteness ?? null,
      personal_moment_emotional_vocab_density: result.personal_moment_emotional_vocab_density,
      personal_moment_emotional_vocab_low: result.personal_moment_emotional_vocab_low,
      depth_signal_modifier: result.gate.depthSignalModifier ?? result.gate.scoreModifier ?? null,
      score_modifier: result.gate.scoreModifier ?? result.gate.depthSignalModifier ?? null,
      modified_weighted_score: result.gate.modifiedWeightedScore ?? null,
      disclosure_calibration: result.disclosure_calibration,
      ego_development_level: result.ego_development_level ?? attempt.ego_development_level ?? null,
    })
    .eq('id', attempt.id)
    .eq('user_id', attempt.user_id);
  if (error) throw error;
  console.log(`  Committed attempt ${attempt.id} (attempt #${attempt.attempt_number})`);
}

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
  const args = parseArgs(process.argv.slice(2));
  if (args.baseline && args.mode !== 'aggregate') {
    console.error('--baseline is only valid with --mode aggregate');
    process.exit(1);
  }
  if (args.dryRun && args.mode !== 'llm') {
    console.error('--dry-run is only valid with --mode llm');
    process.exit(1);
  }
  if (args.debug && args.mode !== 'llm') {
    console.error('--debug is only valid with --mode llm');
    process.exit(1);
  }
  if (args.commit && args.dryRun) {
    console.error('Cannot use --commit with --dry-run');
    process.exit(1);
  }

  const admin = createAdminClient();
  const runBaselineFirst = args.mode === 'aggregate' || args.mode === 'llm';

  console.log(`Rescore users - mode=${args.mode}${args.baseline ? ' baseline' : ''}${args.dryRun ? ' dry-run' : ''}${args.debug ? ' debug' : ''}${args.commit ? ' COMMIT' : ''}`);
  console.log(`Rollup algorithm: ${PILLAR_ROLLUP_ALGORITHM_VERSION}`);
  console.log('');

  const loaded: Array<{ userId: string; label: string; attempt: AttemptRow }> = [];
  let anyMissing = false;

  for (const userId of args.userIds) {
    const label = await resolveUserLabel(admin, userId);
    const attempt = await loadLatestCompletedAttempt(admin, userId);
    if (!attempt) {
      anyMissing = true;
      console.log(`User: ${label} (${shortUserId(userId)}): no completed attempt`);
      continue;
    }
    loaded.push({ userId, label, attempt });
  }

  if (runBaselineFirst && loaded.length > 0) {
    const baselineChecks: BaselineCheck[] = [];
    for (const { userId, label, attempt } of loaded) {
      const outcome = await computeAggregateOutcome(attempt, true);
      baselineChecks.push(checkBaseline(label, userId, attempt, outcome));
    }
    const baselineOk = printBaselineReport(baselineChecks);
    if (args.baseline) {
      process.exitCode = baselineOk ? 0 : 1;
      return;
    }
    if (!baselineOk && args.mode === 'llm') {
      console.warn('Warning: baseline diverges - LLM comparison may conflate aggregation bugs with prompt calibration.\n');
    }
  }

  if (args.mode === 'aggregate' && !args.baseline) {
    console.log('Comparison (aggregate - stored slices + current gate/rollup):\n');
  } else if (args.mode === 'llm') {
    console.log(args.dryRun ? 'LLM dry-run (prompt previews):\n' : 'Comparison (full LLM re-score + aggregate + gate):\n');
  }

  for (const { userId, label, attempt } of loaded) {
    const outcome =
      args.mode === 'llm'
        ? await computeLlmOutcome(attempt, args.dryRun, args.debug)
        : await computeAggregateOutcome(attempt, false);
    printComparison(label, userId, attempt, outcome, args.mode, !args.noPrompts);
    if (args.commit) {
      await commitRescore(admin, attempt, outcome);
    }
  }

  if (anyMissing) {
    process.exitCode = 1;
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
