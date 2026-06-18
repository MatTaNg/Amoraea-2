/**
 * Deep fairness/trend analysis — recomputes all completed attempts with current algorithm.
 * Usage: npx tsx --env-file=.env scripts/analyzeFairnessTrends.ts
 */
import { createClient } from '@supabase/supabase-js';
import { moment4Moment5ConcretenessDepthSignalDelta } from '../src/features/aria/moment4ConcretenessClassification';
import { GATE_PASS_WEIGHTED_MIN } from '../src/features/aria/computeGateResultCore';
import {
  recomputeAttemptForAnalytics,
  type AnalyticsAttempt,
  type RawAttemptForAnalytics,
} from './recomputeAttemptForAnalytics';

const ATTEMPT_SELECT = `
  id, user_id, completed_at, is_phantom, transcript,
  scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_specific_patterns,
  ego_development_level, language_markers, skip_count, skip_penalty_total, auto_failed,
  defense_patterns, mentalizing_overcertainty_count,
  personal_moment_emotional_vocab_density, personal_moment_emotional_vocab_low,
  review_flags, reasoning_pending, probe_log,
  weighted_score, modified_weighted_score, modified_weighted_score_with_psychometrics,
  passed, final_gate_pass, pillar_scores, moment_4_concreteness, moment_5_concreteness,
  depth_signal_modifier, score_modifier, gate_fail_reasons, scenario_composites,
  disclosure_calibration
`;

const USER_PSYCH_SELECT = `
  id, psychometrics_brs_score, psychometrics_brs_responses,
  psychometrics_anxiety_trait_score, psychometrics_anxiety_trait_responses,
  psychometrics_scs_sf_score, psychometrics_scs_sf_responses,
  psychometrics_gasp_score, psychometrics_gasp_responses,
  psychometrics_dweck_score, psychometrics_dweck_responses,
  psychometrics_aaq2_score, psychometrics_rses_score,
  psychometrics_aaq2_responses, psychometrics_rses_responses,
  psychometrics_scs_public_score, psychometrics_scs_private_score,
  psychometrics_rfq_score, psychometrics_rfq_responses,
  psychometrics_sd3_narcissism_score, psychometrics_sd3_narcissism_responses,
  psychometrics_npi_entitlement_score, psychometric_straight_line_flags
`;

type Attempt = AnalyticsAttempt & {
  persisted_modified?: number | null;
  persisted_disclosure?: string | null;
  persisted_passed?: boolean | null;
};

function short(id: string): string {
  return id.slice(0, 8);
}

function modGap(a: Attempt): number {
  const w = a.weighted_score ?? 0;
  const m = a.modified_weighted_score ?? w;
  return Math.round((w - m) * 100) / 100;
}

function hasFloorBreachNote(a: Attempt): boolean {
  return a.recomputeNotes.some((n) => n.includes('floor_breach:'));
}

function hasScenarioFloorNote(a: Attempt): boolean {
  return a.recomputeNotes.some((n) => n.includes('scenario composite floor'));
}

