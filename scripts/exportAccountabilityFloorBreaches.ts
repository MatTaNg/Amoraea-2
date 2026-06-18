/**
 * Export accountability pillar-floor breach attempts for manual transcript review.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/exportAccountabilityFloorBreaches.ts
 *   npx tsx --env-file=.env scripts/exportAccountabilityFloorBreaches.ts --export
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GATE_MARKER_FLOORS } from '../src/features/aria/computeGateResultCore';
import { inferPersonalMomentSlices, type TranscriptTurn } from '../src/features/aria/personalMomentSlices';
import {
  isMoment5AssistantAnchor,
  looksLikeMoment5AccountabilityProbeAssistantPrompt,
} from '../src/features/aria/probeAndScoringUtils';
import { messagesForScenarioNumber } from '../src/features/aria/scenarioBTranscriptGates';
import { SCENARIO_COMPOSITE_PASS_MIN } from '../src/features/aria/scenarioCompositeFloor';
import {
  recomputeAttemptForAnalytics,
  type RawAttemptForAnalytics,
} from './recomputeAttemptForAnalytics';

const REFERENCE_ID_PREFIXES = ['86f783ed', '60eee704', '45590186'] as const;
const ACCOUNTABILITY_FLOOR = GATE_MARKER_FLOORS.accountability ?? 5.0;
const WEIGHTED_PASS_MIN = 6.5;

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
  pillar_scores,
  weighted_score,
  modified_weighted_score,
  final_gate_pass,
  passed,
  gate_fail_reasons,
  gate_fail_detail,
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

type ScenarioSlice = {
  pillarScores?: Record<string, number | null>;
  keyEvidence?: Record<string, string>;
  scoringMetadata?: Record<string, unknown>;
};

type TranscriptMsg = TranscriptTurn & {
  scenarioNumber?: number;
};

type ReviewRow = {
  id: string;
  shortId: string;
  isReference: boolean;
  completedAt: string;
  weightedScore: number | null;
  modifiedWeightedScore: number | null;
  finalGatePass: boolean | null;
  gateFailReasons: string[];
  floorBreachDetail: string;
  scenarioComposites: { s1: number | null; s2: number | null; s3: number | null };
  pillarScores: Record<string, number | null>;
  s1: ScenarioMomentExport;
  s2: ScenarioMomentExport;
  s3: ScenarioMomentExport;
  m5: ScenarioMomentExport & { probeFired: boolean; probeTriggerReason: string };
};

type ScenarioMomentExport = {
  question: string;
  response: string;
  accountabilityScore: number | null;
  evidence: string;
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

function parseArgs(argv: string[]): { exportMd: boolean } {
  return { exportMd: argv.includes('--export') };
}

function parseTranscript(raw: unknown): TranscriptMsg[] {
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

function parseScenarioSlice(raw: unknown): ScenarioSlice | null {
  const obj = parseJsonObject(raw);
  if (!obj) return null;
  const pillarRaw = obj.pillarScores ?? obj.pillar_scores;
  const keyRaw = obj.keyEvidence ?? obj.key_evidence;
  const metaRaw = obj.scoringMetadata ?? obj.scoring_metadata;
  const pillarScores =
    typeof pillarRaw === 'object' && pillarRaw != null && !Array.isArray(pillarRaw)
      ? (pillarRaw as Record<string, number | null>)
      : undefined;
  const keyEvidence =
    typeof keyRaw === 'object' && keyRaw != null && !Array.isArray(keyRaw)
      ? (keyRaw as Record<string, string>)
      : undefined;
  const scoringMetadata =
    typeof metaRaw === 'object' && metaRaw != null && !Array.isArray(metaRaw)
      ? (metaRaw as Record<string, unknown>)
      : undefined;
  if (!pillarScores && !keyEvidence) return null;
  return { pillarScores, keyEvidence, scoringMetadata };
}

function parseScenarioComposites(raw: unknown): { s1: number | null; s2: number | null; s3: number | null } {
  const obj = parseJsonObject(raw);
  if (!obj) return { s1: null, s2: null, s3: null };
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  return {
    s1: num(obj.scenario_1),
    s2: num(obj.scenario_2),
    s3: num(obj.scenario_3),
  };
}

function gateReasonsArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

function displayGateFailReasons(
  row: { gate_fail_reasons?: unknown },
  recomputed: ReturnType<typeof recomputeAttemptForAnalytics>,
): string[] {
  const reasons = gateReasonsArray(recomputed.gate_fail_reasons ?? row.gate_fail_reasons);
  if (reasons.length > 0) return reasons;
  const floorNote = recomputed.recomputeNotes.find((n) => n.includes('floor_breach'));
  if (floorNote) {
    const idx = floorNote.indexOf('floor_breach');
    return [idx >= 0 ? floorNote.slice(idx) : floorNote];
  }
  return [];
}

function finiteScore(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function formatScore(v: number | null): string {
  return v == null ? '—' : v.toFixed(2);
}

const SCENARIO_QUESTION_MARKERS: Record<1 | 2 | 3, RegExp[]> = {
  1: [/emma/i, /ryan/i, /mother.*(call|phone)/i, /date with/i],
  2: [/sarah/i, /james/i, /job hunt/i, /never feels appreciated/i],
  3: [/sophie/i, /daniel/i, /didn't know what to say/i, /avoiding this/i],
};

function extractScenarioAccountabilityQa(
  transcript: TranscriptMsg[],
  scenarioNum: 1 | 2 | 3,
  slice: ScenarioSlice | null,
): ScenarioMomentExport {
  const msgs = messagesForScenarioNumber(transcript, scenarioNum);
  const markers = SCENARIO_QUESTION_MARKERS[scenarioNum];
  const scenarioAssistant =
    msgs.find(
      (m) =>
        m.role === 'assistant' &&
        markers.some((re) => re.test(m.content ?? '')),
    ) ??
    msgs.find(
      (m) =>
        m.role === 'assistant' &&
        (m.content ?? '').trim().length > 40 &&
        !/^hi,?\s+i'?m amoraea/i.test((m.content ?? '').trim()),
    ) ??
    msgs.find((m) => m.role === 'assistant' && (m.content ?? '').trim());
  const question = scenarioAssistant?.content?.trim() || '(scenario question not found)';
  const response = msgs
    .filter((m) => m.role === 'user')
    .map((m) => (m.content ?? '').trim())
    .filter(Boolean)
    .join('\n\n');
  return {
    question,
    response: response || '(user response not found)',
    accountabilityScore: finiteScore(slice?.pillarScores?.accountability),
    evidence: slice?.keyEvidence?.accountability?.trim() || '(none)',
  };
}

function extractM5AccountabilityQa(
  transcript: TranscriptMsg[],
  m5Slice: ScenarioSlice | null,
  probeLog: unknown,
): ScenarioMomentExport & { probeFired: boolean; probeTriggerReason: string } {
  const { moment5 } = inferPersonalMomentSlices(transcript);

  let question = '(M5 question not found)';
  let probeQuestion = '';
  let probeFired = false;
  let probeTriggerReason = '(not detected)';

  const meta = m5Slice?.scoringMetadata ?? {};
  if (meta.accountabilityProbeFired === true) {
    probeFired = true;
    probeTriggerReason = 'scoringMetadata.accountabilityProbeFired=true';
  }
  if (meta.accountabilityProbeFiredOnAbstractFollowup === true) {
    probeFired = true;
    probeTriggerReason = 'abstract follow-up — accountability probe as alternate entry';
  }

  const probeFromLog = parseProbeLogAccountability(probeLog);
  if (probeFromLog.fired) {
    probeFired = true;
    if (probeFromLog.reason) probeTriggerReason = probeFromLog.reason;
  }

  let anchorIdx = -1;
  let probeIdx = -1;
  for (let i = 0; i < moment5.length; i++) {
    const m = moment5[i]!;
    if (m.role === 'assistant') {
      if (anchorIdx < 0 && isMoment5AssistantAnchor(m.content)) anchorIdx = i;
      if (looksLikeMoment5AccountabilityProbeAssistantPrompt(m.content)) {
        probeIdx = i;
        probeFired = true;
        if (probeTriggerReason === '(not detected)') {
          probeTriggerReason = 'scripted accountability probe in transcript';
        }
        probeQuestion = (m.content ?? '').trim();
      }
    }
  }

  if (anchorIdx >= 0) {
    question = (moment5[anchorIdx]!.content ?? '').trim() || question;
  }

  const responseParts: string[] = [];
  const startIdx = anchorIdx >= 0 ? anchorIdx + 1 : 0;
  const endIdx = probeIdx > anchorIdx ? probeIdx : moment5.length;
  for (let i = startIdx; i < endIdx; i++) {
    const m = moment5[i]!;
    if (m.role === 'user') {
      const c = (m.content ?? '').trim();
      if (c) responseParts.push(c);
    }
  }

  let response = responseParts.join('\n\n');
  if (probeFired && probeIdx >= 0) {
    const probeResponseParts: string[] = [];
    for (let i = probeIdx + 1; i < moment5.length; i++) {
      const m = moment5[i]!;
      if (m.role === 'assistant') break;
      if (m.role === 'user') {
        const c = (m.content ?? '').trim();
        if (c) probeResponseParts.push(c);
      }
    }
    if (probeQuestion) {
      response = [response, `[Probe] ${probeQuestion}`, probeResponseParts.join('\n\n')]
        .filter(Boolean)
        .join('\n\n');
    } else if (probeResponseParts.length > 0) {
      response = [response, probeResponseParts.join('\n\n')].filter(Boolean).join('\n\n');
    }
  }

  return {
    question,
    response: response || '(user response not found)',
    accountabilityScore: finiteScore(m5Slice?.pillarScores?.accountability),
    evidence: m5Slice?.keyEvidence?.accountability?.trim() || '(none)',
    probeFired,
    probeTriggerReason,
  };
}

function parseProbeLogAccountability(probeLog: unknown): { fired: boolean; reason: string } {
  if (!Array.isArray(probeLog)) return { fired: false, reason: '' };
  for (const entry of probeLog) {
    if (!entry || typeof entry !== 'object') continue;
    const o = entry as Record<string, unknown>;
    const probe = String(o.probe ?? o.kind ?? o.type ?? '').toLowerCase();
    const detail = String(o.reason ?? o.trigger ?? o.detail ?? '').trim();
    if (probe.includes('accountability')) {
      return { fired: true, reason: detail || 'probe_log accountability entry' };
    }
  }
  return { fired: false, reason: '' };
}

function accountabilityFloorBreachDetail(
  pillarScores: Record<string, number | null>,
  recomputeNotes: string[],
): string {
  const acc = finiteScore(pillarScores.accountability);
  if (acc != null && acc < ACCOUNTABILITY_FLOOR) {
    return `accountability (${acc.toFixed(1)})`;
  }
  const note = recomputeNotes.find((n) => n.includes('floor_breach') && n.includes('accountability'));
  if (note) return note.replace(/^[^:]+:\s*/, '');
  const failNote = recomputeNotes.find((n) => n.toLowerCase().includes('accountability'));
  return failNote ?? '(accountability floor breach — detail not found)';
}

