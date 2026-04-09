/**
 * Audit `communication_style_profiles` rows with extreme `narrative_conceptual_score` (~0 or ~1).
 * Recomputes the score from `interview_attempts.transcript` (user turns) via
 * `narrativeConceptualRatioFromCorpus` and reports stored vs recomputed + marker counts.
 *
 * Use this after lexicon/direction fixes to find rows that still mismatch the source transcript.
 * To apply corrections for mismatches, run with `--fix` (same recompute + label refresh as full reprocess).
 *
 * Ops checklist (Prompt 5 / data hygiene):
 * - List extremes + mismatches: `npm run audit-narrative-conceptual-extremes`
 * - Patch scores + labels from transcripts: `npm run audit-narrative-conceptual-extremes -- --fix`
 * - Full recompute of narrative score from transcripts: `npm run reprocess-narrative-conceptual`
 * - Refresh denormalized chips/summary from current feature columns: `npm run reprocess-style-labels`
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 *   npm run audit-narrative-conceptual-extremes
 *   npm run audit-narrative-conceptual-extremes -- --fix
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  conceptualMarkerCount,
  narrativeConceptualRatioFromCorpus,
  normalizeInterviewStyleCorpus,
  storyMarkerCount,
  userTurnContentsFromInterviewTranscript,
} from '../supabase/functions/_shared/interviewStyleMarkers.ts';
import { styleProfileFromDbRow, translateStyleProfile } from '../supabase/functions/_shared/styleTranslations.ts';

const FIX = Deno.args.includes('--fix');
const EPS = 1e-5;

function styleLabelsFromRow(row: Record<string, unknown>) {
  const t = translateStyleProfile(styleProfileFromDbRow(row));
  return {
    style_labels_primary: t.primary,
    style_labels_secondary: t.secondary,
    matchmaker_summary: t.matchmaker_summary,
    low_confidence_note: t.low_confidence_note,
  };
}

function corpusFromTranscript(transcript: unknown): string {
  const arr = Array.isArray(transcript) ? transcript : [];
  const userTurns = arr
    .filter((m: Record<string, unknown>) => m?.role === 'user' && typeof m?.content === 'string')
    .map((m: Record<string, unknown>) => String(m.content).trim())
    .filter(Boolean);
  return userTurns.join(' ').toLowerCase();
}

const url = Deno.env.get('SUPABASE_URL')?.trim();
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  Deno.exit(1);
}

const admin = createClient(url, key);

const { data: extremesLo, error: eLo } = await admin
  .from('communication_style_profiles')
  .select('*')
  .lte('narrative_conceptual_score', 0.001);
const { data: extremesHi, error: eHi } = await admin
  .from('communication_style_profiles')
  .select('*')
  .gte('narrative_conceptual_score', 0.999);

if (eLo || eHi) {
  console.error(eLo?.message ?? eHi?.message);
  Deno.exit(1);
}

const byId = new Map<string, Record<string, unknown>>();
for (const r of [...(extremesLo ?? []), ...(extremesHi ?? [])]) {
  const row = r as Record<string, unknown>;
  const uid = String(row.user_id ?? '');
  if (uid) byId.set(uid, row);
}
const profiles = [...byId.values()];

let mismatch = 0;
let skipNoAttempt = 0;
let skipNoTranscript = 0;
let fixed = 0;
let failed = 0;

for (const row of profiles) {
  const userId = row.user_id as string;
  const stored = Number(row.narrative_conceptual_score ?? 0.5);
  const attemptId = row.source_attempt_id as string | null | undefined;

  if (!attemptId) {
    skipNoAttempt++;
    console.log(
      JSON.stringify({
        user_id: userId,
        status: 'SKIP_NO_SOURCE_ATTEMPT',
        stored_narrative_conceptual_score: stored,
      }),
    );
    continue;
  }

  const { data: attempt, error: aErr } = await admin.from('interview_attempts').select('transcript').eq('id', attemptId).maybeSingle();
  if (aErr || !attempt?.transcript) {
    skipNoTranscript++;
    console.log(
      JSON.stringify({
        user_id: userId,
        status: 'SKIP_NO_TRANSCRIPT',
        source_attempt_id: attemptId,
        stored_narrative_conceptual_score: stored,
      }),
    );
    continue;
  }

  const corpus = corpusFromTranscript(attempt.transcript);
  const norm = normalizeInterviewStyleCorpus(corpus);
  const story = storyMarkerCount(norm);
  const concept = conceptualMarkerCount(norm);
  const recomputed = narrativeConceptualRatioFromCorpus(corpus);
  const diff = Math.abs(stored - recomputed);

  const line = {
    user_id: userId,
    source_attempt_id: attemptId,
    stored_narrative_conceptual_score: Math.round(stored * 10000) / 10000,
    recomputed_narrative_conceptual_score: Math.round(recomputed * 10000) / 10000,
    story_marker_hits: story,
    conceptual_marker_hits: concept,
    corpus_char_count: corpus.length,
    scale_note: '0=conceptual pole, 1=narrative pole',
    mismatch: diff > EPS,
  };

  if (diff > EPS) mismatch++;

  if (diff > EPS && FIX) {
    const merged = { ...row, narrative_conceptual_score: recomputed };
    const userTurns = userTurnContentsFromInterviewTranscript(attempt.transcript);
    const labels = styleLabelsFromRow(merged, { userCorpus: corpus, userTurns });
    const { error: upErr } = await admin
      .from('communication_style_profiles')
      .update({
        narrative_conceptual_score: recomputed,
        ...labels,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId);
    if (upErr) {
      failed++;
      console.log(JSON.stringify({ ...line, status: 'UPDATE_FAILED', error: upErr.message }));
    } else {
      fixed++;
      console.log(JSON.stringify({ ...line, status: 'UPDATED' }));
    }
  } else {
    console.log(JSON.stringify({ ...line, status: diff > EPS ? 'MISMATCH_DRY_RUN' : 'OK' }));
  }
}

console.log(
  JSON.stringify({
    summary: {
      extreme_profiles: profiles.length,
      mismatch_with_recompute: mismatch,
      skip_no_source_attempt: skipNoAttempt,
      skip_no_transcript: skipNoTranscript,
      fix_mode: FIX,
      updated: fixed,
      update_failed: failed,
    },
  }),
);
