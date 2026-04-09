/**
 * Recompute narrative_conceptual_score from interview transcripts using the shared
 * story/concept lexicon (after lexicon updates), then refresh style label columns.
 *
 * Updates **every** profile with a non-null `source_attempt_id` (including rows that were
 * stuck at ~0 or ~1 from bad markers). Run after deploying `analyze-interview-text`.
 * To list only extreme scores vs recomputed first: `npm run audit-narrative-conceptual-extremes`.
 *
 * Usage (repo root): prefer Node (no Deno required):
 *   npm run reprocess-narrative-conceptual
 * Deno:
 *   npm run reprocess-narrative-conceptual:deno
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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

const url = Deno.env.get('SUPABASE_URL')?.trim();
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  Deno.exit(1);
}

const admin = createClient(url, key);

const { data: profiles, error: pErr } = await admin
  .from('communication_style_profiles')
  .select('*')
  .not('source_attempt_id', 'is', null);
if (pErr) {
  console.error(pErr.message);
  Deno.exit(1);
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
  const { data: attempt, error: aErr } = await admin.from('interview_attempts').select('transcript').eq('id', attemptId).maybeSingle();
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

console.log(`reprocess-narrative-conceptual: ${ok} updated, ${skip} skipped, ${fail} failed, ${profiles?.length ?? 0} profiles with attempt id`);
