/**
 * Disclosure calibration for personal moments vs scenario responses (under / calibrated / over).
 * Duplicated from src/features/aria/disclosureCalibration.ts for Edge bundle.
 */

import { normalizeMoment4Concreteness, normalizeResponseConcreteness } from './personalMomentConcreteness.ts';

import { UNDERDISCLOSURE_RATIO_THRESHOLD } from '../../../src/config/scoring/disclosureLevels.ts';

export type DisclosureCalibrationTurn = {
  role?: string;
  content?: string;
  interviewMoment?: number;
};

export type DisclosureCalibration = 'underdisclosure' | 'calibrated' | 'overdisclosure';

const SUBSTANTIVE_PERSONAL_CONCRETENESS = new Set(['high', 'valid_non_applicable']);

/** Direct evidence of substantive personal disclosure — overrides low word-count ratio alone. */
export function isSubstantivePersonalMomentConcreteness(
  value: string | null | undefined,
): boolean {
  if (!value) return false;
  return SUBSTANTIVE_PERSONAL_CONCRETENESS.has(value.trim().toLowerCase());
}

/** Total user words in transcript turns tagged with `interviewMoment` (0 when none). */
export function sumUserWordsForInterviewMoment(
  transcript: readonly DisclosureCalibrationTurn[],
  moment: number,
): number {
  let sum = 0;
  for (const t of transcript) {
    if (t.role !== 'user' || t.interviewMoment !== moment) continue;
    const c = typeof t.content === 'string' ? t.content.trim() : '';
    if (!c) continue;
    sum += c.split(/\s+/).filter(Boolean).length;
  }
  return sum;
}

/** Mean total user word count across scenario interview moments 1–3 (0 when none tagged). */
export function computeAvgScenarioTotalUserWords(transcript: readonly DisclosureCalibrationTurn[]): number {
  const totals = [1, 2, 3].map((m) => sumUserWordsForInterviewMoment(transcript, m));
  const positive = totals.filter((x) => x > 0);
  if (positive.length === 0) return 0;
  return positive.reduce((a, b) => a + b, 0) / positive.length;
}

/** Personal-moment disclosure vs scenario length (same rules as client `disclosureCalibrationFromMarkerSlices`). */
export function disclosureCalibrationFromMarkerSlices(
  slices: Array<{
    response_concreteness?: string | null;
    user_slice_word_count?: number;
  } | null | undefined>,
  transcript: readonly DisclosureCalibrationTurn[] | null | undefined,
): DisclosureCalibration {
  const tx = Array.isArray(transcript) ? transcript : [];
  const m4c = normalizeMoment4Concreteness(slices[3]?.response_concreteness);
  const m5c = normalizeResponseConcreteness(slices[4]?.response_concreteness);
  const sliceWords = (w: unknown): number | null =>
    typeof w === 'number' && Number.isFinite(w) && w >= 0 ? w : null;
  const s4 = sumUserWordsForInterviewMoment(tx, 4);
  const s5 = sumUserWordsForInterviewMoment(tx, 5);
  const w4 = sliceWords(slices[3]?.user_slice_word_count) ?? (s4 > 0 ? s4 : null);
  const w5 = sliceWords(slices[4]?.user_slice_word_count) ?? (s5 > 0 ? s5 : null);
  const avgScenarioRaw = computeAvgScenarioTotalUserWords(tx);
  const avgScenarioForCalibration = avgScenarioRaw > 0 ? avgScenarioRaw : null;
  return computeDisclosureCalibration(m4c, m5c, w4, w5, avgScenarioForCalibration, tx);
}

export function personalMomentWordCountsForDisclosure(
  slices: Array<{ user_slice_word_count?: number | null } | null | undefined>,
  transcript: readonly DisclosureCalibrationTurn[] | null | undefined,
): { moment4WordCount: number | null; moment5WordCount: number | null } {
  const tx = Array.isArray(transcript) ? transcript : [];
  const sliceWords = (w: unknown): number | null =>
    typeof w === 'number' && Number.isFinite(w) && w >= 0 ? w : null;
  const s4 = sumUserWordsForInterviewMoment(tx, 4);
  const s5 = sumUserWordsForInterviewMoment(tx, 5);
  const m4 = slices[3];
  const m5 = slices[4];
  return {
    moment4WordCount: sliceWords(m4?.user_slice_word_count) ?? (s4 > 0 ? s4 : null),
    moment5WordCount: sliceWords(m5?.user_slice_word_count) ?? (s5 > 0 ? s5 : null),
  };
}

