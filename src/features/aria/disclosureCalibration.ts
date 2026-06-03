/**
 * Disclosure calibration for personal moments vs scenario responses (under / calibrated / over).
 */

export type DisclosureCalibrationTurn = {
  role?: string;
  content?: string;
  interviewMoment?: number;
};

export type DisclosureCalibration = 'underdisclosure' | 'calibrated' | 'overdisclosure';

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

  const bothAbsentOrLow =
    ['absent', 'low'].includes(moment4Concreteness ?? '') && ['absent', 'low'].includes(moment5Concreteness ?? '');

  const clinicalTerms = ['abuse', 'assault', 'suicide', 'self-harm', 'hospitalization', 'trauma'];
  const personalText = transcript
    .filter((t) => t.role === 'user' && (t.interviewMoment === 4 || t.interviewMoment === 5))
    .map((t) => (typeof t.content === 'string' ? t.content : '').toLowerCase())
    .join(' ');
  const hasClinicalTerms = clinicalTerms.some((term) => personalText.includes(term));

  const avgPersonal =
    moment4WordCount != null && moment5WordCount != null ? (moment4WordCount + moment5WordCount) / 2 : null;
  const avgScenario = avgScenarioWordCount ?? 0;

  const m4Long = (moment4WordCount ?? 0) > 400;
  const m5Long = (moment5WordCount ?? 0) > 400;

  if (hasClinicalTerms || m4Long || m5Long) {
    console.log('[Disclosure] returning:', 'overdisclosure', { m4Long, m5Long, hasClinicalTerms });
    return 'overdisclosure';
  }

  if (avgScenario > 0 && avgPersonal != null && avgPersonal < avgScenario * 0.4 && bothAbsentOrLow) {
    console.log('[Disclosure] returning:', 'underdisclosure');
    return 'underdisclosure';
  }

  if (avgPersonal == null && bothAbsentOrLow) {
    console.log('[Disclosure] returning:', 'underdisclosure');
    return 'underdisclosure';
  }

  console.log('[Disclosure] returning:', 'calibrated');
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

/**
 * Non-fatal `overdisclosure_review` — requires calibration + very long personal moment(s) + vocab or concreteness signal.
 */
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
