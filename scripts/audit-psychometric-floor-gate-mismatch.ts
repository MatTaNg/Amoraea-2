/**
 * Lists completed attempts where uncertainty activeFlags show a psychometric floor breach
 * but gate_fail_reasons omits that floor (likely passed incorrectly before gate-merge fix).
 *
 * Usage: npx tsx scripts/audit-psychometric-floor-gate-mismatch.ts
 */
import { createClient } from '@supabase/supabase-js';
import {
  ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES,
  collectPsychometricFloorGateFailReasons,
  type PsychometricGateFailFloorCode,
} from '../src/features/psychometrics/psychometricFloorBreaches';
import { sd3NarcissismScoreFromUserRow } from '../src/features/psychometrics/usersPsychometricsSchemaFallback';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

type MismatchRow = {
  attemptId: string;
  userId: string;
  floorId: PsychometricGateFailFloorCode;
  passed: boolean | null;
  final_gate_pass: boolean | null;
  completed_at: string | null;
};

async function main(): Promise<void> {
  const { data: attempts, error } = await supabase
    .from('interview_attempts')
    .select(
      'id, user_id, completed_at, passed, final_gate_pass, gate_fail_reasons, uncertainty_breakdown, user:users!inner(psychometrics_rfq_score, psychometrics_gasp_score, psychometrics_dweck_score, psychometrics_scs_sf_score, psychometrics_sd3_narcissism_score, psychometrics_narq_s_score, psychometrics_aaq2_score, psychometrics_rses_score, psychometric_straight_line_flags)',
    )
    .not('completed_at', 'is', null)
    .not('uncertainty_breakdown', 'is', null);

  if (error) {
    console.error(error);
    process.exit(1);
  }

  const mismatches: MismatchRow[] = [];

  for (const row of attempts ?? []) {
    const attempt = row as Record<string, unknown>;
    const user = (attempt.user as Record<string, unknown>) ?? {};
    const straightLineRaw = user.psychometric_straight_line_flags;
    const straightLineFlags = Array.isArray(straightLineRaw)
      ? straightLineRaw.filter((f): f is string => typeof f === 'string')
      : [];

    const wouldTrigger = collectPsychometricFloorGateFailReasons(
      {
        rfqScore: typeof user.psychometrics_rfq_score === 'number' ? user.psychometrics_rfq_score : null,
        gaspScore: typeof user.psychometrics_gasp_score === 'number' ? user.psychometrics_gasp_score : null,
        dweckScore: typeof user.psychometrics_dweck_score === 'number' ? user.psychometrics_dweck_score : null,
        scsSfScore: typeof user.psychometrics_scs_sf_score === 'number' ? user.psychometrics_scs_sf_score : null,
        sd3NarcissismScore: sd3NarcissismScoreFromUserRow(user),
      },
      straightLineFlags,
      {
        aaq2Score: typeof user.psychometrics_aaq2_score === 'number' ? user.psychometrics_aaq2_score : null,
        rsesScore: typeof user.psychometrics_rses_score === 'number' ? user.psychometrics_rses_score : null,
      },
    );

    const gateReasons = Array.isArray(attempt.gate_fail_reasons)
      ? (attempt.gate_fail_reasons as string[])
      : [];
    const breakdown = attempt.uncertainty_breakdown as { activeFlags?: string[] } | null;
    const activeFlags = breakdown?.activeFlags ?? [];

    for (const floorId of wouldTrigger) {
      if (!ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES.includes(floorId)) continue;
      const inUncertainty = activeFlags.includes(floorId);
      const inGate = gateReasons.includes(floorId);
      if (inUncertainty && !inGate) {
        mismatches.push({
          attemptId: String(attempt.id),
          userId: String(attempt.user_id),
          floorId,
          passed: attempt.passed as boolean | null,
          final_gate_pass: attempt.final_gate_pass as boolean | null,
          completed_at: (attempt.completed_at as string) ?? null,
        });
      }
    }
  }

  console.log(JSON.stringify({ mismatchCount: mismatches.length, mismatches }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
