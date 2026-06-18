/**
 * Export readable samples of low/absent Moment 4 concreteness attempts for manual review.
 *
 * Recomputes moment_4_concreteness via the current aggregate algorithm.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/exportM4LowSamples.ts
 *   npx tsx --env-file=.env scripts/exportM4LowSamples.ts --limit 10
 *   npx tsx --env-file=.env scripts/exportM4LowSamples.ts --export
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  inferPersonalMomentSlices,
  type TranscriptTurn,
} from '../src/features/aria/personalMomentSlices';
import {
  looksLikeMoment4GrudgePrompt,
  looksLikeMoment4ThresholdQuestion,
  MOMENT_4_GRUDGE_QUESTION_TEXT,
} from '../src/features/aria/moment4ProbeLogic';
import {
  ANALYTICS_RECOMPUTE_ALGORITHM,
  recomputeAttemptForAnalytics,
  type RawAttemptForAnalytics,
} from './recomputeAttemptForAnalytics';

/** No deploy/cutoff constant in repo — classify from assistant question text instead. */
const M4_REWRITE_QUESTION_MARKERS = [
  'really hard time with',
  'got under your skin',
  'where things stand now',
] as const;

const ATTEMPT_SELECT = `
  id,
  user_id,
  completed_at,
  is_phantom,
  transcript,
  scenario_1_scores,
  scenario_2_scores,
  scenario_3_scores,
  scenario_specific_patterns,
  ego_development_level,
  language_markers,
  skip_count,
  skip_penalty_total,
  auto_failed,
  defense_patterns,
  mentalizing_overcertainty_count,
  personal_moment_emotional_vocab_density,
  personal_moment_emotional_vocab_low,
  review_flags,
  reasoning_pending,
  probe_log,
  moment_4_concreteness
`;

const USER_PSYCH_SELECT = `
  id,
  psychometrics_brs_score,
  psychometrics_brs_responses,
  psychometrics_anxiety_trait_score,
  psychometrics_anxiety_trait_responses,
  psychometrics_scs_sf_score,
  psychometrics_scs_sf_responses,
  psychometrics_gasp_score,
  psychometrics_gasp_responses,
  psychometrics_dweck_score,
  psychometrics_dweck_responses,
  psychometrics_aaq2_score,
  psychometrics_rses_score,
  psychometrics_aaq2_responses,
  psychometrics_rses_responses,
  psychometrics_scs_public_score,
  psychometrics_scs_private_score,
  psychometrics_sd3_narcissism_score,
  psychometrics_sd3_narcissism_responses,
  psychometrics_npi_entitlement_score,
  psychometrics_narq_s_score,
  psychometrics_narq_s_responses,
  psychometrics_rfq_score,
  psychometrics_rfq_responses,
  psychometrics_completed_at
`;

type Moment4Scores = {
  pillarScores?: Record<string, number | null>;
  keyEvidence?: Record<string, string>;
};

type SampleRow = {
  id: string;
  shortId: string;
  completedAt: string;
  concreteness: string;
  questionRewrite: 'post-rewrite' | 'pre-rewrite' | 'unknown';
  question: string;
  response: string;
  keyEvidenceSnippet: string;
  pillarLine: string;
};

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

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error(
      'Missing Supabase env. Set SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.',
    );
    process.exit(1);
  }
  return createClient(supabaseUrl, serviceKey);
}

function parseArgs(argv: string[]): { limit: number; exportMd: boolean } {
  const exportMd = argv.includes('--export');
  const limitArg = argv.find((a) => a.startsWith('--limit'));
  let limit = 20;
  if (limitArg) {
    const raw = limitArg.includes('=') ? limitArg.split('=')[1] : argv[argv.indexOf(limitArg) + 1];
    const n = Number.parseInt(String(raw ?? ''), 10);
    if (Number.isFinite(n) && n > 0) limit = n;
  }
  return { limit, exportMd };
}

function normalizeConcreteness(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  if (key === 'absent' || key === 'low' || key === 'moderate' || key === 'high') return key;
  return null;
}

function isLowAbsent(level: string): boolean {
  return level === 'absent' || level === 'low';
}