function hasAccountabilityFloorSignal(
  row: RawAttemptForAnalytics & {
    gate_fail_reasons?: unknown;
    gate_fail_detail?: unknown;
    pillar_scores?: unknown;
  },
  recomputed: ReturnType<typeof recomputeAttemptForAnalytics>,
): boolean {
  const pillars = (recomputed.pillar_scores ?? {}) as Record<string, number | null>;
  const acc = finiteScore(pillars.accountability);
  if (acc != null && acc < ACCOUNTABILITY_FLOOR) return true;

  const reasons = gateReasonsArray(recomputed.gate_fail_reasons ?? row.gate_fail_reasons);
  const joined = reasons.join(' ').toLowerCase();
  if (joined.includes('accountability')) return true;

  const notesJoined = recomputed.recomputeNotes.join(' ').toLowerCase();
  if (notesJoined.includes('floor_breach') && notesJoined.includes('accountability')) return true;

  const detail = parseJsonObject(row.gate_fail_detail);
  if (detail) {
    const text = JSON.stringify(detail).toLowerCase();
    if (text.includes('accountability')) return true;
  }

  return false;
}

function scenarioCompositesPassing(composites: { s1: number | null; s2: number | null; s3: number | null }): boolean {
  const vals = [composites.s1, composites.s2, composites.s3].filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  if (vals.length === 0) return false;
  return vals.every((v) => v >= SCENARIO_COMPOSITE_PASS_MIN);
}

