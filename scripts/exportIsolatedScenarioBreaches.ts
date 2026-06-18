/**
 * Export isolated S2 scenario-floor breach attempts for manual review.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/exportIsolatedScenarioBreaches.ts
 *   npx tsx --env-file=.env scripts/exportIsolatedScenarioBreaches.ts --export
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  buildScenarioCompositesTriple,
  scenarioFloorBreaches,
} from '../src/features/aria/scenarioCompositeFloor';
import { messagesForScenarioNumber } from '../src/features/aria/scenarioBTranscriptGates';
import {
  recalculateAttemptScoresFromStoredSlices,
  type AdminRecalculateAttemptInput,
} from '../src/features/aria/adminRecalculateAttemptScores';

/** Lowest S2 composite among isolated-collapse (other two ≥ 6.0) — severity order. */
const TARGET_USER_PREFIXES = [
  '086fc5a1',
  '4fd31c7c',
  '420f6d9a',
  'a246372c',
  '86eb10f4',
] as const;

const S2_PILLAR_ORDER = [
  'repair',
  'attunement',
  'mentalizing',
  'appreciation',
  'accountability',
  'contempt_expression',
] as const;

const COMPARE_PILLARS = ['mentalizing', 'accountability', 'contempt_expression'] as const;

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
  reasoning_pending
