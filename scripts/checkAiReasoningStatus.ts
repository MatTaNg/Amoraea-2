/** Check ai_reasoning / reasoning_pending for specific or all completed attempts. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

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

const TARGET_IDS = [
  '721ef7f7-c311-48b2-9002-fdacf756f1de',
  '824326a2-3312-4d9c-85c2-c649dce9b146',
  '1ba58fff-c81f-47af-a786-73b91ec38cd4',
  'eb4c73fc-c715-4151-9f34-4f0a9532b2cb',
  'bb89a602-a382-462d-aca8-056a5e2c42fc',
];

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
  const url =
    process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Missing Supabase env');
    process.exit(1);
  }
  const sb = createClient(url, key);

  const { data: targets, error: targetErr } = await sb
    .from('interview_attempts')
    .select('id, completed_at, reasoning_pending, ai_reasoning')
    .in('id', TARGET_IDS);
  if (targetErr) throw targetErr;

  console.log('AI_REASONING STATUS — TARGET ATTEMPTS');
  console.log('=====================================');
  for (const id of TARGET_IDS) {
    const row = (targets ?? []).find((r) => r.id === id);
    if (!row) {
      console.log(`${id.slice(0, 8)}  NOT FOUND`);
      continue;
    }
    const ai = row.ai_reasoning as Record<string, unknown> | null;
    const hasSummary = typeof ai?.overall_summary === 'string' && ai.overall_summary.length > 0;
    const strengths = Array.isArray(ai?.overall_strengths) ? ai.overall_strengths.length : 0;
    console.log(
      `${id.slice(0, 8)}  pending=${row.reasoning_pending}  ai_reasoning=${ai ? 'present' : 'null'}  summary=${hasSummary}  strengths=${strengths}  completed=${row.completed_at?.slice(0, 10) ?? '—'}`,
    );
  }

  const { data: all, error: allErr } = await sb
    .from('interview_attempts')
    .select('id, reasoning_pending, ai_reasoning')
    .not('completed_at', 'is', null)
    .or('is_phantom.eq.false,is_phantom.is.null');
  if (allErr) throw allErr;

  const rows = all ?? [];
  const pending = rows.filter((r) => r.reasoning_pending === true).length;
  const withAi = rows.filter((r) => r.ai_reasoning != null).length;
  const withSummary = rows.filter((r) => {
    const ai = r.ai_reasoning as Record<string, unknown> | null;
    return typeof ai?.overall_summary === 'string' && ai.overall_summary.length > 0;
  }).length;

  console.log('');
  console.log('COHORT SUMMARY (all completed, non-phantom)');
  console.log(`  n=${rows.length}  reasoning_pending=true: ${pending}  ai_reasoning present: ${withAi}  with overall_summary: ${withSummary}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