function matchesBroadPattern(
  row: RawAttemptForAnalytics & {
    weighted_score?: number | null;
    gate_fail_reasons?: unknown;
    gate_fail_detail?: unknown;
    pillar_scores?: unknown;
    scenario_composites?: unknown;
  },
  recomputed: ReturnType<typeof recomputeAttemptForAnalytics>,
): boolean {
  if (recomputed.recomputeStatus !== 'success') return false;

  const weighted = finiteScore(row.weighted_score) ?? finiteScore(recomputed.weighted_score);
  if (weighted == null || weighted < WEIGHTED_PASS_MIN) return false;

  const failReasons = gateReasonsArray(recomputed.gate_fail_reasons ?? row.gate_fail_reasons);
  if (failReasons.includes('scenario_floor')) return false;

  if (!hasAccountabilityFloorSignal(row, recomputed)) return false;

  const composites = parseScenarioComposites(recomputed.scenario_composites ?? row.scenario_composites);
  return scenarioCompositesPassing(composites);
}

function isReferenceId(id: string): boolean {
  const lower = id.toLowerCase();
  return REFERENCE_ID_PREFIXES.some((p) => lower.startsWith(p));
}

function renderMomentSection(label: string, moment: ScenarioMomentExport): string[] {
  return [
    `--- ${label} accountability evidence ---`,
    `Question: "${moment.question}"`,
    `User response: "${moment.response}"`,
    `Scored: accountability=${moment.accountabilityScore ?? '—'}`,
    `Evidence: "${moment.evidence}"`,
    '',
  ];
}

