/**
 * Node/tsx twin of `reprocess-style-labels.ts` (Deno).
 * Use when `deno` is not installed (e.g. Windows).
 *
 * Repo root:
 *   npm run reprocess-style-labels
 *   npx tsx --env-file=.env scripts/reprocess-style-labels.node.ts
 *
 * URL: SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL
 * Key: SUPABASE_SERVICE_ROLE_KEY (preferred) or EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY (dev-only fallback).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
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
        '  - SUPABASE_SERVICE_ROLE_KEY (service_role JWT)',
    );
    process.exit(1);
  }

  const admin = createClient(url, key);

  const { data: rows, error: selErr } = await admin.from('communication_style_profiles').select('*');
  if (selErr) {
    console.error(selErr.message);
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;
  for (const row of rows ?? []) {
    const r = row as Record<string, unknown>;
    const attemptId = r.source_attempt_id as string | undefined;
    let transcriptOpts: Parameters<typeof translateStyleProfile>[1] | undefined;
    if (attemptId) {
      const { data: att } = await admin
        .from('interview_attempts')
        .select('transcript')
        .eq('id', attemptId)
        .maybeSingle();
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
}

void main();
