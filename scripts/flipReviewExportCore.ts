/**
 * Shared transcript + AI reasoning parsing/rendering for flip audit exports.
 */
import type { AIReasoningResult } from '../src/features/aria/generateAIReasoning';
import type { RawAttemptForAnalytics } from './recomputeAttemptForAnalytics';

export type TranscriptTurn = {
  role: string;
  content: string;
  interviewMoment?: number;
  scenarioNumber?: number;
};

export type ScoringEvidenceBlock = {
  label: string;
  pillarScores: Record<string, number | null>;
  keyEvidence: Record<string, string>;
};

export type FlipReviewContent = {
  transcript: TranscriptTurn[];
  aiReasoning: AIReasoningResult | null;
  aiReasoningRaw: Record<string, unknown> | null;
  reasoningPending: boolean;
  scoringEvidence: ScoringEvidenceBlock[];
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

export function parseTranscript(raw: unknown): TranscriptTurn[] {
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

export function parseJsonObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return typeof p === 'object' && p != null && !Array.isArray(p)
        ? (p as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return null;
}

export function parseAiReasoning(raw: unknown): AIReasoningResult | null {
  return parseJsonObject(raw) as AIReasoningResult | null;
}

type ScenarioSlice = {
  pillarScores?: Record<string, number | null>;
  keyEvidence?: Record<string, string>;
};

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

export function hasNarrativeContent(reasoning: AIReasoningResult | null): boolean {
  if (!reasoning) return false;
  if (typeof reasoning.overall_summary === 'string' && reasoning.overall_summary.trim()) return true;
  if (reasoning.construct_breakdown && Object.keys(reasoning.construct_breakdown).length > 0) {
    return true;
  }
  if (typeof reasoning.closing_reflection === 'string' && reasoning.closing_reflection.trim()) {
    return true;
  }
  return false;
}

export function extractScoringEvidence(row: RawAttemptForAnalytics): ScoringEvidenceBlock[] {
  const patterns = parseJsonObject(row.scenario_specific_patterns);
  const slices: Array<[string, unknown]> = [
    ['Scenario 1', row.scenario_1_scores],
    ['Scenario 2', row.scenario_2_scores],
    ['Scenario 3', row.scenario_3_scores],
    ['Moment 4', patterns?.moment_4_scores],
    ['Moment 5', patterns?.moment_5_scores],
  ];
  const out: ScoringEvidenceBlock[] = [];
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

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

export function formatScore(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '—' : v.toFixed(2);
}

export function renderTranscript(turns: TranscriptTurn[]): string[] {
  if (turns.length === 0) return ['(no transcript)', ''];
  const lines: string[] = [];
  for (const t of turns) {
    const role = t.role === 'user' ? 'USER' : t.role === 'assistant' ? 'Amoraea' : t.role.toUpperCase();
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
    ...Object.keys(breakdown).filter(
      (k) => !CONSTRUCT_ORDER.includes(k as (typeof CONSTRUCT_ORDER)[number]),
    ),
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
    if (data.what_happened?.trim()) {
      lines.push(`**What happened:** ${data.what_happened.trim()}`, '');
    }
    if (data.what_it_revealed?.trim()) {
      lines.push(`**What it revealed:** ${data.what_it_revealed.trim()}`, '');
    }
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

function renderScoringEvidence(evidence: ScoringEvidenceBlock[]): string[] {
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

export function renderAiReasoningSection(content: FlipReviewContent): string[] {
  const { aiReasoning, aiReasoningRaw, reasoningPending, scoringEvidence } = content;
  const lines = ['## AI narrative reasoning', ''];

  if (!hasNarrativeContent(aiReasoning)) {
    lines.push(
      reasoningPending || aiReasoningRaw?._reasoningPending === true
        ? '(Full Claude narrative was not generated for this attempt — gate blocked or queued.)'
        : aiReasoningRaw?._narrativeFailed === true
          ? '(Narrative generation failed or was not completed for this attempt.)'
          : '(No full narrative stored for this attempt.)',
      '',
    );
    lines.push(...renderAiReasoningMeta(aiReasoningRaw));
    lines.push(...renderScoringEvidence(scoringEvidence));
    return lines;
  }

  lines.push(...renderParagraph('Overall summary', aiReasoning!.overall_summary));
  lines.push(...renderStringList('Overall strengths', aiReasoning!.overall_strengths));
  lines.push(...renderStringList('Overall growth areas', aiReasoning!.overall_growth_areas));
  lines.push(...renderConstructBreakdown(aiReasoning!));
  lines.push(...renderScenarioObservations(aiReasoning!));
  lines.push(...renderParagraph('Cross-scenario patterns', aiReasoning!.cross_scenario_patterns));
  lines.push(...renderParagraph('Consistency note', aiReasoning!.consistency_note));
  lines.push(
    ...renderParagraph('Language and style observations', aiReasoning!.language_and_style_observations),
  );
  lines.push(
    ...renderParagraph('What a partner would experience', aiReasoning!.what_a_partner_would_experience),
  );
  lines.push(...renderParagraph('Readiness assessment', aiReasoning!.readiness_assessment));
  lines.push(...renderParagraph('Closing reflection', aiReasoning!.closing_reflection));
  return lines;
}