`;

type TranscriptMsg = {
  role: string;
  content: string;
  scenarioNumber?: number;
};

type ScenarioSlice = {
  pillarScores?: Record<string, number | null>;
  keyEvidence?: Record<string, string>;
};

type ReviewRow = {
  userId: string;
  attemptId: string;
  completedAt: string;
  s2Composite: number;
  s1Composite: number | null;
  s3Composite: number | null;
  s2Turns: Array<{ role: 'ARIA' | 'USER'; content: string }>;
  s2: ScenarioSlice;
  s1: ScenarioSlice;
  s3: ScenarioSlice;
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

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase env');
    process.exit(1);
  }
  return createClient(supabaseUrl, serviceKey);
}

function parseTranscript(raw: unknown): TranscriptMsg[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Record<string, unknown> => m != null && typeof m === 'object')
    .map((m) => ({
      role: String(m.role ?? ''),
      content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
      scenarioNumber:
        typeof m.scenarioNumber === 'number' && Number.isFinite(m.scenarioNumber)
          ? m.scenarioNumber
          : undefined,
    }));
}

function parseScenarioSlice(raw: unknown): ScenarioSlice {
  if (raw == null) return {};
  const obj =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw) as Record<string, unknown>;
          } catch {
            return null;
          }
        })()
      : typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : null;
  if (!obj) return {};
  const pillarRaw = obj.pillarScores ?? obj.pillar_scores;
  const keyRaw = obj.keyEvidence ?? obj.key_evidence;
  const pillarScores =
    typeof pillarRaw === 'object' && pillarRaw != null && !Array.isArray(pillarRaw)
      ? (pillarRaw as Record<string, number | null>)
      : undefined;
  const keyEvidence =
    typeof keyRaw === 'object' && keyRaw != null && !Array.isArray(keyRaw)
      ? (keyRaw as Record<string, string>)
      : undefined;
  return { pillarScores, keyEvidence };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function formatScore(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '—' : String(v);
}

function extractS2Turns(transcript: TranscriptMsg[]): ReviewRow['s2Turns'] {
  const msgs = messagesForScenarioNumber(transcript, 2);
  const turns: ReviewRow['s2Turns'] = [];
  for (const m of msgs) {
    if (m.role !== 'assistant' && m.role !== 'user') continue;
    turns.push({
      role: m.role === 'user' ? 'USER' : 'ARIA',
      content: (m.content ?? '').trim(),
    });
  }
  return turns;
}

function renderPillarBlock(
  slice: ScenarioSlice,
  pillars: readonly string[],
): string[] {
  const lines: string[] = [];
  const ps = slice.pillarScores ?? {};
  const ke = slice.keyEvidence ?? {};
  for (const p of pillars) {
    const score = ps[p] ?? ps[p === 'contempt_expression' ? 'contempt' : p];
    const evidence = ke[p] ?? ke[p === 'contempt_expression' ? 'contempt' : p] ?? '(none)';
    lines.push(`${p}=${formatScore(score as number | null)} | evidence: "${evidence.trim()}"`);
  }
  return lines;
}

function renderBriefCompare(label: string, slice: ScenarioSlice): string {
  const ps = slice.pillarScores ?? {};
  const parts = COMPARE_PILLARS.map((p) => {
    const v = ps[p] ?? (p === 'contempt_expression' ? ps.contempt : undefined);
    return `${p}=${formatScore(v as number | null)}`;
  });
  return `${label}: ${parts.join(', ')}`;
}

function renderReviewBlock(row: ReviewRow): string[] {
  const lines = [
    `ISOLATED SCENARIO BREACH REVIEW — ${row.userId.slice(0, 8)}`,
    '==============================================',
    `Attempt: ${row.attemptId} | completed: ${formatDate(row.completedAt)}`,
    `Breaching scenario: S2 | Composite: ${row.s2Composite.toFixed(2)}`,
    `Other scenarios: S1=${row.s1Composite?.toFixed(2) ?? '—'}, S3=${row.s3Composite?.toFixed(2) ?? '—'}`,
    '',
    '--- Full S2 question sequence and responses ---',
  ];

  for (const t of row.s2Turns) {
    lines.push(`[${t.role}] ${t.content || '(empty)'}`);
    lines.push('');
  }

  lines.push('--- S2 per-pillar scores and evidence ---');
  lines.push(...renderPillarBlock(row.s2, S2_PILLAR_ORDER));
  lines.push('');
  lines.push('--- For comparison: S1 and S3 per-pillar scores (brief) ---');
  lines.push(renderBriefCompare('S1', row.s1));
  lines.push(renderBriefCompare('S3', row.s3));
  lines.push('');
  return lines;
}

function renderReport(rows: ReviewRow[]): string {
  const header = [
    'ISOLATED S2 SCENARIO-FLOOR BREACH EXPORT',
    '========================================',
    `Targets: ${TARGET_USER_PREFIXES.join(', ')} (single-scenario S2 floor breach, severity order)`,
    `Exported: ${rows.length} of ${TARGET_USER_PREFIXES.length}`,
    '',
  ];
  const body: string[] = [];
  for (const row of rows) body.push(...renderReviewBlock(row));
  return [...header, ...body].join('\n');
}

async function fetchAttempts(supabase: SupabaseClient): Promise<
  Array<AdminRecalculateAttemptInput & { id: string; user_id: string; completed_at: string }>
> {
  const { data, error } = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_SELECT)
    .not('completed_at', 'is', null)
    .or('is_phantom.eq.false,is_phantom.is.null');
  if (error) throw error;
  return (data ?? []) as Array<
    AdminRecalculateAttemptInput & { id: string; user_id: string; completed_at: string }
  >;
}

function matchesTarget(userId: string): boolean {
  const lower = userId.toLowerCase();
  return TARGET_USER_PREFIXES.some((p) => lower.startsWith(p));
}

function buildRow(
  row: AdminRecalculateAttemptInput & { id: string; user_id: string; completed_at: string },
): ReviewRow | null {
  const recalc = recalculateAttemptScoresFromStoredSlices(row, {
    skipScenarioTranscriptMutations: true,
    usePersistedGateContext: false,
  });
  if (recalc.kind !== 'success') return null;

  const triple = recalc.gate.scenarioComposites ?? buildScenarioCompositesTriple({});
  const breaches = scenarioFloorBreaches(triple);
  const s2Breach = breaches.find((b) => b.scenario === 2);
  if (!s2Breach) return null;

  return {
    userId: row.user_id,
    attemptId: row.id,
    completedAt: row.completed_at,
    s2Composite: s2Breach.composite,
    s1Composite: triple['1'],
    s3Composite: triple['3'],
    s2Turns: extractS2Turns(parseTranscript(row.transcript)),
    s2: parseScenarioSlice(row.scenario_2_scores),
    s1: parseScenarioSlice(row.scenario_1_scores),
    s3: parseScenarioSlice(row.scenario_3_scores),
  };
}

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
  const exportMd = process.argv.includes('--export');
  const supabase = createAdminClient();
  const attempts = await fetchAttempts(supabase);

  const rows: ReviewRow[] = [];
  for (const row of attempts) {
    if (!matchesTarget(row.user_id)) continue;
    const built = buildRow(row);
    if (built) rows.push(built);
  }

  rows.sort((a, b) => a.s2Composite - b.s2Composite);

  const missing = TARGET_USER_PREFIXES.filter(
    (p) => !rows.some((r) => r.userId.toLowerCase().startsWith(p)),
  );

  const report = renderReport(rows);
  const warning =
    missing.length > 0
      ? `WARNING: missing or no S2 scenario_floor breach: ${missing.join(', ')}\n\n`
      : '';

  if (exportMd) {
    const outDir = join(process.cwd(), 'scripts', 'output');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'isolated-s2-breaches.md');
    writeFileSync(outPath, warning + report, 'utf8');
    console.log(`Wrote ${rows.length} isolated S2 breach review(s) to ${outPath}`);
    if (missing.length) console.log(`Missing: ${missing.join(', ')}`);
  } else {
    if (warning) console.log(warning);
    console.log(report);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