function parseTranscript(raw: unknown): TranscriptTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((m): m is Record<string, unknown> => m != null && typeof m === 'object')
    .map((m) => ({
      role: String(m.role ?? ''),
      content: typeof m.content === 'string' ? m.content : String(m.content ?? ''),
      interviewMoment:
        typeof m.interviewMoment === 'number' && Number.isFinite(m.interviewMoment)
          ? m.interviewMoment
          : undefined,
    }));
}

function classifyQuestionRewrite(question: string): SampleRow['questionRewrite'] {
  const t = question.toLowerCase();
  if (M4_REWRITE_QUESTION_MARKERS.some((marker) => t.includes(marker))) {
    return 'post-rewrite';
  }
  if (t.includes('held a grudge') || (t.includes('grudge') && t.includes('someone'))) {
    return 'pre-rewrite';
  }
  return 'unknown';
}

/** When the assistant turn includes S3→M4 handoff copy, keep only the grudge prompt paragraph. */
function extractGrudgeQuestionOnly(fullAssistantContent: string): string {
  const trimmed = fullAssistantContent.trim();
  if (!trimmed) return '(grudge question not found)';
  const paragraphs = trimmed.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  for (let i = paragraphs.length - 1; i >= 0; i--) {
    if (looksLikeMoment4GrudgePrompt(paragraphs[i])) return paragraphs[i];
  }
  return trimmed;
}

function extractM4GrudgeQa(transcript: TranscriptTurn[]): { question: string; response: string } {
  const { moment4 } = inferPersonalMomentSlices(transcript);
  if (moment4.length === 0) {
    return { question: '(M4 segment not found in transcript)', response: '(not found)' };
  }

  let grudgeIdx = moment4.findIndex(
    (m) => m.role === 'assistant' && looksLikeMoment4GrudgePrompt(m.content ?? ''),
  );
  if (grudgeIdx < 0) {
    grudgeIdx = moment4.findIndex((m) => m.role === 'assistant');
  }

  const questionRaw =
    grudgeIdx >= 0 ? (moment4[grudgeIdx].content ?? '').trim() : '(grudge question not found)';

  const question = extractGrudgeQuestionOnly(questionRaw);

  const responseParts: string[] = [];
  for (let i = grudgeIdx + 1; i < moment4.length; i++) {
    const m = moment4[i];
    if (m.role === 'assistant' && looksLikeMoment4ThresholdQuestion(m.content ?? '')) break;
    if (m.role === 'user') {
      const c = (m.content ?? '').trim();
      if (c) responseParts.push(c);
    }
  }

  return {
    question: question || '(grudge question not found)',
    response: responseParts.length > 0 ? responseParts.join('\n\n') : '(user response not found)',
  };
}

function parseMoment4Scores(raw: unknown): Moment4Scores | null {
  if (raw == null) return null;
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof obj !== 'object' || obj == null || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;
  const pillarRaw = o.pillarScores ?? o.pillar_scores;
  const keyRaw = o.keyEvidence ?? o.key_evidence;
  const pillarScores =
    typeof pillarRaw === 'object' && pillarRaw != null && !Array.isArray(pillarRaw)
      ? (pillarRaw as Record<string, number | null>)
      : undefined;
  const keyEvidence =
    typeof keyRaw === 'object' && keyRaw != null && !Array.isArray(keyRaw)
      ? (keyRaw as Record<string, string>)
      : undefined;
  if (!pillarScores && !keyEvidence) return null;
  return { pillarScores, keyEvidence };
}

function formatPillarLine(scores: Moment4Scores | null): string {
  if (!scores?.pillarScores) return '(none)';
  const ps = scores.pillarScores;
  const parts = [
    `mentalizing=${ps.mentalizing ?? '—'}`,
    `accountability=${ps.accountability ?? '—'}`,
    `contempt_expression=${ps.contempt_expression ?? ps.contempt ?? '—'}`,
  ];
  return parts.join(', ');
}

