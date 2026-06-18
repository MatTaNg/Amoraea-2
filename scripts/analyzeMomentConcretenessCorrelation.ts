/**
 * Moment 4 / Moment 5 concreteness correlation with pillar scores.
 *
 * Recomputes scores via the current aggregate algorithm (same as analyzeAttempts).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/analyzeMomentConcretenessCorrelation.ts
 *   npx tsx --env-file=.env scripts/analyzeMomentConcretenessCorrelation.ts --json
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

const PILLAR_METRICS = [
  'mentalizing',
  'accountability',
  'repair',
  'regulation',
  'attunement',
  'appreciation',
  'contempt',
  'commitment_threshold',
] as const;

type PillarMetric = (typeof PILLAR_METRICS)[number];
type MetricKey = PillarMetric | 'weighted_score';

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

type GroupMeans = Record<MetricKey, number | null> & { count: number };

type MomentCorrelationReport = {
  momentLabel: 'M4' | 'M5';
  totalAnalyzed: number;
  lowAbsent: GroupMeans;
  moderateHigh: GroupMeans;
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}

function padRight(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function padLeft(text: string, width: number): string {
  return text.length >= width ? text : ' '.repeat(width - text.length) + text;
}

function normalizeConcreteness(value: string | null): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  if (key === 'absent' || key === 'low' || key === 'moderate' || key === 'high') return key;
  return null;
}

function isLowAbsent(level: string): boolean {
  return level === 'absent' || level === 'low';
}

function isModerateHigh(level: string): boolean {
  return level === 'moderate' || level === 'high';
}

function concretenessForMoment(attempt: AnalyticsAttempt, moment: 'M4' | 'M5'): string | null {
  const raw = moment === 'M4' ? attempt.moment_4_concreteness : attempt.moment_5_concreteness;
  return normalizeConcreteness(raw);
}

function hasPillarScores(attempt: AnalyticsAttempt): boolean {
  const pillars = attempt.pillar_scores;
  if (!pillars || typeof pillars !== 'object') return false;
  return PILLAR_METRICS.some((p) => finiteNumber(pillars[p]) != null);
}

function metricValues(attempts: AnalyticsAttempt[], metric: MetricKey): number[] {
  const out: number[] = [];
  for (const attempt of attempts) {
    if (metric === 'weighted_score') {
      const v = finiteNumber(attempt.weighted_score);
      if (v != null) out.push(v);
      continue;
    }
    const v = finiteNumber(attempt.pillar_scores?.[metric]);
    if (v != null) out.push(v);
  }
  return out;
}

function computeGroupMeans(attempts: AnalyticsAttempt[]): GroupMeans {
  const metrics: MetricKey[] = [...PILLAR_METRICS, 'weighted_score'];
  const result = { count: attempts.length } as GroupMeans;
  for (const metric of metrics) {
    result[metric] = mean(metricValues(attempts, metric));
  }
  return result;
}

function buildMomentReport(
  attempts: AnalyticsAttempt[],
  moment: 'M4' | 'M5',
): MomentCorrelationReport | null {
  const eligible = attempts.filter((a) => {
    if (a.recomputeStatus !== 'success') return false;
    if (!hasPillarScores(a)) return false;
    return concretenessForMoment(a, moment) != null;
  });

  const lowAbsentAttempts = eligible.filter((a) => {
    const level = concretenessForMoment(a, moment)!;
    return isLowAbsent(level);
  });
  const moderateHighAttempts = eligible.filter((a) => {
    const level = concretenessForMoment(a, moment)!;
    return isModerateHigh(level);
  });

  if (eligible.length === 0) return null;

  return {
    momentLabel: moment,
    totalAnalyzed: eligible.length,
    lowAbsent: computeGroupMeans(lowAbsentAttempts),
    moderateHigh: computeGroupMeans(moderateHighAttempts),
  };
}

function formatCell(value: number | null): string {
  return value != null ? value.toFixed(2) : '—';
}

function formatDelta(low: number | null, high: number | null): string {
  if (low == null || high == null) return '—';
  const d = round2(high - low);
  return d >= 0 ? `+${d.toFixed(2)}` : d.toFixed(2);
}

function printMomentReport(report: MomentCorrelationReport): void {
  const title =
    report.momentLabel === 'M4'
      ? 'M4 CONCRETENESS CORRELATION WITH OTHER PILLARS'
      : 'M5 CONCRETENESS CORRELATION WITH OTHER PILLARS';

  console.log(title);
  console.log('='.repeat(title.length));
  console.log(
    `${padRight('', 24)}${padLeft('M4 Low/Absent', 18)}${padLeft('M4 Moderate/High', 20)}${padLeft('Delta', 10)}`.replace(
      /M4/g,
      report.momentLabel,
    ),
  );

  const metrics: MetricKey[] = [...PILLAR_METRICS, 'weighted_score'];
  for (const metric of metrics) {
    const low = report.lowAbsent[metric];
    const high = report.moderateHigh[metric];
    console.log(
      `${padRight(metric, 24)}${padLeft(formatCell(low), 18)}${padLeft(formatCell(high), 20)}${padLeft(formatDelta(low, high), 10)}`,
    );
  }

  console.log('');
  console.log(
    `  (${report.lowAbsent.count} low/absent, ${report.moderateHigh.count} moderate/high of ${report.totalAnalyzed} attempts with ${report.momentLabel} concreteness + pillar scores)`,
  );
  console.log('');
}

function printInterpretationGuide(): void {
  console.log('INTERPRETATION GUIDE');
  console.log('=====================');
  console.log('If deltas are large and consistent across all pillars (everything drops');
  console.log('together when M4 is low), this could mean either: (a) M4 quality');
  console.log('genuinely correlates with overall relational sophistication, or (b) a');
  console.log('weak M4 response is anchoring/biasing scoring on unrelated scenario and');
  console.log('moment slices that should be scored independently.');
  console.log('To distinguish (a) from (b): check whether M1/S1, S2, S3 scoring prompts');
  console.log('reference M4 content at all. If scenario scoring prompts are built');
  console.log('independently per-slice with no cross-contamination, correlation likely');
  console.log('reflects genuine trait correlation (a) rather than rater bias (b).');
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

  const successCount = recomputed.filter((a) => a.recomputeStatus === 'success').length;
  console.log(`Recomputed ${successCount} complete attempts.`);
  console.log('');

  const m4Report = buildMomentReport(recomputed, 'M4');
  const m5Report = buildMomentReport(recomputed, 'M5');

  if (!m4Report) {
    console.log('M4 CONCRETENESS CORRELATION WITH OTHER PILLARS');
    console.log('=================================================');
    console.log('No data available');
    console.log('');
  } else {
    printMomentReport(m4Report);
  }

  if (!m5Report) {
    console.log('M5 CONCRETENESS CORRELATION WITH OTHER PILLARS');
    console.log('=================================================');
    console.log('No data available');
    console.log('');
  } else {
    printMomentReport(m5Report);
  }

  printInterpretationGuide();

  const finished = new Date().toISOString();
  const runtimeSec = ((Date.now() - started) / 1000).toFixed(1);
  console.log('');
  console.log(`Report generated at ${finished}`);
  console.log(`Total runtime: ${runtimeSec}s`);

  if (writeJson) {
    const outDir = join(process.cwd(), 'scripts', 'output');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'moment-concreteness-correlation.json');
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          generatedAt: finished,
          runtimeSec,
          algorithm: ANALYTICS_RECOMPUTE_ALGORITHM,
          m4: m4Report,
          m5: m5Report,
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
