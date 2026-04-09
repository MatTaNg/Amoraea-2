/**
 * Node/tsx twin of `reprocess-narrative-conceptual-from-transcripts.ts` (Deno).
 * Use when `deno` is not installed (e.g. Windows): `npm run reprocess-narrative-conceptual`
 *
 * URL: SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL
 * Key: SUPABASE_SERVICE_ROLE_KEY (preferred) or EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY (dev-only fallback).
 * Prefer **non-EXPO_PUBLIC** service role — EXPO_PUBLIC_* can be bundled into client apps.
 *
 * Repo root: `npx tsx --env-file=.env scripts/reprocess-narrative-conceptual-from-transcripts.node.ts`
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  narrativeConceptualRatioFromCorpus,
  userTurnContentsFromInterviewTranscript,
} from '../supabase/functions/_shared/interviewStyleMarkers.ts';
import { styleProfileFromDbRow, translateStyleProfile } from '../supabase/functions/_shared/styleTranslations.ts';

function styleLabelsFromRow(
  row: Record<string, unknown>,
  opts?: { userCorpus?: string | null; userTurns?: string[] | null },
) {
  const t = translateStyleProfile(styleProfileFromDbRow(row), opts);
  return {
    style_labels_primary: t.primary,
    style_labels_secondary: t.secondary,
    matchmaker_summary: t.matchmaker_summary,
    low_confidence_note: t.low_confidence_note,
  };
}

/** Fills missing env from `.env` when `tsx --env-file` is unavailable (e.g. older Node). */
function mergeEnvFromDotenvFile(): void {
  try {
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
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      const cur = process.env[k];
      if (cur == null || cur === '') process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();

  const url =
    process.env.SUPABASE_URL?.trim() || process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || '';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    '';

  if (!url || !key) {
    console.error(
      'Missing Supabase env. Set in .env:\n' +
        '  - SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL\n' +
        '  - SUPABASE_SERVICE_ROLE_KEY (service_role JWT, not anon; optional dev fallback: EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY)',
    );
    process.exit(1);
  }

  const admin = createClient(url, key);

  const { data: profiles, error: pErr } = await admin
    .from('communication_style_profiles')
    .select('*')
    .not('source_attempt_id', 'is', null);
  if (pErr) {
    console.error(pErr.message);
    process.exit(1);
  }

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const row of profiles ?? []) {
    const r = row as Record<string, unknown>;
    const attemptId = r.source_attempt_id as string | undefined;
    if (!attemptId) {
      skip++;
      continue;
    }
    const { data: attempt, error: aErr } = await admin
      .from('interview_attempts')
      .select('transcript')
      .eq('id', attemptId)
      .maybeSingle();
    if (aErr || !attempt?.transcript) {
      skip++;
      continue;
    }
    const userTurns = userTurnContentsFromInterviewTranscript(attempt.transcript);
    const corpus = userTurns.join(' ').toLowerCase();
    const narrative_conceptual_score = narrativeConceptualRatioFromCorpus(corpus);

    const merged = { ...r, narrative_conceptual_score };
    const labels = styleLabelsFromRow(merged, { userCorpus: corpus, userTurns });

    const { error: upErr } = await admin
      .from('communication_style_profiles')
      .update({
        narrative_conceptual_score,
        ...labels,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', r.user_id as string);

    if (upErr) {
      console.error('update failed', r.user_id, upErr.message);
      fail++;
    } else {
      ok++;
    }
  }

  console.log(
    `reprocess-narrative-conceptual: ${ok} updated, ${skip} skipped, ${fail} failed, ${profiles?.length ?? 0} profiles with attempt id`,
  );
}

void main();
