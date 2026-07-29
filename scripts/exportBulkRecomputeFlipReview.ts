/**
 * Export pass/fail flips from scripts/output/bulk-recompute-audit.json with user emails.
 *
 * Usage:
 *   npx tsx --import ./scripts/nodeRnStubs.mjs --env-file=.env scripts/exportBulkRecomputeFlipReview.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

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

async function main(): Promise<void> {
  mergeEnv();
  const auditPath = join(process.cwd(), 'scripts', 'output', 'bulk-recompute-audit.json');
  const audit = JSON.parse(readFileSync(auditPath, 'utf8')) as {
    rollupAlgorithm: string;
    results: Array<{
      passFlipped: boolean;
      userId: string;
      attemptId: string;
      completedAt: string;
      weightedDelta: number | null;
      old: {
        weightedScore: number | null;
        passed: boolean;
        finalGatePass: boolean;
      };
      new: {
        weightedScore: number | null;
        passed: boolean;
        finalGatePass: boolean;
        gateFailReasons?: string[];
      };
    }>;
  };

  const flipped = audit.results.filter((x) => x.passFlipped);
  const url = process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Missing Supabase env');
    process.exit(1);
  }
  const sb = createClient(url, key);

  const userIds = [...new Set(flipped.map((x) => x.userId))];
  const { data: users, error } = await sb.from('users').select('id, email').in('id', userIds);
  if (error) throw error;
  const emailById = new Map((users ?? []).map((u) => [String(u.id), String(u.email ?? '')]));

  const rows = flipped.map((x) => {
    const flipFields: string[] = [];
    if (x.old.passed !== x.new.passed) flipFields.push('passed');
    if (x.old.finalGatePass !== x.new.finalGatePass) flipFields.push('final_gate_pass');
    return {
      email: emailById.get(x.userId) ?? '(unknown)',
      userId: x.userId,
      attemptId: x.attemptId,
      completedAt: x.completedAt?.slice(0, 10) ?? '',
      oldWeighted: x.old.weightedScore,
      newWeighted: x.new.weightedScore,
      weightedDelta: x.weightedDelta,
      oldPassed: x.old.passed ? 'pass' : 'fail',
      newPassed: x.new.passed ? 'pass' : 'fail',
      oldFinalGate: x.old.finalGatePass ? 'pass' : 'fail',
      newFinalGate: x.new.finalGatePass ? 'pass' : 'fail',
      flipFields: flipFields.join(' + '),
      gateFailReasons: (x.new.gateFailReasons ?? []).join(', '),
    };
  });
  rows.sort((a, b) => a.email.localeCompare(b.email));

  const outDir = join(process.cwd(), 'scripts', 'output');
  mkdirSync(outDir, { recursive: true });
  const mdPath = join(outDir, 'bulk-recompute-flip-review.md');
  const csvPath = join(outDir, 'bulk-recompute-flip-review.csv');
  const jsonPath = join(outDir, 'bulk-recompute-flip-review.json');

  let md = `# Bulk recompute — pass/fail flips (n=${rows.length})\n\n`;
  md += `Algorithm: \`${audit.rollupAlgorithm}\`\n\n`;
  md += '| Email | Completed | Old W | New W | Δ W | Old passed | New passed | Old final | New final | Flip | New fail reasons |\n';
  md += '|---|---|---:|---:|---:|---|---|---|---|---|\n';
  for (const r of rows) {
    md += `| ${[
      r.email,
      r.completedAt,
      r.oldWeighted ?? '—',
      r.newWeighted ?? '—',
      r.weightedDelta ?? '—',
      r.oldPassed,
      r.newPassed,
      r.oldFinalGate,
      r.newFinalGate,
      r.flipFields,
      r.gateFailReasons || '—',
    ].join(' | ')} |\n`;
  }

  const csvHeader =
    'email,userId,attemptId,completedAt,oldWeighted,newWeighted,weightedDelta,oldPassed,newPassed,oldFinalGate,newFinalGate,flipFields,gateFailReasons\n';
  const csv =
    csvHeader +
    rows
      .map((r) =>
        [
          r.email,
          r.userId,
          r.attemptId,
          r.completedAt,
          r.oldWeighted ?? '',
          r.newWeighted ?? '',
          r.weightedDelta ?? '',
          r.oldPassed,
          r.newPassed,
          r.oldFinalGate,
          r.newFinalGate,
          r.flipFields,
          `"${(r.gateFailReasons || '').replace(/"/g, '""')}"`,
        ].join(','),
      )
      .join('\n');

  writeFileSync(mdPath, md);
  writeFileSync(csvPath, csv);
  writeFileSync(jsonPath, JSON.stringify(rows, null, 2));
  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${csvPath}`);
  console.log(`Wrote ${jsonPath}`);
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
