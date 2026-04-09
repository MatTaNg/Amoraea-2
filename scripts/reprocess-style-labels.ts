/**
 * Recompute style_labels_* and matchmaker_summary from feature columns using translateStyleProfile.
 * Run after migrations that change relational_individual_score semantics.
 *
 * Usage (repo root):
 *   npm run reprocess-style-labels   (Node/tsx — see reprocess-style-labels.node.ts)
 *   npm run reprocess-style-labels:deno   (requires Deno on PATH)
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or EXPO_PUBLIC_* in .env for the Node script)
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { userTurnContentsFromInterviewTranscript } from '../supabase/functions/_shared/interviewStyleMarkers.ts';
import {
  styleProfileFromDbRow,
  translateStyleProfile,
} from '../supabase/functions/_shared/styleTranslations.ts';
import {
  parseInterviewTranscriptMessages,
  splitUserCorpusScenarioVsPersonal,
  userTurnStringsScenarioMainAnalysis,
  userTurnStringsScenarioSegment,
} from '../supabase/functions/_shared/splitInterviewUserCorpus.ts';

const url = Deno.env.get('SUPABASE_URL')?.trim();
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  Deno.exit(1);
}

const admin = createClient(url, key);

const { data: rows, error: selErr } = await admin.from('communication_style_profiles').select('*');
if (selErr) {
  console.error(selErr.message);
  Deno.exit(1);
}

let ok = 0;
let fail = 0;
for (const row of rows ?? []) {
  const r = row as Record<string, unknown>;
  const attemptId = r.source_attempt_id as string | undefined;
  let transcriptOpts: Parameters<typeof translateStyleProfile>[1] | undefined;
  if (attemptId) {
    const { data: att } = await admin.from('interview_attempts').select('transcript').eq('id', attemptId).maybeSingle();
    if (att?.transcript) {
      const userTurns = userTurnContentsFromInterviewTranscript(att.transcript);
      const corpus = userTurns.join(' ').toLowerCase();
      if (corpus.length > 0) {
        const parsed = parseInterviewTranscriptMessages(att.transcript);
        const { scenarioCorpus, personalCorpus } = splitUserCorpusScenarioVsPersonal(parsed);
        const scenarioUserTurns = userTurnStringsScenarioSegment(parsed);
        const scenarioMainAnalysisUserTurns = userTurnStringsScenarioMainAnalysis(parsed);
        transcriptOpts = {
          userCorpus: corpus,
          userTurns,
          scenarioUserCorpus: scenarioCorpus.length > 0 ? scenarioCorpus : undefined,
          scenarioUserTurns: scenarioUserTurns.length > 0 ? scenarioUserTurns : undefined,
          scenarioMainAnalysisUserTurns:
            scenarioMainAnalysisUserTurns.length > 0 ? scenarioMainAnalysisUserTurns : undefined,
          personalUserCorpus: personalCorpus.length > 0 ? personalCorpus : undefined,
        };
      }
    }
  }
  const t = translateStyleProfile(styleProfileFromDbRow(r), transcriptOpts);
  const { error: upErr } = await admin
    .from('communication_style_profiles')
    .update({
      style_labels_primary: t.primary,
      style_labels_secondary: t.secondary,
      matchmaker_summary: t.matchmaker_summary,
      low_confidence_note: t.low_confidence_note,
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

console.log(`reprocess-style-labels: ${ok} ok, ${fail} failed, ${rows?.length ?? 0} total`);
