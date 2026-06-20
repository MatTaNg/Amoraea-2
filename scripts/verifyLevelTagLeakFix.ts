/**
 * Verify Level tag leak fix on stored attempt slices (read-only re-run of post-parse heuristic).
 * Usage: npx tsx --env-file=.env scripts/verifyLevelTagLeakFix.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { applyElaborationAbsencePenaltiesToScenarioScores } from '../src/features/aria/elaborationAbsencePenaltiesHeuristic';
import { userTurnTextForInterviewScenario } from '../src/features/aria/contemptExpressionScenarioHeuristic';

function mergeEnvFromDotenvFile(): void {
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
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

const LEAK = 'Level tag missing';

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
  const url = process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Missing Supabase env');
    process.exit(1);
  }
  const sb = createClient(url, key);

  const { data: attempts, error } = await sb
    .from('interview_attempts')
    .select('id, completed_at, transcript, scenario_1_scores, scenario_2_scores, scenario_3_scores')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(30);
  if (error) throw error;

  let checked = 0;
  let leaksAfterFix = 0;
  for (const row of attempts ?? []) {
    const transcript = (row.transcript ?? []) as Array<{
      role: string;
      content?: string;
      scenarioNumber?: number;
    }>;
    for (const [n, raw] of [
      [1, row.scenario_1_scores],
      [2, row.scenario_2_scores],
      [3, row.scenario_3_scores],
    ] as const) {
      const slice = raw as {
        pillarScores?: Record<string, number | null>;
        keyEvidence?: Record<string, string>;
      } | null;
      if (!slice?.pillarScores) continue;
      const userText = userTurnTextForInterviewScenario(transcript, n);
      const out = applyElaborationAbsencePenaltiesToScenarioScores(
        n,
        userText,
        slice.pillarScores,
        slice.keyEvidence ?? {},
        30,
      );
      checked += 1;
      for (const marker of ['mentalizing', 'attunement'] as const) {
        const ev = out.keyEvidence[marker] ?? '';
        if (ev.includes(LEAK)) leaksAfterFix += 1;
        if (!/^Level [12] —/.test(ev.trim())) {
          console.warn(`Missing Level prefix after fix: attempt ${String(row.id).slice(0, 8)} S${n} ${marker}: ${ev.slice(0, 80)}`);
        }
      }
    }
  }

  console.log(`Re-ran heuristic on ${checked} scenario slices from ${(attempts ?? []).length} recent attempts.`);
  console.log(`Leaks after fix: ${leaksAfterFix} (expect 0)`);
  if (leaksAfterFix > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
