/**
 * Part 1 + Part 3 diagnostic: Level tag leak and cap-function check.
 * Usage: npx tsx --env-file=.env scripts/diagnoseLevelTagLeak.ts
 */
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

const LEAK_STRING = 'Level tag missing';

type Slice = {
  pillarScores?: Record<string, number | null>;
  keyEvidence?: Record<string, string>;
};

function parseSlice(raw: unknown): Slice | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const pillarScores =
    (o.pillarScores as Record<string, number | null> | undefined) ??
    (o.pillar_scores as Record<string, number | null> | undefined);
  const keyEvidence =
    (o.keyEvidence as Record<string, string> | undefined) ??
    (o.key_evidence as Record<string, string> | undefined);
  if (!pillarScores && !keyEvidence) return null;
  return { pillarScores, keyEvidence };
}

function stripLeak(ev: string): string {
  return ev
    .split('|')
    .map((p) => p.trim())
    .filter((p) => !p.includes(LEAK_STRING) && !/^Ceiling \d+:/i.test(p) && !/Declared Level 1/i.test(p))
    .join(' | ')
    .trim();
}

function hasLeakInSlice(slice: Slice | null): boolean {
  if (!slice?.keyEvidence) return false;
  return Object.values(slice.keyEvidence).some((v) => typeof v === 'string' && v.includes(LEAK_STRING));
}

function countLeaksInAttempt(row: {
  scenario_1_scores: unknown;
  scenario_2_scores: unknown;
  scenario_3_scores: unknown;
}): number {
  let n = 0;
  for (const raw of [row.scenario_1_scores, row.scenario_2_scores, row.scenario_3_scores]) {
    const slice = parseSlice(raw);
    if (!slice?.keyEvidence) continue;
    for (const v of Object.values(slice.keyEvidence)) {
      if (typeof v === 'string' && v.includes(LEAK_STRING)) n += 1;
    }
  }
  return n;
}

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

  const { data: users, error: userErr } = await sb
    .from('users')
    .select('id, email')
    .or('email.ilike.%mattang%,email.ilike.%math%');
  if (userErr) throw userErr;

  console.log('USERS (Matt/Math):');
  for (const u of users ?? []) {
    console.log(`  ${u.id}  ${u.email ?? ''}`);
  }

  const userIds = (users ?? []).map((u) => u.id as string);
  if (userIds.length === 0) {
    console.log('No Matt/Math users found — widening to recent completed attempts with leaks.');
  }

  const { data: attempts, error: attErr } = await sb
    .from('interview_attempts')
    .select(
      'id, user_id, completed_at, transcript, scenario_1_scores, scenario_2_scores, scenario_3_scores, weighted_score',
    )
    .not('completed_at', 'is', null)
    .or('is_phantom.eq.false,is_phantom.is.null')
    .order('completed_at', { ascending: false })
    .limit(500);
  if (attErr) throw attErr;

  const rows = attempts ?? [];

  // Part 3: contamination count
  let contaminatedAttempts = 0;
  let contaminatedFields = 0;
  for (const row of rows) {
    const fieldCount = countLeaksInAttempt(row);
    if (fieldCount > 0) {
      contaminatedAttempts += 1;
      contaminatedFields += fieldCount;
    }
  }

  console.log('\nPART 3 — CONTAMINATION COUNT');
  console.log('============================');
  console.log(`Attempts scanned: ${rows.length}`);
  console.log(`Attempts with "${LEAK_STRING}": ${contaminatedAttempts}`);
  console.log(`Total keyEvidence fields contaminated: ${contaminatedFields}`);

  // Part 1: cap function check — mentalizing/attunement at 5-6 with leak or ceiling
  const capCandidates = rows.filter((row) => {
    for (const raw of [row.scenario_1_scores, row.scenario_2_scores, row.scenario_3_scores]) {
      const slice = parseSlice(raw);
      if (!slice?.pillarScores) continue;
      const m = slice.pillarScores.mentalizing;
      const a = slice.pillarScores.attunement;
      if (
        (typeof m === 'number' && m >= 4 && m <= 6) ||
        (typeof a === 'number' && a >= 4 && a <= 6)
      ) {
        return true;
      }
    }
    return false;
  });

  // Contaminated attempts detail
  console.log('\nCONTAMINATED ATTEMPTS (detail):');
  for (const row of rows) {
    const fieldCount = countLeaksInAttempt(row);
    if (fieldCount === 0) continue;
    const user = (users ?? []).find((u) => u.id === row.user_id);
    console.log(
      `  ${(row.id as string).slice(0, 8)}  user=${user?.email ?? row.user_id}  completed=${(row.completed_at as string)?.slice(0, 10)}  fields=${fieldCount}`,
    );
  }

  const focusRows = capCandidates
    .filter(
      (r) =>
        hasLeakInSlice(parseSlice(r.scenario_1_scores)) ||
        hasLeakInSlice(parseSlice(r.scenario_2_scores)) ||
        hasLeakInSlice(parseSlice(r.scenario_3_scores)),
    )
    .slice(0, 5);

  console.log('\nPART 1 — CAP FUNCTION CHECK (sample)');
  console.log('=====================================');

  for (const row of focusRows.slice(0, 5)) {
    const user = (users ?? []).find((u) => u.id === row.user_id);
    console.log(`\nAttempt ${(row.id as string).slice(0, 8)}  user=${user?.email ?? row.user_id}  completed=${(row.completed_at as string)?.slice(0, 10)}`);
    for (const [label, raw] of [
      ['S1', row.scenario_1_scores],
      ['S2', row.scenario_2_scores],
      ['S3', row.scenario_3_scores],
    ] as const) {
      const slice = parseSlice(raw);
      if (!slice?.pillarScores) continue;
      const m = slice.pillarScores.mentalizing;
      const a = slice.pillarScores.attunement;
      if (typeof m !== 'number' && typeof a !== 'number') continue;
      if (!((typeof m === 'number' && m >= 4 && m <= 6) || (typeof a === 'number' && a >= 4 && a <= 6))) {
        continue;
      }
      const mEv = slice.keyEvidence?.mentalizing ?? '';
      const aEv = slice.keyEvidence?.attunement ?? '';
      const mClean = stripLeak(mEv);
      const aClean = stripLeak(aEv);
      const mLevel = /^\s*Level\s*([12])/i.exec(mEv.trim())?.[1] ?? '(no tag)';
      const aLevel = /^\s*Level\s*([12])/i.exec(aEv.trim())?.[1] ?? '(no tag)';
      const hasLeak = mEv.includes(LEAK_STRING) || aEv.includes(LEAK_STRING);
      console.log(`  ${label}: mentalizing=${m} (tag=${mLevel}, leak=${hasLeak})`);
      if (mClean) console.log(`    m_evidence: ${mClean.slice(0, 220)}`);
      console.log(`  ${label}: attunement=${a} (tag=${aLevel})`);
      if (aClean) console.log(`    a_evidence: ${aClean.slice(0, 220)}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
