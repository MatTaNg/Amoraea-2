/**
 * Reconcile stale ai_reasoning / final_gate_pass after recalculation without re-scoring.
 *
 * Usage:
 *   npx tsx --import ./scripts/nodeRnStubs.mjs --env-file=.env scripts/reconcileRecalculatedAttemptConsistency.ts --scan
 *   npx tsx --import ./scripts/nodeRnStubs.mjs --env-file=.env scripts/reconcileRecalculatedAttemptConsistency.ts --attempt-id=a1b62285-... --commit
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  aiReasoningContradictsAttemptVerdict,
  buildRecalculationConsistencyPatch,
} from '../src/features/aria/recalculationPersistConsistency';

const ATTEMPT_SELECT =
  'id, user_id, completed_at, passed, weighted_score, pillar_scores, final_gate_pass, gate_result_finalized_at, ai_reasoning, reasoning_pending, review_flags';

type Args = {
  scan: boolean;
  commit: boolean;
  attemptId?: string;
  limit: number;
};

function mergeEnv(): void {
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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[k]) process.env[k] = v;
  }
}

function parseArgs(argv: string[]): Args {
  const out: Args = { scan: false, commit: false, limit: 500 };
  for (const a of argv) {
    if (a === '--scan') out.scan = true;
    else if (a === '--commit') out.commit = true;
    else if (a.startsWith('--attempt-id=')) out.attemptId = a.slice('--attempt-id='.length);
    else if (a.startsWith('--limit=')) out.limit = Number(a.slice('--limit='.length));
  }
  return out;
}

type AttemptRow = {
  id: string;
  user_id: string;
  completed_at: string | null;
  passed: boolean | null;
  weighted_score: number | null;
  pillar_scores: Record<string, number> | null;
  final_gate_pass: boolean | null;
  gate_result_finalized_at: string | null;
  ai_reasoning: unknown;
  reasoning_pending: boolean | null;
  review_flags: string[] | null;
};

async function loadAttempts(sb: SupabaseClient, args: Args): Promise<AttemptRow[]> {
  let q = sb
    .from('interview_attempts')
    .select(ATTEMPT_SELECT)
    .not('completed_at', 'is', null)
    .or('is_phantom.eq.false,is_phantom.is.null')
    .order('completed_at', { ascending: false });
  if (args.attemptId) q = q.eq('id', args.attemptId);
  if (args.limit) q = q.limit(args.limit);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AttemptRow[];
}

async function main(): Promise<void> {
  mergeEnv();
  const args = parseArgs(process.argv.slice(2));
  if (!args.scan && !args.attemptId) {
    console.error('Pass --scan and/or --attempt-id=<uuid>');
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Missing Supabase env');
    process.exit(1);
  }

  const sb = createClient(url, key);
  const rows = await loadAttempts(sb, args);
  const nowIso = new Date().toISOString();
  let mismatchCount = 0;
  let patchedCount = 0;

  for (const row of rows) {
    const contradicts = aiReasoningContradictsAttemptVerdict(
      row.ai_reasoning,
      row.passed,
      row.weighted_score,
    );
    const patch = buildRecalculationConsistencyPatch({
      attempt: row,
      newPassed: row.passed,
      newWeightedScore: row.weighted_score,
      newPillarScores: row.pillar_scores,
      recalculatedAt: nowIso,
    });
    const needsPatch =
      contradicts ||
      patch.ai_reasoning != null ||
      patch.final_gate_pass !== undefined ||
      patch.reasoning_pending === true;

    if (!needsPatch) continue;
    mismatchCount += 1;

    console.log(
      [
        row.id,
        `passed=${row.passed}`,
        `weighted=${row.weighted_score}`,
        `final_gate_pass=${row.final_gate_pass}`,
        contradicts ? 'ai_reasoning_mismatch' : 'consistency_patch',
      ].join(' | '),
    );

    if (!args.commit) continue;

    const reviewFlags = Array.isArray(row.review_flags) ? [...row.review_flags] : [];
    if (patch.review_flags) {
      for (const flag of patch.review_flags) {
        if (!reviewFlags.includes(flag)) reviewFlags.push(flag);
      }
    }

    const { error } = await sb
      .from('interview_attempts')
      .update({
        ...(patch.ai_reasoning != null ? { ai_reasoning: patch.ai_reasoning } : {}),
        ...(patch.reasoning_pending != null ? { reasoning_pending: patch.reasoning_pending } : {}),
        ...(patch.final_gate_pass !== undefined ? { final_gate_pass: patch.final_gate_pass } : {}),
        ...(patch.review_flags ? { review_flags: reviewFlags } : {}),
      })
      .eq('id', row.id)
      .eq('user_id', row.user_id);
    if (error) throw error;
    patchedCount += 1;
  }

  console.log('');
  console.log(
    args.commit
      ? `Patched ${patchedCount} / ${mismatchCount} inconsistent attempt(s) (scanned ${rows.length}).`
      : `Found ${mismatchCount} inconsistent attempt(s) (scanned ${rows.length}). Re-run with --commit to apply.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
