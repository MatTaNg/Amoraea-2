/**
 * Keep aligned with `src/features/aria/mentalizingOvercertaintyFromTranscript.ts` (transcript heuristic
 * when stored `mentalizing_overcertainty` is false / missing).
 */
export type OvercertaintyTranscriptTurn = {
  role?: string;
  content?: string;
  scenarioNumber?: number | null;
  interviewMoment?: number | null;
};

export type OvercertaintySliceLike = {
  pillarScores?: Record<string, number | null> | null;
  keyEvidence?: Record<string, string> | null;
  mentalizing_overcertainty?: boolean | null;
  response_concreteness?: string | null;
  emotional_vocab_count?: number | null;
  emotional_vocab_words?: string[] | null;
  user_slice_word_count?: number | null;
} | null | undefined;

const OVERCERTAINTY_TEXT_RES: readonly RegExp[] = [
  /\bclearly doesn'?t care\b/i,
  /\bnever going to change\b/i,
  /\bthis is (?:just )?who (?:he|she|they)\b/i,
  /\b(?:definitely|clearly|obviously)\s+emotionally unavailable\b/i,
  /\b(?:a |the )?type of person who\b/i,
  /\bconflict[- ]?avoidant\b.{0,120}\b(?:probably|clearly)\b.{0,40}\battachment\b/i,
  /\b(?:probably|clearly)\b.{0,60}\bavoidant attachment\b/i,
  /\banxiously attached\b/i,
  /\bclassic anxious avoidant\b/i,
  /\bwill always come first\b/i,
  /\bdoesn'?t actually value\b/i,
  /\bmade (?:his|her|their) priorities obvious\b/i,
  /\bwho processes everything analytically and can'?t be present emotionally\b/i,
  /\bprobably has\b.{0,50}\bavoidant attachment\b/i,
  /\bnever going to\b.{0,40}\b(change|priorit)/i,
];

