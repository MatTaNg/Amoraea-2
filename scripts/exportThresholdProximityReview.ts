/**
 * Export transcripts + AI narrative reasoning for threshold-proximity cohort.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/exportThresholdProximityReview.ts
 *   npx tsx --env-file=.env scripts/exportThresholdProximityReview.ts --export
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AIReasoningResult } from '../src/features/aria/generateAIReasoning';
import { GATE_PASS_WEIGHTED_MIN } from '../src/features/aria/computeGateResultCore';
import {
  recomputeAttemptForAnalytics,
  type RawAttemptForAnalytics,
} from './recomputeAttemptForAnalytics';

const THRESHOLD = GATE_PASS_WEIGHTED_MIN;
const BELOW_MIN = 5.8;
const ABOVE_MAX = 7.0;
const TOP_N = 5;

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
  ai_reasoning,
  pillar_scores,
  weighted_score,
  modified_weighted_score,
  final_gate_pass,
  passed,
  gate_fail_reasons,
  scenario_composites
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

type TranscriptTurn = {
  role: string;
  content: string;
  interviewMoment?: number;
  scenarioNumber?: number;
};

type ScenarioSlice = {
  pillarScores?: Record<string, number | null>;
  keyEvidence?: Record<string, string>;
};

type CohortRow = {
  cohort: 'below' | 'above';
  userId: string;
  attemptId: string;
  completedAt: string;
  weighted: number;
  modified: number;
  modifiedPsych: number | null;
  interviewPass: boolean;
  finalPass: boolean;
  deltaFromThreshold: number;
  gateFailReasons: string[];
  pillarScores: Record<string, number | null>;
  transcript: TranscriptTurn[];
  aiReasoning: AIReasoningResult | null;
  aiReasoningRaw: Record<string, unknown> | null;
  reasoningPending: boolean;
  scoringEvidence: Array<{ label: string; pillarScores: Record<string, number | null>; keyEvidence: Record<string, string> }>;
};

const CONSTRUCT_ORDER = [
  'mentalizing',
  'accountability',
  'contempt',
  'repair',
  'regulation',
  'attunement',
  'appreciation',
  'commitment_threshold',
] as const;

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
      if (process.env[k] === undefined) process.env[k] = v;
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
    console.error('Missing Supabase env');
    process.exit(1);
  }
  return createClient(supabaseUrl, serviceKey);
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
      scenarioNumber:
        typeof m.scenarioNumber === 'number' && Number.isFinite(m.scenarioNumber)
          ? m.scenarioNumber
          : undefined,
    }));
}

function parseJsonObject(raw: unknown): Record<string, unknown> | null {
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

function parseAiReasoning(raw: unknown): AIReasoningResult | null {
  const obj = parseJsonObject(raw);
  return obj as AIReasoningResult | null;
}

function parseScenarioSlice(raw: unknown): ScenarioSlice | null {
  const obj = parseJsonObject(raw);
  if (!obj) return null;
  const pillarRaw = obj.pillarScores ?? obj.pillar_scores;
  const keyRaw = obj.keyEvidence ?? obj.key_evidence;
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

function hasNarrativeContent(reasoning: AIReasoningResult | null): boolean {
  if (!reasoning) return false;
  if (typeof reasoning.overall_summary === 'string' && reasoning.overall_summary.trim()) return true;
  if (reasoning.construct_breakdown && Object.keys(reasoning.construct_breakdown).length > 0) return true;
  if (typeof reasoning.closing_reflection === 'string' && reasoning.closing_reflection.trim()) return true;
  return false;
}

function extractScoringEvidence(row: RawAttemptForAnalytics): CohortRow['scoringEvidence'] {
  const patterns = parseJsonObject(row.scenario_specific_patterns);
  const slices: Array<[string, unknown]> = [
    ['Scenario 1', row.scenario_1_scores],
    ['Scenario 2', row.scenario_2_scores],
    ['Scenario 3', row.scenario_3_scores],
    ['Moment 4', patterns?.moment_4_scores],
    ['Moment 5', patterns?.moment_5_scores],
  ];
  const out: CohortRow['scoringEvidence'] = [];
  for (const [label, raw] of slices) {
    const slice = parseScenarioSlice(raw);
    if (!slice?.keyEvidence || Object.keys(slice.keyEvidence).length === 0) continue;
    out.push({
      label,
      pillarScores: slice.pillarScores ?? {},
      keyEvidence: slice.keyEvidence,
    });
  }
  return out;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function formatScore(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '—' : v.toFixed(2);
}

function renderTranscript(turns: TranscriptTurn[]): string[] {
  if (turns.length === 0) return ['(no transcript)', ''];
  const lines: string[] = [];
  for (const t of turns) {
    const role = t.role === 'user' ? 'USER' : t.role === 'assistant' ? 'ARIA' : t.role.toUpperCase();
    const meta: string[] = [];
    if (t.scenarioNumber != null) meta.push(`S${t.scenarioNumber}`);
    if (t.interviewMoment != null) meta.push(`M${t.interviewMoment}`);
    const prefix = meta.length ? `[${role} ${meta.join(' ')}]` : `[${role}]`;
    lines.push(`${prefix}`);
    lines.push(t.content.trim() || '(empty)');
    lines.push('');
  }
  return lines;
}

function renderParagraph(label: string, text: string | undefined): string[] {
  const t = text?.trim();
  if (!t) return [];
  return [`### ${label}`, '', t, ''];
}

function renderStringList(label: string, items: string[] | undefined): string[] {
  if (!items?.length) return [];
  const lines = [`### ${label}`, ''];
  for (const item of items) {
    const t = item?.trim();
    if (t) lines.push(`- ${t}`);
  }
  lines.push('');
  return lines;
}

function renderConstructBreakdown(reasoning: AIReasoningResult): string[] {
  const breakdown = reasoning.construct_breakdown;
  if (!breakdown || typeof breakdown !== 'object') return ['(no construct_breakdown)', ''];

  const lines = ['### Construct breakdown', ''];
  const keys = [
    ...CONSTRUCT_ORDER.filter((k) => breakdown[k]),
    ...Object.keys(breakdown).filter((k) => !CONSTRUCT_ORDER.includes(k as (typeof CONSTRUCT_ORDER)[number])),
  ];

  for (const key of keys) {
    const c = breakdown[key];
    if (!c || typeof c !== 'object') continue;
    const score =
      typeof c.score === 'number' && Number.isFinite(c.score) ? ` (score ${c.score})` : '';
    lines.push(`#### ${key}${score}`);
    if (c.headline?.trim()) lines.push(`**${c.headline.trim()}**`, '');
    const fields: Array<[string, string | undefined]> = [
      ['Summary', c.summary],
      ['What you did well', c.what_you_did_well],
      ['Where you struggled', c.where_you_struggled],
      ['Key pattern', c.key_pattern],
      ['Nuance and context', c.nuance_and_context],
      ['Growth edge', c.growth_edge],
    ];
    for (const [label, value] of fields) {
      const t = value?.trim();
      if (t) lines.push(`**${label}:** ${t}`, '');
    }
    lines.push('');
  }
  return lines;
}

function renderScenarioObservations(reasoning: AIReasoningResult): string[] {
  const obs = reasoning.scenario_observations;
  if (!obs || typeof obs !== 'object') return [];

  const lines = ['### Scenario observations', ''];
  for (const [key, data] of Object.entries(obs)) {
    if (!data || typeof data !== 'object') continue;
    const name = data.name?.trim() || key;
    lines.push(`#### ${name}`);
    if (data.what_happened?.trim()) lines.push(`**What happened:** ${data.what_happened.trim()}`, '');
    if (data.what_it_revealed?.trim()) lines.push(`**What it revealed:** ${data.what_it_revealed.trim()}`, '');
    if (Array.isArray(data.standout_moments) && data.standout_moments.length > 0) {
      lines.push('**Standout moments:**');
      for (const m of data.standout_moments) {
        const t = m?.trim();
        if (t) lines.push(`- ${t}`);
      }
      lines.push('');
    }
  }
  return lines;
}

function renderAiReasoningMeta(raw: Record<string, unknown> | null): string[] {
  if (!raw) return [];
  const lines: string[] = [];
  const note = typeof raw.note === 'string' ? raw.note.trim() : '';
  const incomplete = typeof raw.incomplete_reason === 'string' ? raw.incomplete_reason.trim() : '';
  const detail = typeof raw.detail === 'string' ? raw.detail.trim() : '';
  const lastError = typeof raw.last_error === 'string' ? raw.last_error.trim() : '';
  const flags = [
    raw._reasoningPending === true ? '_reasoningPending' : null,
    raw._completionHeld === true ? '_completionHeld' : null,
    raw._narrativeFailed === true ? '_narrativeFailed' : null,
    raw._generationFailed === true ? '_generationFailed' : null,
  ].filter((f): f is string => f != null);

  if (flags.length || note || incomplete || detail || lastError) {
    lines.push('### Stored reasoning status (no full narrative on file)', '');
    if (flags.length) lines.push(`**Flags:** ${flags.join(', ')}`, '');
    if (note) lines.push(note, '');
    if (incomplete) lines.push(`**Incomplete reason:** ${incomplete}`, '');
    if (detail) lines.push(`**Detail:** ${detail}`, '');
    if (lastError) lines.push(`**Last error:** ${lastError}`, '');
  }
  return lines;
}

function renderScoringEvidence(
  evidence: CohortRow['scoringEvidence'],
): string[] {
  if (evidence.length === 0) return [];
  const lines = [
    '### Scoring evidence (per-moment AI scorer notes)',
    '',
    'These are the stored keyEvidence strings from each scored slice — the closest on-file reasoning when narrative was not generated.',
    '',
  ];
  for (const block of evidence) {
    lines.push(`#### ${block.label}`);
    const scoreParts = Object.entries(block.pillarScores)
      .filter(([, v]) => v != null && Number.isFinite(v))
      .map(([k, v]) => `${k}=${v}`);
    if (scoreParts.length) lines.push(`**Scores:** ${scoreParts.join(', ')}`, '');
    for (const [marker, text] of Object.entries(block.keyEvidence)) {
      const t = text?.trim();
      if (!t) continue;
      lines.push(`**${marker}:** ${t}`, '');
    }
    lines.push('');
  }
  return lines;
}

function renderAiReasoning(
  reasoning: AIReasoningResult | null,
  raw: Record<string, unknown> | null,
  pending: boolean,
  scoringEvidence: CohortRow['scoringEvidence'],
): string[] {
  const lines = ['## AI narrative reasoning', ''];

  if (!hasNarrativeContent(reasoning)) {
    lines.push(
      pending || raw?._reasoningPending === true
        ? '(Full Claude narrative was not generated for this attempt — gate blocked or queued.)'
        : raw?._narrativeFailed === true
          ? '(Narrative generation failed or was not completed for this attempt.)'
          : '(No full narrative stored for this attempt.)',
      '',
    );
    lines.push(...renderAiReasoningMeta(raw));
    lines.push(...renderScoringEvidence(scoringEvidence));
    return lines;
  }

  lines.push(...renderParagraph('Overall summary', reasoning!.overall_summary));
  lines.push(...renderStringList('Overall strengths', reasoning.overall_strengths));
  lines.push(...renderStringList('Overall growth areas', reasoning.overall_growth_areas));
  lines.push(...renderConstructBreakdown(reasoning));
  lines.push(...renderScenarioObservations(reasoning));
  lines.push(...renderParagraph('Cross-scenario patterns', reasoning.cross_scenario_patterns));
  lines.push(...renderParagraph('Consistency note', reasoning.consistency_note));
  lines.push(
    ...renderParagraph('Language and style observations', reasoning.language_and_style_observations),
  );
  lines.push(
    ...renderParagraph('What a partner would experience', reasoning.what_a_partner_would_experience),
  );
  lines.push(...renderParagraph('Readiness assessment', reasoning.readiness_assessment));
  lines.push(...renderParagraph('Closing reflection', reasoning!.closing_reflection));
  return lines;
}

function renderUserBlock(row: CohortRow): string[] {
  const cohortLabel =
    row.cohort === 'below'
      ? `BELOW THRESHOLD (${BELOW_MIN}–${THRESHOLD})`
      : `ABOVE THRESHOLD AMONG PASSERS (${THRESHOLD}–${ABOVE_MAX})`;

  const pillars = row.pillarScores;
  const pillarLine = [
    `mentalizing=${pillars.mentalizing ?? '—'}`,
    `accountability=${pillars.accountability ?? '—'}`,
    `repair=${pillars.repair ?? '—'}`,
    `regulation=${pillars.regulation ?? '—'}`,
    `contempt=${pillars.contempt ?? '—'}`,
  ].join(', ');

  return [
    '# ' + cohortLabel,
  '',
    `**User:** ${row.userId} | **Attempt:** ${row.attemptId} | **Completed:** ${formatDate(row.completedAt)}`,
    `**weighted_score:** ${formatScore(row.weighted)} | **modified_weighted_score:** ${formatScore(row.modified)} | **psych-modified:** ${formatScore(row.modifiedPsych)} | **Δ from ${THRESHOLD}:** ${row.deltaFromThreshold >= 0 ? '+' : ''}${row.deltaFromThreshold.toFixed(2)}`,
    `**interview_pass:** ${row.interviewPass} | **final_gate_pass:** ${row.finalPass}`,
    `**gate_fail_reasons:** ${row.gateFailReasons.length ? row.gateFailReasons.join(', ') : 'none'}`,
    `**Pillar scores:** ${pillarLine}`,
    '',
    '## Full transcript',
    '',
    ...renderTranscript(row.transcript),
    ...renderAiReasoning(row.aiReasoning, row.aiReasoningRaw, row.reasoningPending, row.scoringEvidence),
    '---',
    '',
  ];
}

function renderReport(below: CohortRow[], above: CohortRow[]): string {
  const lines = [
    '# THRESHOLD PROXIMITY REVIEW',
    '',
    `Cohort: ${below.length + above.length} users closest to ${THRESHOLD} (latest algorithm recompute)`,
    `- ${below.length} from below (${BELOW_MIN}–${THRESHOLD})`,
    `- ${above.length} from above among passers (${THRESHOLD}–${ABOVE_MAX})`,
    '',
    '---',
    '',
  ];

  for (const row of below) lines.push(...renderUserBlock(row));
  for (const row of above) lines.push(...renderUserBlock(row));
  return lines.join('\n');
}

async function fetchCompletedAttempts(
  supabase: SupabaseClient,
): Promise<
  Array<
    RawAttemptForAnalytics & {
      ai_reasoning: unknown;
      pillar_scores: unknown;
      weighted_score: number | null;
      modified_weighted_score: number | null;
      final_gate_pass: boolean | null;
      passed: boolean | null;
      gate_fail_reasons: unknown;
      reasoning_pending: boolean | null;
    }
  >
> {
  const pageSize = 1000;
  const all: Array<
    RawAttemptForAnalytics & {
      ai_reasoning: unknown;
      pillar_scores: unknown;
      weighted_score: number | null;
      modified_weighted_score: number | null;
      final_gate_pass: boolean | null;
      passed: boolean | null;
      gate_fail_reasons: unknown;
      reasoning_pending: boolean | null;
    }
  > = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('interview_attempts')
      .select(ATTEMPT_SELECT)
      .not('completed_at', 'is', null)
      .or('is_phantom.eq.false,is_phantom.is.null')
      .order('completed_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as typeof all;
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
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { data, error } = await supabase.from('users').select(USER_PSYCH_SELECT).in('id', chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      map.set(String((row as { id: string }).id), row as Record<string, unknown>);
    }
  }
  return map;
}

function gateReasonsArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

function buildCohortRow(
  cohort: 'below' | 'above',
  row: RawAttemptForAnalytics & {
    ai_reasoning: unknown;
    reasoning_pending: boolean | null;
    gate_fail_reasons: unknown;
  },
  recomputed: ReturnType<typeof recomputeAttemptForAnalytics>,
): CohortRow | null {
  const modified = recomputed.modified_weighted_score;
  if (modified == null || !Number.isFinite(modified)) return null;

  return {
    cohort,
    userId: row.user_id,
    attemptId: row.id,
    completedAt: row.completed_at,
    weighted: recomputed.weighted_score ?? modified,
    modified,
    modifiedPsych: recomputed.modified_weighted_score_with_psychometrics,
    interviewPass: recomputed.passed === true,
    finalPass: recomputed.final_gate_pass === true,
    deltaFromThreshold: modified - THRESHOLD,
    gateFailReasons: gateReasonsArray(recomputed.gate_fail_reasons ?? row.gate_fail_reasons),
    pillarScores: (recomputed.pillar_scores ?? {}) as Record<string, number | null>,
    transcript: parseTranscript(row.transcript),
    aiReasoning: parseAiReasoning(row.ai_reasoning),
    aiReasoningRaw: parseJsonObject(row.ai_reasoning),
    reasoningPending: row.reasoning_pending === true,
    scoringEvidence: extractScoringEvidence(row),
  };
}

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
  const exportMd = process.argv.includes('--export');

  const supabase = createAdminClient();
  const raw = await fetchCompletedAttempts(supabase);
  const usersById = await fetchUsersByIds(
    supabase,
    raw.map((r) => r.user_id),
  );

  const prevLog = console.log;
  console.log = () => {};
  const enriched = raw.map((row) => ({
    row,
    recomputed: recomputeAttemptForAnalytics(row, usersById.get(row.user_id) ?? null),
  }));
  console.log = prevLog;

  const scorable = enriched.filter((e) => e.recomputed.recomputeStatus === 'success');

  const below = scorable
    .map((e) => buildCohortRow('below', e.row, e.recomputed))
    .filter((r): r is CohortRow => r != null)
    .filter((r) => r.modified >= BELOW_MIN && r.modified < THRESHOLD)
    .sort((a, b) => b.modified - a.modified)
    .slice(0, TOP_N);

  const above = scorable
    .map((e) => buildCohortRow('above', e.row, e.recomputed))
    .filter((r): r is CohortRow => r != null)
    .filter((r) => r.modified >= THRESHOLD && r.modified <= ABOVE_MAX && r.finalPass)
    .sort((a, b) => a.modified - b.modified)
    .slice(0, TOP_N);

  const report = renderReport(below, above);

  if (exportMd) {
    const outDir = join(process.cwd(), 'scripts', 'output');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'threshold-proximity-review.md');
    writeFileSync(outPath, report, 'utf8');
    console.log(`Wrote ${below.length + above.length} threshold proximity reviews to ${outPath}`);
  } else {
    console.log(report);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
