/**
 * Compare stored DB pass flags vs current-algorithm recompute.
 * Usage: npx tsx --env-file=.env scripts/diagnosePassCounts.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
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
  probe_log,
  passed,
  final_gate_pass
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

type RawWithStored = RawAttemptForAnalytics & {
  passed?: boolean | null;
  final_gate_pass?: boolean | null;
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
    console.error('Missing Supabase env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }
  return createClient(supabaseUrl, serviceKey);
}

async function fetchCompletedAttempts(supabase: SupabaseClient): Promise<RawWithStored[]> {
  const { data, error } = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_SELECT)
    .not('completed_at', 'is', null)
    .or('is_phantom.eq.false,is_phantom.is.null');
  if (error) throw new Error(error.message);
  return (data ?? []) as RawWithStored[];
}

async function fetchUsersByIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  const unique = [...new Set(userIds)];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { data, error } = await supabase.from('users').select(USER_PSYCH_SELECT).in('id', chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      map.set(String((row as { id: string }).id), row as Record<string, unknown>);
    }
  }
  return map;
}

function countPass(rows: { passed?: boolean | null; final_gate_pass?: boolean | null }[], field: 'passed' | 'final_gate_pass'): number {
  return rows.filter((r) => r[field] === true).length;
}

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
  const supabase = createAdminClient();
  const raw = await fetchCompletedAttempts(supabase);
  const usersById = await fetchUsersByIds(
    supabase,
    raw.map((a) => a.user_id),
  );

  const prevLog = console.log;
  console.log = () => {};
  let recomputed: AnalyticsAttempt[];
  try {
    recomputed = raw.map((row) =>
      recomputeAttemptForAnalytics(row, usersById.get(row.user_id) ?? null),
    );
  } finally {
    console.log = prevLog;
  }

  const scorableIdx = recomputed
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.recomputeStatus === 'success');
  const scorableRaw = scorableIdx.map(({ i }) => raw[i]!);
  const scorable = scorableIdx.map(({ a }) => a);

  console.log('PASS COUNT DIAGNOSIS — STORED DB VS RECOMPUTE');
  console.log('=============================================');
  console.log(`Completed attempts (all):     ${raw.length}`);
  console.log(`Scorable (recompute success): ${scorable.length}`);
  console.log(`Incomplete (excluded):        ${raw.length - scorable.length}`);
  console.log('');

  console.log('ALL COMPLETED ROWS (includes incomplete — stored DB only meaningful)');
  console.log(`  stored passed:           ${countPass(raw, 'passed')}`);
  console.log(`  stored final_gate_pass:  ${countPass(raw, 'final_gate_pass')}`);
  console.log('');

  console.log('SCORABLE COHORT');
  console.log(`  stored passed:           ${countPass(scorableRaw, 'passed')}`);
  console.log(`  stored final_gate_pass:  ${countPass(scorableRaw, 'final_gate_pass')}`);
  console.log(`  recomputed passed:       ${scorable.filter((a) => a.passed === true).length}`);
  console.log(`  recomputed final_gate:   ${scorable.filter((a) => a.final_gate_pass === true).length}`);
  console.log('');

  const passedMismatches = scorableIdx.filter(({ a, i }) => {
    const stored = raw[i]!.passed;
    return stored != null && a.passed != null && stored !== a.passed;
  });
  const finalMismatches = scorableIdx.filter(({ a, i }) => {
    const stored = raw[i]!.final_gate_pass;
    return stored != null && a.final_gate_pass != null && stored !== a.final_gate_pass;
  });

  console.log(`Scorable stored≠recomputed — passed:          ${passedMismatches.length}`);
  console.log(`Scorable stored≠recomputed — final_gate_pass: ${finalMismatches.length}`);
  console.log('');

  const interviewPassPsychFail = scorable.filter(
    (a) => a.passed === true && a.final_gate_pass === false,
  ).length;
  const interviewFailPsychPass = scorable.filter(
    (a) => a.passed === false && a.final_gate_pass === true,
  ).length;
  console.log('RECOMPUTED GATE SPLIT (scorable)');
  console.log(`  interview pass → final fail: ${interviewPassPsychFail}`);
  console.log(`  interview fail → final pass: ${interviewFailPsychPass}`);
  console.log('');

  if (finalMismatches.length > 0) {
    console.log('FINAL_GATE_PASS MISMATCHES (first 10):');
    for (const { a, i } of finalMismatches.slice(0, 10)) {
      const stored = raw[i]!;
      console.log(
        `  ${a.id.slice(0, 8)} stored=${stored.final_gate_pass} recomputed=${a.final_gate_pass} passed=${a.passed} reasons=${JSON.stringify(a.gate_fail_reasons?.slice(0, 2))}`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
