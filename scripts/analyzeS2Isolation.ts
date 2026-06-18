/**
 * Scenario 2 isolation analysis — classifies low-S2 patterns vs correlated weakness.
 *
 * Recomputes scenario composites via the current aggregate algorithm (same as analyzeAttempts).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/analyzeS2Isolation.ts
 *   npx tsx --env-file=.env scripts/analyzeS2Isolation.ts --json
 *   npx tsx --env-file=.env scripts/analyzeS2Isolation.ts --stored
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ANALYTICS_RECOMPUTE_ALGORITHM,
  recomputeAttemptForAnalytics,
  type AnalyticsAttempt,
  type RawAttemptForAnalytics,
} from './recomputeAttemptForAnalytics';

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
  probe_log
`;

const USER_PSYCH_SELECT = `
  id,
  psychometrics_brs_score,
  psychometrics_brs_responses,
  psychometrics_anxiety_trait_score,
  psychometrics_anxiety_trait_responses,
  psychometrics_scs_sf_score,
  psychometrics_scs_sf_responses,
  psychometrics_gasp_score,
  psychometrics_gasp_responses,
  psychometrics_dweck_score,
  psychometrics_dweck_responses,
  psychometrics_aaq2_score,
  psychometrics_rses_score,
  psychometrics_aaq2_responses,
  psychometrics_rses_responses,
  psychometrics_scs_public_score,
  psychometrics_scs_private_score,
  psychometrics_sd3_narcissism_score,
  psychometrics_sd3_narcissism_responses,
  psychometrics_npi_entitlement_score,
  psychometrics_narq_s_score,
  psychometrics_narq_s_responses,
  psychometrics_rfq_score,
  psychometrics_rfq_responses,
  psychometrics_completed_at
`;

type S2Category =
  | 'isolatedS2Failure'
  | 'correlatedFailure'
  | 's2StrongOthersWeak'
  | 'neither';

type ScenarioTriple = { s1: number; s2: number; s3: number };

type ClassifiedAttempt = {
  id: string;
  shortId: string;
  composites: ScenarioTriple;
  category: S2Category;
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
      const cur = process.env[k];
      if (cur == null || cur === '') process.env[k] = v;
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
    console.error(
      'Missing Supabase env. Set SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.',
    );
    process.exit(1);
  }
  return createClient(supabaseUrl, serviceKey);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function pct(count: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((count / total) * 100).toFixed(1)}%`;
}

function scenarioComposite(
  composites: Record<string, number> | null,
  key: '1' | '2' | '3',
): number | null {
  if (!composites || typeof composites !== 'object') return null;
  const v = composites[key] ?? composites[`scenario_${key}`];
  return finiteNumber(v);
}

function parseScenarioTriple(attempt: AnalyticsAttempt): ScenarioTriple | null {
  const s1 = scenarioComposite(attempt.scenario_composites, '1');
  const s2 = scenarioComposite(attempt.scenario_composites, '2');
  const s3 = scenarioComposite(attempt.scenario_composites, '3');
  if (s1 == null || s2 == null || s3 == null) return null;
  return { s1, s2, s3 };
}

function classifyScenarioPattern(triple: ScenarioTriple): S2Category {
  const { s1, s2, s3 } = triple;
  if (s2 < 5.0 && s1 >= 6.5 && s3 >= 6.5) return 'isolatedS2Failure';
  if (s2 < 5.0 && (s1 < 6.5 || s3 < 6.5)) return 'correlatedFailure';
  if (s2 >= 6.5 && (s1 < 5.0 || s3 < 5.0)) return 's2StrongOthersWeak';
  return 'neither';
}

function formatCompositeLine(entry: ClassifiedAttempt): string {
  const { s1, s2, s3 } = entry.composites;
  return `${entry.shortId}  S1=${s1.toFixed(2)} S2=${s2.toFixed(2)} S3=${s3.toFixed(2)}`;
}

async function fetchCompletedAttempts(supabase: SupabaseClient): Promise<RawAttemptForAnalytics[]> {
  const pageSize = 1000;
  const all: RawAttemptForAnalytics[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('interview_attempts')
      .select(ATTEMPT_SELECT)
      .not('completed_at', 'is', null)
      .or('is_phantom.eq.false,is_phantom.is.null')
      .order('completed_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const batch = (data ?? []) as RawAttemptForAnalytics[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function fetchUsersByIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  const unique = [...new Set(userIds)];
  const chunkSize = 100;

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase.from('users').select(USER_PSYCH_SELECT).in('id', chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      map.set(String((row as { id: string }).id), row as Record<string, unknown>);
    }
  }

  return map;
}

function buildS2IsolationReport(classified: ClassifiedAttempt[]) {
  const total = classified.length;
  const byCategory = {
    isolatedS2Failure: [] as ClassifiedAttempt[],
    correlatedFailure: [] as ClassifiedAttempt[],
    s2StrongOthersWeak: [] as ClassifiedAttempt[],
    neither: [] as ClassifiedAttempt[],
  };

  for (const entry of classified) {
    byCategory[entry.category].push(entry);
  }

  return { total, byCategory };
}

function printS2IsolationReport(report: ReturnType<typeof buildS2IsolationReport>): void {
  const { total, byCategory } = report;

  console.log('S2 ISOLATION ANALYSIS');
  console.log('======================');
  console.log(`Total attempts analyzed: ${total}`);
  console.log('');

  const sections: Array<{ key: S2Category; title: string }> = [
    {
      key: 'isolatedS2Failure',
      title: 'Isolated S2 failure (S1 & S3 strong, S2 alone drags down)',
    },
    {
      key: 'correlatedFailure',
      title: 'Correlated failure (S2 weak alongside S1 or S3)',
    },
    {
      key: 's2StrongOthersWeak',
      title: 'S2 strong, others weak (inverse pattern — sanity check)',
    },
    { key: 'neither', title: 'Neither pattern' },
  ];

  for (const section of sections) {
    const items = byCategory[section.key];
    console.log(`${section.title}: ${items.length} (${pct(items.length, total)})`);
    if (items.length === 0) {
      console.log('  Attempts: (none)');
    } else {
      console.log('  Attempts:');
      for (const entry of items) {
        console.log(`    ${formatCompositeLine(entry)}`);
      }
    }
    console.log('');
  }

  console.log('INTERPRETATION GUIDE');
  console.log('=====================');
  console.log(
    'If isolated S2 failure rate is high relative to correlated failure rate,',
  );
  console.log(
    'S2 may be testing a narrower or harder construct than S1/S3 and may be',
  );
  console.log('worth softening calibration on.');
  console.log(
    'If correlated failure dominates, low S2 scores are tracking genuine',
  );
  console.log('broader relational weakness rather than an isolated scenario-specific trap.');
}

async function main(): Promise<void> {
  const started = Date.now();
  mergeEnvFromDotenvFile();
  const writeJson = process.argv.includes('--json');

  const supabase = createAdminClient();
  console.log('Loading completed interview attempts…');
  const rawAttempts = await fetchCompletedAttempts(supabase);
  console.log(
    `Recomputing scores for ${rawAttempts.length} attempts (${ANALYTICS_RECOMPUTE_ALGORITHM})…`,
  );

  const usersById = await fetchUsersByIds(
    supabase,
    rawAttempts.map((a) => a.user_id),
  );

  const recomputed = rawAttempts.map((row) =>
    recomputeAttemptForAnalytics(row, usersById.get(row.user_id) ?? null),
  );

  const classified: ClassifiedAttempt[] = [];
  let skippedNoComposites = 0;

  for (const attempt of recomputed) {
    const triple = parseScenarioTriple(attempt);
    if (!triple) {
      skippedNoComposites++;
      continue;
    }
    classified.push({
      id: attempt.id,
      shortId: attempt.id.slice(0, 8),
      composites: triple,
      category: classifyScenarioPattern(triple),
    });
  }

  console.log(
    `Analyzed ${classified.length} attempts with scenario composites (${skippedNoComposites} skipped — missing composites after recompute).`,
  );
  console.log('');

  const report = buildS2IsolationReport(classified);
  printS2IsolationReport(report);

  const finished = new Date().toISOString();
  const runtimeSec = ((Date.now() - started) / 1000).toFixed(1);
  console.log('');
  console.log(`Report generated at ${finished}`);
  console.log(`Total runtime: ${runtimeSec}s`);

  if (writeJson) {
    const outDir = join(process.cwd(), 'scripts', 'output');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 's2-isolation-analysis.json');
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          generatedAt: finished,
          runtimeSec,
          algorithm: ANALYTICS_RECOMPUTE_ALGORITHM,
          skippedNoComposites,
          report,
        },
        null,
        2,
      ),
    );
    console.log(`JSON written to ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
