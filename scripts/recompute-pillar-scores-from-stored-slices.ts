/**
 * Recompute interview_attempts scoring from stored slices (same path as admin Recalculate Scores).
 *
 * Usage:
 *   npm run recompute-pillar-scores -- --attempt-id=8f52b3e4-493c-4053-b12b-7df8111eed32
 *   npm run recompute-pillar-scores -- --attempt-number=1 --user-id=<uuid>
 *
 * Requires .env with EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (recommended).
 */
import { createClient } from '@supabase/supabase-js';
import { PILLAR_ROLLUP_ALGORITHM_VERSION } from '../src/features/aria/aggregateMarkerScoresFromSlices';
import { recalculateAttemptScoresFromStoredSlices } from '../src/features/aria/adminRecalculateAttemptScores';
import { applyPsychometricModifierToAttempt } from '../src/features/psychometrics/applyPsychometricModifier';
import { normalizeGateFailDetailForPersist } from '../src/features/psychometrics/gateFailDetailForPersist';

type Args = { attemptId?: string; attemptNumber?: number; userId?: string };

function parseArgs(argv: string[]): Args {
  const idArg = argv.find((a) => a.startsWith('--attempt-id='));
  const numArg = argv.find((a) => a.startsWith('--attempt-number='));
  const userArg = argv.find((a) => a.startsWith('--user-id='));
  const attemptId = idArg?.split('=')[1]?.trim();
  const attemptNumber = numArg ? Number(numArg.split('=')[1]) : NaN;
  const userId = userArg?.split('=')[1]?.trim();
  if (attemptId) return { attemptId };
  if (Number.isFinite(attemptNumber) && attemptNumber >= 1) {
    return { attemptNumber, userId };
  }
  console.error('Pass --attempt-id=<uuid> or --attempt-number=<n> [--user-id=<uuid>]');
  process.exit(1);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const supabaseKey = serviceKey ?? anonKey;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, supabaseKey);
  let query = admin
    .from('interview_attempts')
    .select(
      'id, user_id, attempt_number, transcript, scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_specific_patterns, ego_development_level, language_markers, skip_count',
    );
  if (args.attemptId) {
    query = query.eq('id', args.attemptId);
  } else {
    query = query.eq('attempt_number', args.attemptNumber!);
    if (args.userId) query = query.eq('user_id', args.userId);
  }
  const { data: row, error: selErr } = await query.maybeSingle();
  if (selErr) {
    console.error(selErr.message);
    process.exit(1);
  }
  if (!row) {
    console.error('No matching interview_attempts row');
    process.exit(1);
  }

  console.log('PILLAR_ROLLUP_ALGORITHM_VERSION', PILLAR_ROLLUP_ALGORITHM_VERSION);
  const result = recalculateAttemptScoresFromStoredSlices({
    transcript: row.transcript,
    scenario_1_scores: row.scenario_1_scores,
    scenario_2_scores: row.scenario_2_scores,
    scenario_3_scores: row.scenario_3_scores,
    scenario_specific_patterns: row.scenario_specific_patterns,
    ego_development_level: row.ego_development_level,
    language_markers: row.language_markers,
    skip_count: row.skip_count,
  });

  if (result.kind !== 'success') {
    console.error('Recalculation incomplete:', result.notes);
    process.exit(1);
  }

  console.log('pillar_scores', result.pillar_scores);
  console.log('weighted_score', result.gate.weightedScore);
  console.log('defense_patterns', result.defense_patterns);
  console.log('notes', result.notes);

  const { error: upErr } = await admin
    .from('interview_attempts')
    .update({
      pillar_scores: result.pillar_scores,
      weighted_score: result.gate.weightedScore,
      passed: result.gate.pass,
      gate_fail_reasons: result.gate.failReasonCodes ?? [],
      gate_fail_detail: normalizeGateFailDetailForPersist(result.gate.failReasonDetail),
      scenario_composites: result.scenarioCompositesJson,
      recalculated_at: new Date().toISOString(),
      recalculation_notes: result.notes,
      mentalizing_overcertainty_count: result.mentalizingOvercertaintyCount,
      defense_patterns: result.defense_patterns,
      moment_4_concreteness: result.moment_4_concreteness,
      moment_5_concreteness: result.moment_5_concreteness,
      depth_signal_modifier: result.gate.depthSignalModifier ?? result.gate.scoreModifier ?? null,
      score_modifier: result.gate.scoreModifier ?? result.gate.depthSignalModifier ?? null,
      modified_weighted_score: result.gate.modifiedWeightedScore ?? null,
      disclosure_calibration: result.disclosure_calibration,
      ego_development_level: result.ego_development_level,
    })
    .eq('id', row.id as string);

  if (upErr) {
    console.error('Update failed:', upErr.message);
    if (!serviceKey) console.error('If RLS blocked, set SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  try {
    await applyPsychometricModifierToAttempt(row.user_id as string, row.id as string, {
      forceApply: true,
    });
  } catch (e) {
    console.warn('Psychometric modifier apply failed (pillar rollup still saved):', e);
  }

  console.log(`Updated id=${row.id} attempt_number=${row.attempt_number}`);
}

void main();