function keyEvidenceSnippet(scores: Moment4Scores | null): string {
  const ke = scores?.keyEvidence;
  if (!ke) return '(none)';
  const preferred =
    ke.mentalizing ??
    ke.accountability ??
    ke.contempt_expression ??
    ke.contempt ??
    ke.repair ??
    ke.regulation ??
    Object.values(ke).find((v) => typeof v === 'string' && v.trim().length > 0);
  return preferred?.trim() || '(none)';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function renderSampleBlock(row: SampleRow): string[] {
  return [
    `--- Attempt ${row.shortId} | ${formatDate(row.completedAt)} | concreteness: ${row.concreteness} | question: ${row.questionRewrite} ---`,
    `Question asked: "${row.question}"`,
    `User response: "${row.response}"`,
    `Scored evidence: "${row.keyEvidenceSnippet}"`,
    `Pillar scores: ${row.pillarLine}`,
    '',
  ];
}

function renderReport(totalLowAbsent: number, samples: SampleRow[]): string {
  const lines = [
    'M4 LOW/ABSENT CONCRETENESS SAMPLE',
    '===================================',
    `Total low/absent M4 attempts: ${totalLowAbsent}`,
    `(Showing ${samples.length} most recent; algorithm: ${ANALYTICS_RECOMPUTE_ALGORITHM})`,
    `Current canonical M4 question: "${MOMENT_4_GRUDGE_QUESTION_TEXT}"`,
    '',
  ];
  for (const row of samples) {
    lines.push(...renderSampleBlock(row));
  }
  return lines.join('\n');
}

async function fetchCompletedAttempts(supabase: SupabaseClient): Promise<RawAttemptForAnalytics[]> {
  const pageSize = 1000;
  const all: RawAttemptForAnalytics[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from('interview_attempts')
      .select(ATTEMPT_SELECT)
      .not('completed_at', 'is', null)
      .or('is_phantom.eq.false,is_phantom.is.null')
      .order('completed_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const batch = (data ?? []) as RawAttemptForAnalytics[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function fetchUsersByIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  const unique = [...new Set(userIds)];
  const chunkSize = 100;

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase.from('users').select(USER_PSYCH_SELECT).in('id', chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      map.set(String((row as { id: string }).id), row as Record<string, unknown>);
    }
  }

  return map;
}

function parseScenarioPatterns(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return typeof p === 'object' && p != null && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return null;
}

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
  const { limit, exportMd } = parseArgs(process.argv.slice(2));

  const supabase = createAdminClient();
  const rawAttempts = await fetchCompletedAttempts(supabase);
  const usersById = await fetchUsersByIds(
    supabase,
    rawAttempts.map((a) => a.user_id),
  );

  const lowAbsentRows: SampleRow[] = [];

  for (const row of rawAttempts) {
    const recomputed = recomputeAttemptForAnalytics(row, usersById.get(row.user_id) ?? null);
    const concreteness = normalizeConcreteness(recomputed.moment_4_concreteness);
    if (!concreteness || !isLowAbsent(concreteness)) continue;

    const transcript = parseTranscript(row.transcript);
    const { question, response } = extractM4GrudgeQa(transcript);
    const patterns = parseScenarioPatterns(row.scenario_specific_patterns);
    const m4Scores = parseMoment4Scores(patterns?.moment_4_scores);

    lowAbsentRows.push({
      id: row.id,
      shortId: row.id.slice(0, 8),
      completedAt: row.completed_at,
      concreteness,
      questionRewrite: classifyQuestionRewrite(question),
      question,
      response,
      keyEvidenceSnippet: keyEvidenceSnippet(m4Scores),
      pillarLine: formatPillarLine(m4Scores),
    });
  }

  lowAbsentRows.sort(
    (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
  );

  const total = lowAbsentRows.length;
  const samples = lowAbsentRows.slice(0, limit);
  const report = renderReport(total, samples);

  if (exportMd) {
    const outDir = join(process.cwd(), 'scripts', 'output');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'm4-low-samples.md');
    writeFileSync(outPath, report, 'utf8');
    console.log(`Wrote ${samples.length} of ${total} low/absent M4 samples to ${outPath}`);
  } else {
    console.log(report);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
