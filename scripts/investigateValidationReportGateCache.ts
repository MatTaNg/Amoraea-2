/**
 * Fix 4 diagnostic: Math attempt ID match + cache hash vs gate finalization.
 *
 * Usage: npx tsx --env-file=.env scripts/investigateValidationReportGateCache.ts [attemptId]
 */
import { createClient } from '@supabase/supabase-js';

const MATH_ATTEMPT_ID = 'e5ef9c7d-4cc8-4741-b7a5-b28820a8093a';

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function hashSourcePayload(payload: unknown): string {
  const str = stableStringify(payload);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function derivePerformanceTier(
  finalGatePass: boolean | null,
  modifiedWeightedScore: number | null,
): string | null {
  if (finalGatePass == null) return null;
  if (!finalGatePass) return 'needs_development';
  const score = modifiedWeightedScore ?? 6.5;
  return score >= 7.0 ? 'strong_demonstration' : 'balanced_demonstration';
}

async function main(): Promise<void> {
  const attemptIdArg = process.argv[2] ?? MATH_ATTEMPT_ID;
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const sb = createClient(url, key);

  const { data: attempt, error: attemptErr } = await sb
    .from('interview_attempts')
    .select(
      'id, user_id, completed_at, final_gate_pass, gate_fail_reasons, gate_result_finalized_at, weighted_score, modified_weighted_score, modified_weighted_score_with_psychometrics',
    )
    .eq('id', attemptIdArg)
    .maybeSingle();
  if (attemptErr) throw attemptErr;
  if (!attempt) {
    console.log('Attempt not found:', attemptIdArg);
    return;
  }

  const userId = attempt.user_id as string;

  const { data: user } = await sb
    .from('users')
    .select('id, name, email, latest_attempt_id')
    .eq('id', userId)
    .maybeSingle();

  const { data: recent } = await sb
    .from('interview_attempts')
    .select('id, completed_at, final_gate_pass, gate_result_finalized_at')
    .eq('user_id', userId)
    .or('is_phantom.eq.false,is_phantom.is.null')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(5);

  const { data: comparisons } = await sb
    .from('relationship_validation_comparisons')
    .select(
      'id, profile_report_markdown, profile_report_source_hash, profile_report_generated_at',
    )
    .eq('user_id', userId);

  const finalGatePass =
    typeof attempt.final_gate_pass === 'boolean' ? attempt.final_gate_pass : null;
  const modifiedWeightedScore =
    typeof attempt.modified_weighted_score_with_psychometrics === 'number'
      ? attempt.modified_weighted_score_with_psychometrics
      : typeof attempt.modified_weighted_score === 'number'
        ? attempt.modified_weighted_score
        : null;
  const gateFailReasons = Array.isArray(attempt.gate_fail_reasons)
    ? (attempt.gate_fail_reasons as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const performanceTier = derivePerformanceTier(finalGatePass, modifiedWeightedScore);

  // Hash inputs that affect cache invalidation on gate state (subset of computeValidationReportSourceHash)
  const hashIfNullPass = hashSourcePayload({
    interviewAttemptId: attempt.id,
    interviewPerformanceTier: performanceTier,
    interviewFinalGatePass: null,
    interviewGateFailReasons: gateFailReasons,
    promptCalibrationVersion: 0,
  });
  const hashIfFalsePass = hashSourcePayload({
    interviewAttemptId: attempt.id,
    interviewPerformanceTier: performanceTier,
    interviewFinalGatePass: false,
    interviewGateFailReasons: gateFailReasons,
    promptCalibrationVersion: 0,
  });
  const hashCurrent = hashSourcePayload({
    interviewAttemptId: attempt.id,
    interviewPerformanceTier: performanceTier,
    interviewFinalGatePass: finalGatePass,
    interviewGateFailReasons: gateFailReasons,
    promptCalibrationVersion: 1,
  });

  console.log('=== Fix 4 — Validation report gate / cache diagnostic ===\n');
  console.log('User:', user?.name ?? user?.email ?? userId);
  console.log('Target attempt:', attempt.id);
  console.log('  completed_at:', attempt.completed_at);
  console.log('  final_gate_pass:', attempt.final_gate_pass);
  console.log('  gate_fail_reasons:', JSON.stringify(attempt.gate_fail_reasons));
  console.log('  gate_result_finalized_at:', attempt.gate_result_finalized_at);
  console.log('  weighted_score:', attempt.weighted_score);
  console.log('  modified_weighted_score:', attempt.modified_weighted_score);
  console.log('  derived performanceTier:', performanceTier);
  console.log('\nusers.latest_attempt_id:', user?.latest_attempt_id);
  console.log(
    'Is target most recent completed (by completed_at)?',
    recent?.[0]?.id === attempt.id ? 'YES' : `NO — most recent is ${recent?.[0]?.id ?? 'none'}`,
  );
  console.log('\nRecent completed attempts:');
  for (const row of recent ?? []) {
    console.log(
      `  - ${row.id} | pass=${row.final_gate_pass} | finalized=${row.gate_result_finalized_at ?? 'null'} | ${row.completed_at}`,
    );
  }

  console.log('\nCache hash sensitivity (gate fields only):');
  console.log('  hash if final_gate_pass=null (old pre-finalization):', hashIfNullPass);
  console.log('  hash if final_gate_pass=false:', hashIfFalsePass);
  console.log('  hash current (false + promptCalibrationVersion=1):', hashCurrent);
  console.log(
    '  null→false transition invalidates cache:',
    hashIfNullPass !== hashIfFalsePass ? 'YES' : 'NO',
  );

  for (const comp of comparisons ?? []) {
    const storedHash = comp.profile_report_source_hash as string | null;
    console.log('\nComparison row:', comp.id);
    console.log('  profile_report_generated_at:', comp.profile_report_generated_at);
    console.log('  stored hash:', storedHash);
    console.log('  matches current hash:', storedHash === hashCurrent ? 'YES' : 'NO');
    console.log('  matches pre-finalization (null pass) hash:', storedHash === hashIfNullPass ? 'YES' : 'NO');
    console.log('  has markdown:', Boolean(comp.profile_report_markdown));
  }

  if (attempt.final_gate_pass == null) {
    console.log('\n⚠ final_gate_pass is null — resolveReportGateNarrativeTier treats as PASSED.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
