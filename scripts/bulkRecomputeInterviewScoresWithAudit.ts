/**
 * Bulk recompute interview scores with audit trail, gate-flip flags, and ai_reasoning queue.
 *
 * Usage:
 *   npx tsx --import ./scripts/nodeRnStubs.mjs --env-file=.env scripts/bulkRecomputeInterviewScoresWithAudit.ts --dry-run
 *   npx tsx --import ./scripts/nodeRnStubs.mjs --env-file=.env scripts/bulkRecomputeInterviewScoresWithAudit.ts --commit
 *   npx tsx --import ./scripts/nodeRnStubs.mjs --env-file=.env scripts/bulkRecomputeInterviewScoresWithAudit.ts --commit --since=2026-06-01
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  computePillarScoreDelta,
  recalculateAttemptScoresFromStoredSlices,
  snapshotAttemptScoresForAudit,
} from '../src/features/aria/adminRecalculateAttemptScores';
import { PILLAR_ROLLUP_ALGORITHM_VERSION } from '../src/features/aria/aggregateMarkerScoresFromSlices';
import {
  buildRecalculationConsistencyPatch,
  aiReasoningContradictsAttemptVerdict,
} from '../src/features/aria/recalculationPersistConsistency';
import { normalizeGateFailDetailForPersist } from '../src/features/psychometrics/gateFailDetailForPersist';
import { recomputeAttemptForAnalytics, type RawAttemptForAnalytics } from './recomputeAttemptForAnalytics';
import { fetchUsersByIds } from './thresholdFlipAuditCore';

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
  disclosure_calibration, ai_reasoning, original_scores, recalculated_at,
  gate_result_finalized_at
`;

type Args = { dryRun: boolean; commit: boolean; since?: string; attemptId?: string; limit?: number };

function mergeEnv(): void {
  try {
    const path = join(process.cwd(), '.env');
    if (!existsSync(path)) return;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

function parseArgs(argv: string[]): Args {
  const out: Args = { dryRun: true, commit: false };
  for (const a of argv) {
    if (a === '--commit') {
      out.commit = true;
      out.dryRun = false;
    } else if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--since=')) out.since = a.slice('--since='.length);
    else if (a.startsWith('--attempt-id=')) out.attemptId = a.slice('--attempt-id='.length);
    else if (a.startsWith('--limit=')) out.limit = Number(a.slice('--limit='.length));
  }
  if (out.commit) out.dryRun = false;
  return out;
}

function narrativeMentionsStaleScore(aiReasoning: unknown, oldWeighted: number | null): boolean {
  if (oldWeighted == null || !aiReasoning || typeof aiReasoning !== 'object') return false;
  const text = JSON.stringify(aiReasoning);
  const target = oldWeighted.toFixed(1);
  const alt = String(oldWeighted);
  return text.includes(target) || text.includes(`score of ${alt}`) || text.includes(`score ${alt}`);
}

async function loadAttempts(sb: SupabaseClient, args: Args) {
  let q = sb
    .from('interview_attempts')
    .select(ATTEMPT_SELECT)
    .not('completed_at', 'is', null)
    .or('is_phantom.eq.false,is_phantom.is.null')
    .order('completed_at', { ascending: false });
  if (args.attemptId) q = q.eq('id', args.attemptId);
  if (args.since) q = q.gte('completed_at', args.since);
  if (args.limit) q = q.limit(args.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Array<Record<string, unknown>>;
}

async function main(): Promise<void> {
  mergeEnv();
  const args = parseArgs(process.argv.slice(2));
  const url = process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Missing Supabase env');
    process.exit(1);
  }
  const sb = createClient(url, key);
  const rows = await loadAttempts(sb, args);
  const userIds = [...new Set(rows.map((r) => String(r.user_id)))];
  const userById = await fetchUsersByIds(sb, userIds);

  const results: Record<string, unknown>[] = [];
  let gateFlips = 0;
  let reasoningQueued = 0;

  for (const row of rows) {
    const user = userById.get(String(row.user_id)) ?? null;
    const analytics = recomputeAttemptForAnalytics(row as RawAttemptForAnalytics, user);
    const oldWeighted = typeof row.weighted_score === 'number' ? row.weighted_score : null;
    const newWeighted = analytics.weighted_score;
    const oldPass = row.passed === true;
    const newPass = analytics.passed === true;
    const oldFinal = row.final_gate_pass === true;
    const newFinal = analytics.final_gate_pass === true;
    const passFlipped = oldPass !== newPass || oldFinal !== newFinal;
    const weightedDelta =
      oldWeighted != null && newWeighted != null ? Math.round((newWeighted - oldWeighted) * 10) / 10 : null;
    const needsReasoning =
      aiReasoningContradictsAttemptVerdict(row.ai_reasoning, newPass, newWeighted) ||
      narrativeMentionsStaleScore(row.ai_reasoning, oldWeighted) ||
      (weightedDelta != null && Math.abs(weightedDelta) >= 0.3);

    if (passFlipped) gateFlips += 1;
    if (needsReasoning) reasoningQueued += 1;

    const entry = {
      attemptId: row.id,
      userId: row.user_id,
      completedAt: row.completed_at,
      rollupAlgorithm: PILLAR_ROLLUP_ALGORITHM_VERSION,
      old: {
        weightedScore: oldWeighted,
        modifiedWeightedScore: row.modified_weighted_score,
        passed: oldPass,
        finalGatePass: oldFinal,
        pillarScores: row.pillar_scores,
      },
      new: {
        weightedScore: newWeighted,
        modifiedWeightedScore: analytics.modified_weighted_score,
        passed: newPass,
        finalGatePass: newFinal,
        pillarScores: analytics.pillar_scores,
        gateFailReasons: analytics.gate_fail_reasons,
      },
      weightedDelta,
      passFlipped,
      needsReasoningRegen: needsReasoning,
      recomputeNotes: analytics.recomputeNotes,
    };
    results.push(entry);

    if (args.commit && analytics.recomputeStatus === 'success') {
      const recalc = recalculateAttemptScoresFromStoredSlices(
        {
          transcript: row.transcript,
          scenario_1_scores: row.scenario_1_scores,
          scenario_2_scores: row.scenario_2_scores,
          scenario_3_scores: row.scenario_3_scores,
          scenario_specific_patterns: row.scenario_specific_patterns,
          ego_development_level: row.ego_development_level,
          language_markers: row.language_markers,
          skip_count: row.skip_count,
          skip_penalty_total: row.skip_penalty_total,
          auto_failed: row.auto_failed,
          defense_patterns: row.defense_patterns,
          mentalizing_overcertainty_count: row.mentalizing_overcertainty_count,
          moment_4_concreteness: row.moment_4_concreteness,
          moment_5_concreteness: row.moment_5_concreteness,
          disclosure_calibration: row.disclosure_calibration,
          personal_moment_emotional_vocab_density: row.personal_moment_emotional_vocab_density as number | null,
          personal_moment_emotional_vocab_low: row.personal_moment_emotional_vocab_low as boolean | null,
        },
        { skipScenarioTranscriptMutations: true, usePersistedGateContext: false },
      );
      if (recalc.kind !== 'success') continue;

      const snap = row.original_scores ? null : snapshotAttemptScoresForAudit(row);
      const delta = computePillarScoreDelta(
        (row.pillar_scores as Record<string, number>) ?? {},
        recalc.pillar_scores,
      );
      const reviewFlags = Array.isArray(row.review_flags) ? [...(row.review_flags as string[])] : [];
      if (passFlipped && !reviewFlags.includes('score_recompute_gate_flip')) {
        reviewFlags.push('score_recompute_gate_flip');
      }

      const passedAfterFloors =
        (recalc.gate.failReasonCodes ?? []).length === 0 ? recalc.gate.pass : false;
      const nowIso = new Date().toISOString();
      const consistencyPatch = buildRecalculationConsistencyPatch({
        attempt: row,
        newPassed: passedAfterFloors,
        newWeightedScore: recalc.gate.weightedScore,
        newPillarScores: recalc.pillar_scores,
        recalculatedAt: nowIso,
      });
      if (consistencyPatch.review_flags) {
        for (const flag of consistencyPatch.review_flags) {
          if (!reviewFlags.includes(flag)) reviewFlags.push(flag);
        }
      }

      const { error } = await sb
        .from('interview_attempts')
        .update({
          ...(snap ? { original_scores: snap } : {}),
          pillar_scores: recalc.pillar_scores,
          weighted_score: recalc.gate.weightedScore,
          modified_weighted_score: recalc.gate.modifiedWeightedScore,
          passed: passedAfterFloors,
          gate_fail_reasons: recalc.gate.failReasonCodes ?? [],
          gate_fail_detail: normalizeGateFailDetailForPersist(recalc.gate.failReasonDetail),
          scenario_composites: recalc.scenarioCompositesJson,
          recalculated_at: nowIso,
          recalculation_delta: delta,
          recalculation_notes: recalc.notes,
          review_flags: reviewFlags,
          ...(needsReasoning || consistencyPatch.reasoning_pending
            ? { reasoning_pending: true }
            : {}),
          ...(consistencyPatch.ai_reasoning != null ? { ai_reasoning: consistencyPatch.ai_reasoning } : {}),
          ...(consistencyPatch.final_gate_pass !== undefined
            ? { final_gate_pass: consistencyPatch.final_gate_pass }
            : { final_gate_pass: analytics.final_gate_pass }),
          moment_4_concreteness: recalc.moment_4_concreteness,
          moment_5_concreteness: recalc.moment_5_concreteness,
          depth_signal_modifier: recalc.gate.depthSignalModifier ?? recalc.gate.scoreModifier,
          score_modifier: recalc.gate.scoreModifier,
          disclosure_calibration: recalc.disclosure_calibration,
          modified_weighted_score_with_psychometrics: analytics.modified_weighted_score_with_psychometrics,
        })
        .eq('id', row.id)
        .eq('user_id', row.user_id);
      if (error) throw error;
    }
  }

  const outDir = join(process.cwd(), 'scripts', 'output');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'bulk-recompute-audit.json');
  writeFileSync(
    outPath,
    JSON.stringify(
      {
        dryRun: args.dryRun,
        committed: args.commit,
        rollupAlgorithm: PILLAR_ROLLUP_ALGORITHM_VERSION,
        since: args.since ?? null,
        scanned: results.length,
        gateFlips,
        reasoningQueued,
        results,
      },
      null,
      2,
    ),
  );
  console.log(`Wrote ${outPath}`);
  console.log(`Scanned ${results.length} attempts; gate flips ${gateFlips}; reasoning queued ${reasoningQueued}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