export function detectMentalizingOvercertaintyInUserText(raw: string): boolean {
  const t = (raw ?? '')
    .replace(/\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .trim();
  if (t.length < 16) return false;
  const lower = t.toLowerCase();
  for (const re of OVERCERTAINTY_TEXT_RES) {
    if (re.test(lower)) return true;
  }
  return false;
}

function normTypo(text: string): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** Mirrors `isScenarioCToPersonalHandoffAssistantContent` in app `probeAndScoringUtils`. */
function isScenarioCToPersonalHandoffAssistantContent(text: string): boolean {
  const t = normTypo(text).toLowerCase();
  const grudgeOrDislike =
    t.includes('held a grudge') ||
    (t.includes("really didn't like") && /\b(someone|your life|people)\b/.test(t));
  if (!grudgeOrDislike) return false;
  return (
    t.includes('three situations') ||
    t.includes("we've finished") ||
    t.includes('finished the three') ||
    t.includes('last two questions') ||
    t.includes('two questions are more personal') ||
    t.includes('only two questions') ||
    (t.includes('good work') && t.includes('three situations'))
  );
}

function sliceTranscriptBeforeScenarioCToPersonalHandoff<
  T extends { role: string; content?: string },
>(transcript: readonly T[]): T[] {
  let cut = transcript.length;
  for (let i = 0; i < transcript.length; i++) {
    const m = transcript[i];
    if (
      m.role === 'assistant' &&
      typeof m.content === 'string' &&
      isScenarioCToPersonalHandoffAssistantContent(m.content)
    ) {
      cut = i;
      break;
    }
  }
  return transcript.slice(0, cut) as T[];
}

function userTurnTextForInterviewScenario(
  transcript: Array<{ role?: string; content?: string; scenarioNumber?: number | null } | null | undefined> | null | undefined,
  scenarioNum: 1 | 2 | 3,
): string {
  if (!Array.isArray(transcript)) return '';
  const base = scenarioNum === 3 ? sliceTranscriptBeforeScenarioCToPersonalHandoff(transcript as { role: string; content?: string }[]) : transcript;
  return base
    .filter(
      (m): m is { role: string; content: string; scenarioNumber?: number | null } =>
        !!m &&
        m.role === 'user' &&
        m.scenarioNumber === scenarioNum &&
        typeof m.content === 'string',
    )
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join(' ');
}

export function joinUserTextForInterviewMoment(
  transcript: readonly OvercertaintyTranscriptTurn[] | null | undefined,
  moment: 4 | 5,
): string {
  if (!Array.isArray(transcript)) return '';
  return transcript
    .filter(
      (m): m is { role: string; content: string; interviewMoment?: number } =>
        !!m &&
        m.role === 'user' &&
        m.interviewMoment === moment &&
        typeof m.content === 'string',
    )
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join(' ');
}

export function userTextForMentalizingOvercertaintySlice(
  transcript: readonly OvercertaintyTranscriptTurn[] | null | undefined,
  sliceIndex: number,
): string {
  if (!Array.isArray(transcript) || sliceIndex < 0) return '';
  if (sliceIndex <= 2) {
    const sn = (sliceIndex + 1) as 1 | 2 | 3;
    return userTurnTextForInterviewScenario(transcript, sn);
  }
  if (sliceIndex === 3) return joinUserTextForInterviewMoment(transcript, 4);
  return joinUserTextForInterviewMoment(transcript, 5);
}

function overcertaintyDebugEnabled(): boolean {
  try {
    return Deno.env.get('INTERVIEW_DEBUG_OVERCERTAINTY') === '1';
  } catch {
    return false;
  }
}

export function countMentalizingOvercertaintyInMarkerSlices(
  slices: Array<OvercertaintySliceLike>,
  transcript?: readonly OvercertaintyTranscriptTurn[] | null,
): number {
  const debug = overcertaintyDebugEnabled() && Array.isArray(transcript) && transcript.length > 0;
  const modelFlags = slices.map((s) => s?.mentalizing_overcertainty === true);
  const modelOnlyCount = modelFlags.filter(Boolean).length;
  let n = 0;
  for (let i = 0; i < slices.length; i++) {
    const model = slices[i]?.mentalizing_overcertainty === true;
    const text = transcript ? userTextForMentalizingOvercertaintySlice(transcript, i) : '';
    const heuristic = Boolean(transcript && text.length > 0 && detectMentalizingOvercertaintyInUserText(text));
    const used = model || heuristic;
    if (used) n += 1;
    if (debug && heuristic && !model && text.length > 0) {
      console.log('[Overcertainty] heuristic-only slice', i, 'preview:', text.slice(0, 160).replace(/\s+/g, ' '));
    }
  }
  if (debug && n !== modelOnlyCount) {
    console.log('[Overcertainty] transcript heuristic adjusted count', {
      final: n,
      modelSliceFlagsOnly: modelOnlyCount,
      modelFlags,
    });
  }
  return n;
}

function truthyOvercertaintyField(raw: unknown): boolean {
  if (raw === true) return true;
  if (typeof raw === 'string') {
    const t = raw.trim().toLowerCase();
    return t === 'true' || t === 'yes' || t === '1';
  }
  return false;
}

function storedSliceOvercertaintyFlag(raw: unknown): boolean {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const o = raw as Record<string, unknown>;
  if (truthyOvercertaintyField(o.mentalizing_overcertainty)) return true;
  const ke = o.keyEvidence;
  if (ke && typeof ke === 'object' && !Array.isArray(ke)) {
    if (truthyOvercertaintyField((ke as Record<string, unknown>).mentalizing_overcertainty)) return true;
  }
  const sm = o.scoringMetadata;
  if (sm && typeof sm === 'object' && !Array.isArray(sm)) {
    if (truthyOvercertaintyField((sm as Record<string, unknown>).mentalizing_overcertainty)) return true;
  }
  return false;
}

export function mentalizingOvercertaintyCountFromAttemptRow(
  row: {
    scenario_1_scores?: unknown;
    scenario_2_scores?: unknown;
    scenario_3_scores?: unknown;
    scenario_specific_patterns?: unknown;
  },
  transcript?: readonly OvercertaintyTranscriptTurn[] | null,
): number {
  const patterns = row.scenario_specific_patterns;
  const m4 =
    patterns != null && typeof patterns === 'object' && !Array.isArray(patterns)
      ? (patterns as Record<string, unknown>).moment_4_scores
      : null;
  const m5 =
    patterns != null && typeof patterns === 'object' && !Array.isArray(patterns)
      ? (patterns as Record<string, unknown>).moment_5_scores
      : null;
  const slices: Array<OvercertaintySliceLike> = [
    { mentalizing_overcertainty: storedSliceOvercertaintyFlag(row.scenario_1_scores) },
    { mentalizing_overcertainty: storedSliceOvercertaintyFlag(row.scenario_2_scores) },
    { mentalizing_overcertainty: storedSliceOvercertaintyFlag(row.scenario_3_scores) },
    { mentalizing_overcertainty: storedSliceOvercertaintyFlag(m4) },
    { mentalizing_overcertainty: storedSliceOvercertaintyFlag(m5) },
  ];
  return countMentalizingOvercertaintyInMarkerSlices(slices, transcript ?? null);
}
