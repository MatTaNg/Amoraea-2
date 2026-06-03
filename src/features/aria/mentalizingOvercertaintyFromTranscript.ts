/**
 * Transcript-aligned overcertainty detection when scenario/personal scorers omit
 * `mentalizing_overcertainty: true` (e.g. salvage / holistic recovery rows).
 * Keep regexes aligned with {@link MENTALIZING_OVERCERTAINTY_SCORING_INSTRUCTION}.
 */
import { userTurnTextForInterviewScenario } from './contemptExpressionScenarioHeuristic';

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

/** High-signal mind-reading / clinical verdict phrasing (subset of scorer MUST-FIRE list). */
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

/**
 * Slice order matches {@link aggregatePillarScoresWithCommitmentMergeDetailed}: S1, S2, S3, M4, M5.
 */
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
  if (typeof __DEV__ !== 'undefined' && __DEV__) return true;
  try {
    return typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_INTERVIEW_DEBUG_OVERCERTAINTY === '1';
  } catch {
    return false;
  }
}

/**
 * Counts scenario / personal moments where the slice is flagged by the scorer **or**
 * the user's transcript text for that slice matches overcertainty heuristics.
 */
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