export function computeDisclosureCalibration(
  moment4Concreteness: string | null | undefined,
  moment5Concreteness: string | null | undefined,
  moment4WordCount: number | null,
  moment5WordCount: number | null,
  avgScenarioWordCount: number | null,
  transcript: readonly DisclosureCalibrationTurn[],
): DisclosureCalibration {
  console.log('[Disclosure] computeDisclosureCalibration called with:', {
    moment4Concreteness,
    moment5Concreteness,
    moment4WordCount,
    moment5WordCount,
    avgScenarioWordCount,
  });

  const clinicalTerms = ['abuse', 'assault', 'suicide', 'self-harm', 'hospitalization', 'trauma'];
  const personalText = transcript
    .filter((t) => t.role === 'user' && (t.interviewMoment === 4 || t.interviewMoment === 5))
    .map((t) => (typeof t.content === 'string' ? t.content : '').toLowerCase())
    .join(' ');
  const hasClinicalTerms = clinicalTerms.some((term) => personalText.includes(term));

  const avgPersonal =
    moment4WordCount != null && moment5WordCount != null ? (moment4WordCount + moment5WordCount) / 2 : null;
  const avgScenario =
    avgScenarioWordCount != null && Number.isFinite(avgScenarioWordCount) && avgScenarioWordCount > 0
      ? avgScenarioWordCount
      : null;

  const m4Long = (moment4WordCount ?? 0) > 400;
  const m5Long = (moment5WordCount ?? 0) > 400;

  if (hasClinicalTerms || m4Long || m5Long) {
    console.log('[Disclosure] returning:', 'overdisclosure', { m4Long, m5Long, hasClinicalTerms });
    return 'overdisclosure';
  }

  // A low word-count ratio alone is not sufficient evidence of underdisclosure — it
  // conflates general verbosity style with actual disclosure quality. A concise
  // communicator can give fully substantive personal answers that are still shorter
  // than their (more expansive) scenario answers. Require BOTH a low ratio AND
  // concreteness evidence of thinness before flagging underdisclosure. If either
  // moment is high or valid_non_applicable, treat as calibrated regardless of ratio —
  // confirmed real-world case: 131/148-word M4/M5 (valid_non_applicable/high) was
  // incorrectly flagged underdisclosure purely due to longer scenario answers (ratio 0.30).
  // Design: eitherSubstantive (one strong personal moment overrides) — consistent with
  // floor-and-bonus philosophy of not penalizing unless evidence of a real problem is clear.
  const eitherSubstantive =
    isSubstantivePersonalMomentConcreteness(moment4Concreteness) ||
    isSubstantivePersonalMomentConcreteness(moment5Concreteness);

  if (
    avgScenario != null &&
    avgPersonal != null &&
    avgPersonal < avgScenario * UNDERDISCLOSURE_RATIO_THRESHOLD &&
    !eitherSubstantive
  ) {
    console.log('[Disclosure] returning:', 'underdisclosure', {
      avgPersonal,
      avgScenario,
      ratio: avgPersonal / avgScenario,
      eitherSubstantive,
    });
    return 'underdisclosure';
  }

  console.log('[Disclosure] returning:', 'calibrated', { eitherSubstantive });
  return 'calibrated';
}

export type DetectOverdisclosureInput = {
  moment4WordCount: number | null;
  moment5WordCount: number | null;
  disclosureCalibration: string | null;
  moment4Concreteness: string | null;
  moment5Concreteness: string | null;
  vocabDensity: number | null;
};

export function detectOverdisclosure(input: DetectOverdisclosureInput): boolean {
  if (input.disclosureCalibration !== 'overdisclosure') return false;

  const m4Long = (input.moment4WordCount ?? 0) > 400;
  const m5Long = (input.moment5WordCount ?? 0) > 400;
  if (!m4Long && !m5Long) return false;

  const highVocab = (input.vocabDensity ?? 0) > 2.5;
  const bothConcrete =
    input.moment4Concreteness === 'high' || input.moment5Concreteness === 'high';

  return highVocab || bothConcrete;
}