async function main(): Promise<void> {
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

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const rows = (data ?? []) as Array<RawAttemptForAnalytics & {
    modified_weighted_score: number | null;
    disclosure_calibration: string | null;
    passed: boolean | null;
  }>;

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const usersById = new Map<string, Record<string, unknown>>();
  for (let i = 0; i < userIds.length; i += 100) {
    const chunk = userIds.slice(i, i + 100);
    const { data: users } = await supabase.from('users').select(USER_PSYCH_SELECT).in('id', chunk);
    for (const u of users ?? []) {
      usersById.set(String((u as { id: string }).id), u as Record<string, unknown>);
    }
  }

  const attempts: Attempt[] = rows.map((row) => {
    const rec = recomputeAttemptForAnalytics(row, usersById.get(row.user_id) ?? null);
    return {
      ...rec,
      persisted_modified: row.modified_weighted_score,
      persisted_disclosure: row.disclosure_calibration,
      persisted_passed: row.passed,
    };
  });

  const complete = attempts.filter((a) => a.recomputeStatus === 'success');
  const excluded = attempts.length - complete.length;

  console.log('POST-DISCLOSURE-FIX FAIRNESS & TREND AUDIT');
  console.log('==========================================');
  console.log(
    `Rows with completed_at: ${rows.length}; fully scorable interviews audited: ${complete.length}` +
      (excluded > 0 ? ` (${excluded} incomplete excluded)` : ''),
  );
  console.log(`Pass rate (scorable only): ${complete.filter((a) => a.final_gate_pass === true).length}/${complete.length} (${((complete.filter((a) => a.final_gate_pass === true).length / complete.length) * 100).toFixed(1)}%)`);
  console.log('');

  // All metrics below use fully scorable interviews only (`recomputeStatus === 'success'`).

  // Disclosure distribution
  const discCounts = { underdisclosure: 0, calibrated: 0, overdisclosure: 0 };
  for (const a of complete) {
    const d = a.disclosure_calibration ?? 'calibrated';
    if (d in discCounts) discCounts[d as keyof typeof discCounts]++;
  }
  console.log('DISCLOSURE CALIBRATION (new algorithm)');
  console.log(`  underdisclosure: ${discCounts.underdisclosure} (${pct(discCounts.underdisclosure, complete.length)})`);
  console.log(`  calibrated:      ${discCounts.calibrated} (${pct(discCounts.calibrated, complete.length)})`);
  console.log(`  overdisclosure:  ${discCounts.overdisclosure} (${pct(discCounts.overdisclosure, complete.length)})`);
  console.log('');

  // Low/low concreteness cohort
  const lowLow = complete.filter(
    (a) =>
      ['low', 'absent'].includes((a.moment_4_concreteness ?? '').toLowerCase()) &&
      ['low', 'absent'].includes((a.moment_5_concreteness ?? '').toLowerCase()),
  );
  const lowLowUnder = lowLow.filter((a) => a.disclosure_calibration === 'underdisclosure');
  const lowLowCal = lowLow.filter((a) => a.disclosure_calibration === 'calibrated');

  console.log(`LOW/LOW CONCRETENESS COHORT (n=${lowLow.length})`);
  console.log(`  underdisclosure (word ratio): ${lowLowUnder.length}`);
  console.log(`  calibrated (no word-ratio hit): ${lowLowCal.length}`);
  if (lowLowCal.length > 0) {
    console.log('  calibrated despite low/low (fix beneficiaries — verbose-but-vague or missing word data):');
    for (const a of lowLowCal.slice(0, 8)) {
      console.log(`    ${short(a.id)} mod=${a.modified_weighted_score} depth=${a.depth_signal_modifier}`);
    }
  }
  console.log('');

  // Modifier stacking
  const negMod = complete.filter((a) => (a.depth_signal_modifier ?? 0) < 0);
  let bothPenalties = 0;
  let concOnly = 0;
  for (const a of negMod) {
    const c = moment4Moment5ConcretenessDepthSignalDelta(a.moment_4_concreteness, a.moment_5_concreteness);
    const d = a.disclosure_calibration === 'underdisclosure' ? -0.2 : 0;
    if (c < 0 && d < 0) bothPenalties++;
    else if (c < 0 && d === 0) concOnly++;
  }
  console.log(`DEPTH MODIFIER STACKING (${negMod.length} with negative modifier)`);
  console.log(`  concreteness + underdisclosure: ${bothPenalties}`);
  console.log(`  concreteness only: ${concOnly}`);
  console.log(`  avg gap (both): ${avg(negMod.filter((a) => moment4Moment5ConcretenessDepthSignalDelta(a.moment_4_concreteness, a.moment_5_concreteness) < 0 && a.disclosure_calibration === 'underdisclosure').map(modGap))}`);
  console.log(`  avg gap (concreteness only): ${avg(negMod.filter((a) => moment4Moment5ConcretenessDepthSignalDelta(a.moment_4_concreteness, a.moment_5_concreteness) < 0 && a.disclosure_calibration !== 'underdisclosure').map(modGap))}`);
  console.log('');

  // Persisted drift
  let modDrift = 0;
  let discDrift = 0;
  const scoreUps: Array<{ id: string; oldM: number; newM: number; delta: number }> = [];
  let passFlip = 0;

  for (const a of complete) {
    const oldM = a.persisted_modified;
    const newM = a.modified_weighted_score;
    if (oldM != null && newM != null && Math.abs(oldM - newM) > 0.01) {
      modDrift++;
      scoreUps.push({ id: a.id, oldM, newM, delta: Math.round((newM - oldM) * 100) / 100 });
    }
    if (a.persisted_disclosure && a.persisted_disclosure !== a.disclosure_calibration) discDrift++;
    if (a.persisted_passed === false && a.passed === true) passFlip++;
  }
  scoreUps.sort((a, b) => b.delta - a.delta);

  console.log('PERSISTED DB vs NEW ALGORITHM');
  console.log(`  modified_weighted_score changed: ${modDrift}/${complete.length}`);
  console.log(`  disclosure_calibration label changed: ${discDrift}/${complete.length}`);
  console.log(`  interview pass flipped false→true: ${passFlip}`);
  if (scoreUps.filter((d) => d.delta > 0).length > 0) {
    console.log('  Top beneficiaries (+modified score):');
    for (const d of scoreUps.filter((d) => d.delta > 0).slice(0, 10)) {
      console.log(`    ${short(d.id)}: ${d.oldM} → ${d.newM} (+${d.delta})`);
    }
  }
  console.log('');

  // Floor redundancy in failing cohort
  const fails = complete.filter((a) => a.final_gate_pass !== true);
  const bothFloors = fails.filter((a) => hasFloorBreachNote(a) && hasScenarioFloorNote(a));
  const pillarOnly = fails.filter((a) => hasFloorBreachNote(a) && !hasScenarioFloorNote(a));
  const scenarioOnly = fails.filter((a) => !hasFloorBreachNote(a) && hasScenarioFloorNote(a));

  console.log(`FAILING COHORT (n=${fails.length}) — floor check overlap`);
  console.log(`  pillar floor + scenario floor notes: ${bothFloors.length}`);
  console.log(`  pillar floor only: ${pillarOnly.length}`);
  console.log(`  scenario floor only: ${scenarioOnly.length}`);
  console.log('');

  // Borderline
  const borderline = complete.filter((a) => {
    const m = a.modified_weighted_score;
    return m != null && m >= 6.0 && m < GATE_PASS_WEIGHTED_MIN;
  });
  console.log(`BORDERLINE (modified ${6.0}–${GATE_PASS_WEIGHTED_MIN}): ${borderline.length} users`);
  for (const a of borderline.filter((x) => x.final_gate_pass !== true).slice(0, 6)) {
    console.log(
      `  FAIL ${short(a.id)} w=${a.weighted_score} m=${a.modified_weighted_score} reasons=[${(a.gate_fail_reasons ?? []).slice(0, 3).join(',')}]`,
    );
  }
  console.log('');

  // S2 isolation
  const s2Weak = complete.filter((a) => (a.scenario_composites?.scenario_2 ?? 99) < 5);
  const s2Only = s2Weak.filter((a) => {
    const s1 = a.scenario_composites?.scenario_1 ?? 99;
    const s3 = a.scenario_composites?.scenario_3 ?? 99;
    return s1 >= 5 && s3 >= 5;
  });
  console.log(`SCENARIO 2 WEAK (composite <5): ${s2Weak.length}; S2-only (S1,S3 ok): ${s2Only.length}`);
  console.log('');

  // M4 low pass rate
  const m4Low = complete.filter((a) => (a.moment_4_concreteness ?? '').toLowerCase() === 'low');
  const m4LowPass = m4Low.filter((a) => a.final_gate_pass === true).length;
  console.log(`M4 LOW: ${m4Low.length} users (${pct(m4Low.length, complete.length)}), pass rate ${pct(m4LowPass, m4Low.length)}`);
  console.log('');

  // Recommendations
  console.log('RECOMMENDATIONS');
  console.log('───────────────');
  const recs: string[] = [];

  if (lowLowCal.length >= 3) {
    recs.push(
      `${lowLowCal.length} low/low-concreteness users no longer get underdisclosure — disclosure fix working as intended.`,
    );
  }
  if (bothPenalties >= 8) {
    recs.push(
      `${bothPenalties} users still stack concreteness (−0.2 to −0.5) + word-ratio underdisclosure (−0.2). Next: audit emotional_vocab_low overlap.`,
    );
  }
  if (discCounts.underdisclosure / complete.length > 0.25) {
    recs.push(
      'Underdisclosure still ~27% — 0.4× word-ratio threshold may be strict; users with moderate scenario verbosity but thin M4/M5 still penalized.',
    );
  }
  if (s2Only.length >= 5) {
    recs.push('Scenario 2 fails in isolation often — S2 rubric/appreciation coupling may be unfairly harsh (see s2-isolation-analysis).');
  }
  if (m4Low.length / complete.length > 0.35) {
    recs.push('M4 low rate >35% — continue tuning specificity probe and valid_non_applicable routing.');
  }
  const appr = complete.map((a) => a.pillar_scores?.appreciation).filter((v): v is number => typeof v === 'number');
  if (appr.length > 0) {
    const uniq = new Set(appr).size;
    if (uniq <= 6) recs.push(`Appreciation has only ${uniq} distinct values — poor discrimination for a gate-weighted pillar.`);
  }
  if (borderline.length >= 10) {
    recs.push(`${borderline.length} users in modified 6.0–6.5 zone — primary human review queue.`);
  }
  if (passFlip > 0) {
    recs.push(`${passFlip} user(s) would pass interview gate on rescore — consider backfill if DB still has old disclosure logic.`);
  }
  for (const r of recs) console.log(` • ${r}`);
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${((n / total) * 100).toFixed(1)}%`;
}

function avg(nums: number[]): string {
  if (nums.length === 0) return 'n/a';
  return (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