function renderReviewBlock(row: ReviewRow): string[] {
  const compositesOk =
    [row.scenarioComposites.s1, row.scenarioComposites.s2, row.scenarioComposites.s3].every(
      (v) => v == null || v >= SCENARIO_COMPOSITE_PASS_MIN,
    );
  const lines = [
    'ACCOUNTABILITY FLOOR BREACH REVIEW',
    '=====================================',
    `Attempt: ${row.id} | completed: ${formatDate(row.completedAt)}${row.isReference ? ' | REFERENCE' : ''}`,
    `weighted_score: ${formatScore(row.weightedScore)} | modified_weighted_score: ${formatScore(row.modifiedWeightedScore)} | final_gate_pass: ${row.finalGatePass === true ? 'true' : 'false'}`,
    `gate_fail_reasons: [${row.gateFailReasons.join(', ') || 'none'}]`,
    `Floor breach detail: ${row.floorBreachDetail}`,
    '',
    `Scenario composites: S1=${formatScore(row.scenarioComposites.s1)}, S2=${formatScore(row.scenarioComposites.s2)}, S3=${formatScore(row.scenarioComposites.s3)} (${compositesOk ? `all ≥ ${SCENARIO_COMPOSITE_PASS_MIN}` : 'check composites'})`,
    '',
    ...renderMomentSection('S1', row.s1),
    ...renderMomentSection('S2', row.s2),
    ...renderMomentSection('S3', row.s3),
    '--- M5 accountability evidence ---',
    `Question: "${row.m5.question}"`,
    `User response: "${row.m5.response}"`,
    `Scored: accountability=${row.m5.accountabilityScore ?? '—'}`,
    `Evidence: "${row.m5.evidence}"`,
    `Probe fired: ${row.m5.probeFired ? 'true' : 'false'} | Probe trigger reason: ${row.m5.probeTriggerReason}`,
    '',
    `Other pillar scores for context: mentalizing=${row.pillarScores.mentalizing ?? '—'}, repair=${row.pillarScores.repair ?? '—'}, contempt=${row.pillarScores.contempt ?? '—'}, regulation=${row.pillarScores.regulation ?? '—'}`,
    '',
  ];
  return lines;
}

function renderReport(rows: ReviewRow[]): string {
  const lines = [
    'ACCOUNTABILITY FLOOR BREACH EXPORT',
    '=================================',
    `Total matches: ${rows.length}`,
    `Reference IDs requested: ${REFERENCE_ID_PREFIXES.join(', ')}`,
    `Accountability floor: ${ACCOUNTABILITY_FLOOR} | Weighted pass min: ${WEIGHTED_PASS_MIN}`,
    '',
  ];
  for (const row of rows) {
    lines.push(...renderReviewBlock(row));
  }
  return lines.join('\n');
}

async function fetchCompletedAttempts(supabase: SupabaseClient): Promise<
  Array<
    RawAttemptForAnalytics & {
      weighted_score: number | null;
      modified_weighted_score: number | null;
      final_gate_pass: boolean | null;
      passed: boolean | null;
      gate_fail_reasons: unknown;
      gate_fail_detail: unknown;
      pillar_scores: unknown;
      scenario_composites: unknown;
    }
  >
