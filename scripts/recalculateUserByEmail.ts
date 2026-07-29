/**
 * Recompute interview rollup + psychometric gate finalization for a user by email.
 *
 * Usage:
 *   npx tsx --import ./scripts/nodeRnStubs.mjs --env-file=.env scripts/recalculateUserByEmail.ts mattang5280@gmail.com
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  computePillarScoreDelta,
  recalculateAttemptScoresFromStoredSlices,
  snapshotAttemptScoresForAudit,
} from '../src/features/aria/adminRecalculateAttemptScores';
import {
  applyPostRecalculationGateOutcomeSync,
  buildRecalculationConsistencyPatch,
} from '../src/features/aria/recalculationPersistConsistency';
import { applyPsychometricModifierToAttempt as applyPsychometricModifierToAttemptCore } from '../supabase/functions/_shared/applyPsychometricModifier';
import { normalizeGateFailDetailForPersist } from '../src/features/psychometrics/gateFailDetailForPersist';
import {
  resolveScenarioSkipConfirmedCount,
  skipPenaltyPersistFieldsFromConfirmedCount,
} from '../src/features/aria/scenarioSkipCountHydration';

function mergeEnv(): void {
  const path = join(process.cwd(), '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

const ATTEMPT_SELECT =
  'id, user_id, attempt_number, completed_at, transcript, scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_specific_patterns, ego_development_level, language_markers, skip_count, skip_penalty_total, auto_failed, pillar_scores, weighted_score, modified_weighted_score, modified_weighted_score_with_psychometrics, passed, final_gate_pass, gate_fail_reasons, gate_fail_detail, gate_result_finalized_at, scenario_composites, original_scores, defense_patterns, disclosure_calibration, mentalizing_overcertainty_count, moment_4_concreteness, moment_5_concreteness, personal_moment_emotional_vocab_density, personal_moment_emotional_vocab_low, ai_reasoning, reasoning_pending, review_flags';

async function main(): Promise<void> {
  mergeEnv();
  const email = process.argv[2]?.trim();
  if (!email) {
    console.error('Usage: npx tsx --env-file=.env scripts/recalculateUserByEmail.ts <email>');
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
  }

  const admin = createClient(url, key);
  const { data: user, error: userErr } = await admin
    .from('users')
    .select('id, email, psychometrics_completed_at, psychometric_modifier')
    .eq('email', email)
    .maybeSingle();
  if (userErr) throw userErr;
  if (!user?.id) {
    console.error(`No user found for ${email}`);
    process.exit(1);
  }

  const { data: attempt, error: attemptErr } = await admin
    .from('interview_attempts')
    .select(ATTEMPT_SELECT)
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .or('is_phantom.eq.false,is_phantom.is.null')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (attemptErr) throw attemptErr;
  if (!attempt) {
    console.error(`No completed interview attempt for ${email}`);
    process.exit(1);
  }

  console.log(`Recalculating ${email} (${user.id}) attempt ${attempt.id} (#${attempt.attempt_number})`);
  console.log('Before:', {
    weighted_score: attempt.weighted_score,
    modified_weighted_score: attempt.modified_weighted_score,
    modified_weighted_score_with_psychometrics: attempt.modified_weighted_score_with_psychometrics,
    passed: attempt.passed,
    final_gate_pass: attempt.final_gate_pass,
    gate_result_finalized_at: attempt.gate_result_finalized_at,
    psychometric_modifier: user.psychometric_modifier,
  });

  const resolvedSkipCount = resolveScenarioSkipConfirmedCount({
    storedCount: attempt.skip_count,
    dbSkipCount: attempt.skip_count,
    transcriptMessages: Array.isArray(attempt.transcript)
      ? (attempt.transcript as Array<{
          role: string;
          content?: string;
          scenarioNumber?: number;
          interviewMoment?: number;
        }>)
      : [],
  });
  const skipPersistFields = skipPenaltyPersistFieldsFromConfirmedCount(resolvedSkipCount);

  const result = recalculateAttemptScoresFromStoredSlices({
    transcript: attempt.transcript,
    scenario_1_scores: attempt.scenario_1_scores,
    scenario_2_scores: attempt.scenario_2_scores,
    scenario_3_scores: attempt.scenario_3_scores,
    scenario_specific_patterns: attempt.scenario_specific_patterns,
    ego_development_level: attempt.ego_development_level,
    language_markers: attempt.language_markers,
    skip_count: skipPersistFields.skip_count,
    skip_penalty_total: skipPersistFields.skip_penalty_total,
    auto_failed: skipPersistFields.auto_failed,
    defense_patterns: attempt.defense_patterns,
    disclosure_calibration: attempt.disclosure_calibration,
    mentalizing_overcertainty_count: attempt.mentalizing_overcertainty_count,
    moment_4_concreteness: attempt.moment_4_concreteness,
    moment_5_concreteness: attempt.moment_5_concreteness,
    personal_moment_emotional_vocab_density: attempt.personal_moment_emotional_vocab_density,
    personal_moment_emotional_vocab_low: attempt.personal_moment_emotional_vocab_low,
  });

  if (result.kind !== 'success') {
    console.error('Interview recalculation incomplete:', result.notes);
    process.exit(1);
  }

  const nowIso = new Date().toISOString();
  const gateFailReasons = result.gate.failReasonCodes ?? [];
  const gateFailDetail = normalizeGateFailDetailForPersist(result.gate.failReasonDetail);
  const passedAfterFloors = gateFailReasons.length === 0 ? result.gate.pass : false;
  const oldPillars =
    attempt.pillar_scores && typeof attempt.pillar_scores === 'object'
      ? (attempt.pillar_scores as Record<string, number>)
      : {};
  const delta = computePillarScoreDelta(oldPillars, result.pillar_scores);
  const snap = attempt.original_scores ? null : snapshotAttemptScoresForAudit(attempt);
  const consistencyPatch = buildRecalculationConsistencyPatch({
    attempt,
    newPassed: passedAfterFloors,
    newWeightedScore: result.gate.weightedScore,
    newPillarScores: result.pillar_scores,
    recalculatedAt: nowIso,
    forceFinalGateSync: true,
  });
  const reviewFlags = Array.isArray(attempt.review_flags) ? [...attempt.review_flags] : [];
  if (consistencyPatch.review_flags) {
    for (const flag of consistencyPatch.review_flags) {
      if (!reviewFlags.includes(flag)) reviewFlags.push(flag);
    }
  }

  const { error: upErr } = await admin
    .from('interview_attempts')
    .update({
      ...(snap ? { original_scores: snap } : {}),
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
      review_flags: [...new Set([...(result.gate.reviewFlags ?? []), ...reviewFlags])],
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
      skip_count: skipPersistFields.skip_count,
      skip_penalties: skipPersistFields.skip_penalties,
      skip_penalty_total: skipPersistFields.skip_penalty_total,
      auto_failed: skipPersistFields.auto_failed,
      auto_fail_reason: skipPersistFields.auto_fail_reason,
    })
    .eq('id', attempt.id)
    .eq('user_id', user.id);
  if (upErr) throw upErr;

  console.log('Interview rollup updated:', {
    weighted_score: result.gate.weightedScore,
    depth_signal_modifier: result.gate.depthSignalModifier ?? result.gate.scoreModifier,
    modified_weighted_score: result.gate.modifiedWeightedScore,
    passed: passedAfterFloors,
  });

  const psychResult = await applyPsychometricModifierToAttemptCore(admin, user.id, attempt.id, {
    forceApply: true,
    preservePassIfPreviouslyPassing: false,
  });
  console.log('Psychometric finalize:', psychResult);

  const { data: afterAttempt } = await admin
    .from('interview_attempts')
    .select(
      'weighted_score, modified_weighted_score, modified_weighted_score_with_psychometrics, passed, final_gate_pass, gate_result_finalized_at, gate_fail_reasons, depth_signal_modifier, psychometric_modifier_applied, review_flags, ai_reasoning',
    )
    .eq('id', attempt.id)
    .maybeSingle();
  if (afterAttempt) {
    const sync = await applyPostRecalculationGateOutcomeSync(admin, {
      attemptId: attempt.id,
      userId: user.id,
      oldPassed: attempt.passed,
      oldFinalGatePass: attempt.final_gate_pass,
      recalculatedAt: nowIso,
      afterAttempt,
      newPillarScores: result.pillar_scores,
      newWeightedScore: result.gate.weightedScore,
    });
    console.log('Gate outcome sync:', sync);
  }
  const { data: afterUser } = await admin
    .from('users')
    .select('psychometric_modifier')
    .eq('id', user.id)
    .maybeSingle();

  console.log('After:', {
    ...afterAttempt,
    psychometric_modifier: afterUser?.psychometric_modifier,
  });
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