> {
  const pageSize = 1000;
  const all: Array<
    RawAttemptForAnalytics & {
      weighted_score: number | null;
      modified_weighted_score: number | null;
      final_gate_pass: boolean | null;
      passed: boolean | null;
      gate_fail_reasons: unknown;
      gate_fail_detail: unknown;
      pillar_scores: unknown;
      scenario_composites: unknown;
    }
  > = [];
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

function buildReviewRow(
  row: RawAttemptForAnalytics & {
    weighted_score: number | null;
    modified_weighted_score: number | null;
    final_gate_pass: boolean | null;
    gate_fail_reasons: unknown;
    scenario_composites: unknown;
    probe_log: unknown;
    scenario_specific_patterns: unknown;
  },
  recomputed: ReturnType<typeof recomputeAttemptForAnalytics>,
  isReference: boolean,
): ReviewRow {
  const transcript = parseTranscript(row.transcript);
  const patterns = parseJsonObject(row.scenario_specific_patterns);
  const m5Slice = parseScenarioSlice(patterns?.moment_5_scores);

  const pillarScores = (recomputed.pillar_scores ?? {}) as Record<string, number | null>;
  const composites = parseScenarioComposites(recomputed.scenario_composites ?? row.scenario_composites);

  return {
    id: row.id,
    shortId: row.id.slice(0, 8),
    isReference,
    completedAt: row.completed_at,
    weightedScore: finiteScore(row.weighted_score) ?? finiteScore(recomputed.weighted_score),
    modifiedWeightedScore:
      finiteScore(row.modified_weighted_score) ?? finiteScore(recomputed.modified_weighted_score),
    finalGatePass: recomputed.final_gate_pass,
    gateFailReasons: displayGateFailReasons(row, recomputed),
    floorBreachDetail: accountabilityFloorBreachDetail(pillarScores, recomputed.recomputeNotes),
    scenarioComposites: composites,
    pillarScores,
    s1: extractScenarioAccountabilityQa(transcript, 1, parseScenarioSlice(row.scenario_1_scores)),
    s2: extractScenarioAccountabilityQa(transcript, 2, parseScenarioSlice(row.scenario_2_scores)),
    s3: extractScenarioAccountabilityQa(transcript, 3, parseScenarioSlice(row.scenario_3_scores)),
    m5: extractM5AccountabilityQa(transcript, m5Slice, row.probe_log),
  };
}

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
  const { exportMd } = parseArgs(process.argv.slice(2));

  const supabase = createAdminClient();
  const attempts = await fetchCompletedAttempts(supabase);
  const usersById = await fetchUsersByIds(
    supabase,
    attempts.map((a) => a.user_id),
  );

  const prevLog = console.log;
  console.log = () => {};
  const recomputedById = new Map(
    attempts.map((row) => [
      row.id,
      recomputeAttemptForAnalytics(row, usersById.get(row.user_id) ?? null),
    ]),
  );
  console.log = prevLog;

  const matched = new Map<string, ReviewRow>();

  for (const row of attempts) {
    const recomputed = recomputedById.get(row.id)!;
    const reference = isReferenceId(row.id);
    if (reference && recomputed.recomputeStatus === 'success' && hasAccountabilityFloorSignal(row, recomputed)) {
      matched.set(row.id, buildReviewRow(row, recomputed, true));
      continue;
    }
    if (matchesBroadPattern(row, recomputed)) {
      matched.set(row.id, buildReviewRow(row, recomputed, reference));
    }
  }

  const rows = [...matched.values()].sort((a, b) => {
    if (a.isReference !== b.isReference) return a.isReference ? -1 : 1;
    const refOrder = REFERENCE_ID_PREFIXES.map((p) => p.toLowerCase());
    const aIdx = refOrder.findIndex((p) => a.id.toLowerCase().startsWith(p));
    const bIdx = refOrder.findIndex((p) => b.id.toLowerCase().startsWith(p));
    if (aIdx >= 0 && bIdx >= 0 && aIdx !== bIdx) return aIdx - bIdx;
    return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
  });

  const missingRefs = REFERENCE_ID_PREFIXES.filter(
    (p) => !rows.some((r) => r.id.toLowerCase().startsWith(p)),
  );

  const report = renderReport(rows);
  const header =
    missingRefs.length > 0
      ? `WARNING: reference ID(s) not found or no accountability floor signal: ${missingRefs.join(', ')}\n\n`
      : '';

  if (exportMd) {
    const outDir = join(process.cwd(), 'scripts', 'output');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'accountability-floor-review.md');
    writeFileSync(outPath, header + report, 'utf8');
    console.log(`Wrote ${rows.length} accountability floor breach review(s) to ${outPath}`);
    if (missingRefs.length > 0) {
      console.log(`Missing references: ${missingRefs.join(', ')}`);
    }
  } else {
    if (missingRefs.length > 0) console.log(header);
    console.log(report);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
