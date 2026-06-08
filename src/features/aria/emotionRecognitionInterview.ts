/** In-interview emotion identification (UI modals at scenario boundaries). */

import { isScenarioModalPureTransitionTurn } from './interviewLanguageGate';
import { assistantTextLooksLikeMoment4HandoffLead } from './interviewTransitionBundles';

export type PendingEmotionModalTransition = {
  completedScenario: 1 | 2 | 3;
  afterModal: string;
  transitionText: string;
  priorScenario: 1 | 2 | 3 | null;
};

const EMOTION_MODAL_CLOSING_QUESTION_PATTERNS = [
  'is there anything about that situation',
  "anything you'd want me to know",
  "anything about that situation you'd want me to know",
  "anything you'd want to add before we move on",
  'anything else about that one before',
  'before we move on',
  'before we move forward',
  "anything you'd want me to understand",
  'anything else about that one you',
  'before we go to the next one',
] as const;

function textIsEmotionModalClosingQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return EMOTION_MODAL_CLOSING_QUESTION_PATTERNS.some((p) => t.includes(p));
}

export const EMOTION_ITEM_CORRECT_ANSWERS = ['B', 'C', 'C'] as const;

export type EmotionInterviewChoice = 'A' | 'B' | 'C' | 'D';

export type EmotionInterviewModalItem = {
  question: string;
  choices: ReadonlyArray<{ letter: EmotionInterviewChoice; text: string }>;
};

export const EMOTION_INTERVIEW_MODAL_ITEMS: readonly EmotionInterviewModalItem[] = [
  {
    question:
      "Emma pays the bill and waits while Ryan finishes his call. What is Emma most likely feeling in that moment?",
    choices: [
      { letter: 'A', text: "Worried something serious has happened with Ryan's mother" },
      { letter: 'B', text: 'Dismissed and deprioritized' },
      { letter: 'C', text: 'Embarrassed to be sitting alone at the table' },
      { letter: 'D', text: 'Annoyed at the restaurant for the interruption' },
    ],
  },
  {
    question: 'Sarah tears up when James asks about her salary. What is Sarah most likely feeling?',
    choices: [
      { letter: 'A', text: 'Grateful James is being practical about the opportunity' },
      { letter: 'B', text: 'Embarrassed that she accepted a lower salary than expected' },
      {
        letter: 'C',
        text: 'Hurt that her excitement is being met with logistics instead of celebration',
      },
      { letter: 'D', text: 'Anxious about the new job responsibilities' },
    ],
  },
  {
    question:
      'Sophie calls after Daniel as he walks out the door. What is Sophie most likely feeling in that moment?',
    choices: [
      { letter: 'A', text: 'Relieved he is taking space to calm down' },
      { letter: 'B', text: 'Guilty for pushing him too hard' },
      { letter: 'C', text: 'Frustrated and scared the issue will never get resolved' },
      { letter: 'D', text: 'Indifferent to whether he comes back' },
    ],
  },
] as const;

/** Full in-interview emotion identification battery length (one item per scenario). */
export const EXPECTED_EMOTION_RECOGNITION_ITEMS = EMOTION_INTERVIEW_MODAL_ITEMS.length;

/** True when every modal index 0..2 has a non-empty answer. */
export function isEmotionRecognitionBatteryComplete(responses: readonly string[]): boolean {
  return countAnsweredEmotionItems(responses) >= EXPECTED_EMOTION_RECOGNITION_ITEMS;
}

export function normalizeEmotionResponseLetters(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) =>
      x == null || x === ''
        ? ''
        : typeof x === 'string'
          ? x.trim().toUpperCase()
          : String(x).trim().toUpperCase(),
    )
    .slice(0, EMOTION_INTERVIEW_MODAL_ITEMS.length);
}

/**
 * Compact sequential prefix from storage (legacy rows omit unanswered trailing items).
 * Full 3-slot arrays always keep index alignment — never compact-filter complete batteries.
 */
export function hydrateEmotionResponsesFromStorage(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length === EMOTION_INTERVIEW_MODAL_ITEMS.length) {
    return normalizeEmotionResponseLetters(raw);
  }
  return normalizeEmotionResponseLetters(raw).filter((s) => s.length > 0);
}

export function countAnsweredEmotionItems(responses: readonly string[]): number {
  let n = 0;
  for (let i = 0; i < EMOTION_INTERVIEW_MODAL_ITEMS.length; i++) {
    if (isEmotionItemAnsweredAt(responses, i)) n += 1;
  }
  return n;
}

/** Write answer at modal index (supports resume catch-up when earlier items were skipped). */
export function setEmotionResponseAtIndex(
  responses: readonly string[],
  index: number,
  letter: string,
): string[] {
  if (index < 0 || index >= EMOTION_INTERVIEW_MODAL_ITEMS.length) return [...responses];
  const normalized = letter.trim().toUpperCase();
  const next = [...responses];
  while (next.length < index) next.push('');
  if (next.length === index) {
    next.push(normalized);
  } else {
    next[index] = normalized;
  }
  return next;
}

/** Persist sequential answers from index 0; stops at first unanswered slot. */
export function compactEmotionResponsesForStorage(responses: readonly string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < EMOTION_INTERVIEW_MODAL_ITEMS.length; i++) {
    if (!isEmotionItemAnsweredAt(responses, i)) break;
    out.push(responses[i]!.trim().toUpperCase());
  }
  return out;
}

/** True when answered items are not exactly indices 0..n-1 (leading or internal gap). */
export function emotionResponsesNeedFixedSlots(responses: readonly string[]): boolean {
  const indices: number[] = [];
  for (let i = 0; i < EMOTION_INTERVIEW_MODAL_ITEMS.length; i++) {
    if (isEmotionItemAnsweredAt(responses, i)) indices.push(i);
  }
  if (indices.length === 0) return false;
  for (let j = 0; j < indices.length; j++) {
    if (indices[j] !== j) return true;
  }
  return false;
}

/** Compact when sequential from 0 and incomplete; fixed 3-slot when complete (preserves item index). */
export function emotionResponsesForStorage(
  responses: readonly string[],
): Array<string | null> | null {
  const answeredCount = countAnsweredEmotionItems(responses);
  if (answeredCount === 0) return null;
  if (isEmotionRecognitionBatteryComplete(responses)) {
    return Array.from({ length: EMOTION_INTERVIEW_MODAL_ITEMS.length }, (_, i) =>
      isEmotionItemAnsweredAt(responses, i) ? responses[i]!.trim().toUpperCase() : null,
    );
  }
  if (!emotionResponsesNeedFixedSlots(responses)) {
    return compactEmotionResponsesForStorage(responses);
  }
  return Array.from({ length: EMOTION_INTERVIEW_MODAL_ITEMS.length }, (_, i) =>
    isEmotionItemAnsweredAt(responses, i) ? responses[i]!.trim().toUpperCase() : null,
  );
}

/**
 * Count of correct emotion-identification answers (0–3).
 * `null` when the battery is incomplete — partial batteries must not produce scores.
 */
export function emotionRecognitionCorrectCountFromResponses(
  responses: readonly string[],
): 0 | 1 | 2 | 3 | null {
  if (!isEmotionRecognitionBatteryComplete(responses)) {
    const answeredCount = countAnsweredEmotionItems(responses);
    if (answeredCount > 0) {
      console.warn(
        '[EmotionRecognition] incomplete battery —',
        answeredCount,
        'of',
        EXPECTED_EMOTION_RECOGNITION_ITEMS,
        'responses recorded — nulling scores',
      );
    }
    return null;
  }
  let correct = 0;
  for (let i = 0; i < EMOTION_INTERVIEW_MODAL_ITEMS.length; i++) {
    if (
      isEmotionItemAnsweredAt(responses, i) &&
      responses[i]!.trim().toUpperCase() === EMOTION_ITEM_CORRECT_ANSWERS[i]
    ) {
      correct += 1;
    }
  }
  return correct as 0 | 1 | 2 | 3;
}

/** Proportion correct in [0, 1] — used by gate/modifier and legacy helpers. */
export function emotionRecognitionProportionFromResponses(responses: readonly string[]): number | null {
  const correct = emotionRecognitionCorrectCountFromResponses(responses);
  return correct === null ? null : correct / EMOTION_INTERVIEW_MODAL_ITEMS.length;
}

/**
 * Persisted `emotion_recognition_raw_score`: integer count of correct answers (0–3), not a proportion.
 */
export function emotionRecognitionRawScoreFromResponses(responses: readonly string[]): number | null {
  return emotionRecognitionCorrectCountFromResponses(responses);
}

/** True when `raw` is a stored integer correct-count (0–3), not a legacy fractional proportion. */
export function isStoredEmotionCorrectCount(raw: number): boolean {
  if (!Number.isFinite(raw)) return false;
  const rounded = Math.round(raw);
  return rounded === raw && rounded >= 0 && rounded <= EMOTION_INTERVIEW_MODAL_ITEMS.length;
}

/** Integer correct-count (0–3) from a stored raw field. */
export function storedEmotionCorrectCountFromRaw(raw: number | null): 0 | 1 | 2 | 3 | null {
  if (raw === null) return null;
  if (isStoredEmotionCorrectCount(raw)) return Math.round(raw) as 0 | 1 | 2 | 3;
  if (raw > 1 && raw <= EMOTION_INTERVIEW_MODAL_ITEMS.length) {
    return Math.round(raw) as 0 | 1 | 2 | 3;
  }
  return null;
}

/** Legacy fractional proportion in (0, 1), excluding integer counts. */
export function legacyEmotionProportionFromRaw(raw: number): number | null {
  if (storedEmotionCorrectCountFromRaw(raw) !== null) return null;
  if (raw === 0) return 0;
  if (raw > 0 && raw < 1) return raw;
  return null;
}

export function emotionResponsesUseFixedSlots(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false;
  return (
    raw.length === EMOTION_INTERVIEW_MODAL_ITEMS.length &&
    raw.some((x) => x == null || (typeof x === 'string' && x.trim() === ''))
  );
}

/** Persisted `emotion_recognition_score`: 0–100 percentage (e.g. 1/3 correct → 33). */
export function emotionRecognitionPercentScoreFromCorrectCount(correct: number): number {
  return Math.round((correct / EMOTION_INTERVIEW_MODAL_ITEMS.length) * 100);
}

/** Authoritative raw + display pair from per-index scoring — single source for persist. */
export function emotionRecognitionPersistScoresFromResponses(
  responses: readonly string[],
): { rawCount: 0 | 1 | 2 | 3; displayPercent: number } | null {
  const correctCount = emotionRecognitionCorrectCountFromResponses(responses);
  if (correctCount === null) return null;
  return {
    rawCount: correctCount,
    displayPercent: emotionRecognitionPercentScoreFromCorrectCount(correctCount),
  };
}

/** 0–100 display percent reconciled from stored integer raw count, then per-index responses. */
export function emotionRecognitionDisplayPercentFromAttemptsRow(row: {
  emotion_recognition_raw_score?: number | null;
  emotion_recognition_responses?: unknown;
  emotion_recognition_score?: number | null;
}): number | null {
  const rawField =
    typeof row.emotion_recognition_raw_score === 'number' &&
    Number.isFinite(row.emotion_recognition_raw_score)
      ? row.emotion_recognition_raw_score
      : null;
  const storedCount = storedEmotionCorrectCountFromRaw(rawField);
  if (storedCount !== null) {
    return emotionRecognitionPercentScoreFromCorrectCount(storedCount);
  }
  const hydrated =
    row.emotion_recognition_responses != null
      ? hydrateEmotionResponsesFromStorage(row.emotion_recognition_responses)
      : [];
  const fromResponses = isEmotionRecognitionBatteryComplete(hydrated)
    ? emotionRecognitionCorrectCountFromResponses(hydrated)
    : null;
  if (fromResponses !== null) {
    return emotionRecognitionPercentScoreFromCorrectCount(fromResponses);
  }
  const legacy = rawField !== null ? legacyEmotionProportionFromRaw(rawField) : null;
  if (legacy !== null) return Math.round(legacy * 100);
  const display =
    typeof row.emotion_recognition_score === 'number' && Number.isFinite(row.emotion_recognition_score)
      ? row.emotion_recognition_score
      : null;
  if (display === null) return null;
  if (display > 10) return Math.round(display);
  return Math.round((display / 10) * 100);
}

/** Map stored raw (correct-count 0–3, or legacy proportion in [0, 1]) to 0–100 display percent. */
export function emotionRecognitionDisplayScoreFromRaw(raw: number): number {
  if (!Number.isFinite(raw)) return 0;
  const stored = storedEmotionCorrectCountFromRaw(raw);
  if (stored !== null) return emotionRecognitionPercentScoreFromCorrectCount(stored);
  const legacy = legacyEmotionProportionFromRaw(raw);
  if (legacy !== null) return Math.round(legacy * 100);
  return Math.round(raw);
}

export type EmotionRecognitionPersistPayload = {
  emotion_recognition_responses: Array<string | null> | null;
  emotion_recognition_raw_score: number | null;
  emotion_recognition_score: number | null;
};

/** All ER DB fields null — incomplete batteries must not persist partial rows or scores. */
export function emptyEmotionRecognitionPersistPayload(): EmotionRecognitionPersistPayload {
  return {
    emotion_recognition_responses: null,
    emotion_recognition_raw_score: null,
    emotion_recognition_score: null,
  };
}

export function buildEmotionRecognitionPersistPayload(
  responses: readonly string[],
): EmotionRecognitionPersistPayload {
  const snap = [...responses].slice(0, EMOTION_INTERVIEW_MODAL_ITEMS.length);
  const answeredCount = countAnsweredEmotionItems(snap);
  const batteryComplete = isEmotionRecognitionBatteryComplete(snap);

  if (!batteryComplete) {
    if (answeredCount > 0) {
      console.warn(
        '[EmotionRecognition] Incomplete battery —',
        answeredCount,
        'of',
        EXPECTED_EMOTION_RECOGNITION_ITEMS,
        'items answered — not saving partial responses',
      );
    }
    return emptyEmotionRecognitionPersistPayload();
  }

  const storedResponses = emotionResponsesForStorage(snap);
  const scores = emotionRecognitionPersistScoresFromResponses(snap);
  if (scores == null) {
    return emptyEmotionRecognitionPersistPayload();
  }
  const { rawCount: raw, displayPercent: display } = scores;
  console.log('[EmotionModal] persist payload before database write:', {
    inMemoryResponses: snap,
    storedResponses,
    itemCount: storedResponses?.length ?? 0,
    answeredCount,
    correctCount: raw,
    emotion_recognition_raw_score: raw,
    emotion_recognition_score: display,
    isComplete: true,
  });
  return {
    emotion_recognition_responses: storedResponses,
    emotion_recognition_raw_score: raw,
    emotion_recognition_score: display,
  };
}

/** Spread into attempt row updates only when the battery is complete (avoids nulling partial rows). */
export function emotionRecognitionPersistSpreadIfComplete(
  responses: readonly string[],
): EmotionRecognitionPersistPayload | Record<string, never> {
  if (countAnsweredEmotionItems(responses) === 0) return {};
  if (!isEmotionRecognitionBatteryComplete(responses)) return {};
  return buildEmotionRecognitionPersistPayload(responses);
}

/** Sequential answers: index `i` is answered when the array has a letter at position `i`. */
export function isEmotionItemAnsweredAt(responses: readonly string[], index: number): boolean {
  if (index < 0 || index >= EMOTION_INTERVIEW_MODAL_ITEMS.length) return false;
  const letter = responses[index];
  return typeof letter === 'string' && letter.trim().length > 0;
}

/** Prefer the longest sequential prefix from any persisted source (attempt row, local storage). */
export function mergeEmotionResponses(
  ...sources: readonly (readonly string[])[]
): string[] {
  let best: string[] = [];
  for (const src of sources) {
    const norm = hydrateEmotionResponsesFromStorage(src);
    if (norm.length > best.length) best = norm;
  }
  return best;
}

/** Merge in-memory, local storage, and `interview_attempts.emotion_recognition_responses` shapes. */
export function hydrateEmotionResponsesFromSources(...sources: readonly unknown[]): string[] {
  let merged: string[] = [];
  for (const raw of sources) {
    merged = mergeEmotionResponses(merged, hydrateEmotionResponsesFromStorage(raw));
  }
  return merged;
}

/** Modal indices 0..throughScenario−1 that still need an answer. */
export function listUnansweredEmotionModalIndices(
  responses: readonly string[],
  throughScenario: 1 | 2 | 3,
): number[] {
  const maxIndex = Math.min(throughScenario - 1, EMOTION_INTERVIEW_MODAL_ITEMS.length - 1);
  const out: number[] = [];
  for (let i = 0; i <= maxIndex; i++) {
    if (!isEmotionItemAnsweredAt(responses, i)) out.push(i);
  }
  return out;
}

/** Emotion modal index for the scenario that just finished (S1 complete → 0, S2 → 1, S3 → 2). */
export function emotionModalIndexForCompletedScenario(completedScenario: 1 | 2 | 3): 0 | 1 | 2 {
  return (completedScenario - 1) as 0 | 1 | 2;
}

export function textContainsScenarioBVignetteBody(text: string): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  return (
    /sarah has been job hunting/.test(t) ||
    (/\bsarah\b/.test(t) &&
      /\bjames\b/.test(t) &&
      /job|hunting|offer|celebrate|appreciated|blindsided|deadline|salary/.test(t))
  );
}

export function textContainsScenarioCVignetteBody(text: string): boolean {
  const t = (text ?? '').trim().toLowerCase();
  if (!t) return false;
  return (
    /\bsophie and daniel\b/.test(t) &&
    /i need ten minutes/.test(t) &&
    (/i didn'?t know what to say|did not know what to say|i didn'?t know how|did not know how/.test(t) ||
      /\bstill upset\b/.test(t))
  );
}

/**
 * Models sometimes emit `[SCENARIO_COMPLETE:2]` when finishing Situation 1 (body introduces Sarah/James).
 * That would show the Scenario 2 emotion item at the start of Situation 2 instead of after it completes.
 */
export function reconcileCompletedScenarioForEmotionModal(params: {
  declaredComplete: 1 | 2 | 3;
  transitionText: string;
  priorScenario?: 1 | 2 | 3 | null;
}): 1 | 2 | 3 {
  const { declaredComplete, transitionText, priorScenario = null } = params;
  const hasS2 = textContainsScenarioBVignetteBody(transitionText);
  const hasS3 = textContainsScenarioCVignetteBody(transitionText);
  const hasM4 = assistantTextLooksLikeMoment4HandoffLead(transitionText);

  if (declaredComplete === 2 && hasS2 && !hasS3 && !hasM4) {
    return 1;
  }
  if (declaredComplete === 3 && hasS3 && !hasM4 && !hasS2) {
    return 2;
  }
  if (declaredComplete === 2 && hasM4 && !hasS3) {
    return 3;
  }

  if (priorScenario === 1 && hasS2 && !hasS3) return 1;
  if (priorScenario === 2 && hasS3 && !hasM4) return 2;
  if (priorScenario === 3 && hasM4) return 3;

  return declaredComplete;
}

/**
 * Transition copy usually introduces the *next* segment (S2/S3 vignette or M4 handoff).
 * The emotion modal is for the segment that just ended — infer from body before token/reconcile.
 */
export function completedScenarioForEmotionModalFromTransition(params: {
  declaredComplete: 1 | 2 | 3;
  transitionText: string;
  priorScenario?: 1 | 2 | 3 | null;
}): 1 | 2 | 3 {
  const { transitionText } = params;
  const hasS2 = textContainsScenarioBVignetteBody(transitionText);
  const hasS3 = textContainsScenarioCVignetteBody(transitionText);
  const hasM4 = assistantTextLooksLikeMoment4HandoffLead(transitionText);

  if (hasM4) return 3;
  if (hasS3) return 2;
  if (hasS2) return 1;

  return reconcileCompletedScenarioForEmotionModal(params);
}

export function scoreEmotionItems(responses: readonly string[]): number {
  return emotionRecognitionProportionFromResponses(responses) ?? 0;
}

/** Count of correct items (0–3). `null` when no answers or battery incomplete. */
export function emotionRecognitionCorrectCount(responses: readonly string[]): 0 | 1 | 2 | 3 | null {
  return emotionRecognitionCorrectCountFromResponses(responses);
}

/**
 * Gate / modifier input: returns null for incomplete batteries even when a stale stored raw score exists.
 * Prefer {@link emotionRecognitionResponses} when available.
 */
export function resolveEmotionRecognitionRawScoreForGate(params: {
  emotionRecognitionRawScore?: number | null;
  emotionRecognitionCorrectCount?: 0 | 1 | 2 | 3 | null;
  emotionRecognitionResponses?: unknown;
}): number | null {
  const hydrated =
    params.emotionRecognitionResponses != null
      ? hydrateEmotionResponsesFromStorage(params.emotionRecognitionResponses)
      : null;
  if (hydrated != null && !isEmotionRecognitionBatteryComplete(hydrated)) {
    console.warn(
      '[EmotionRecognition] incomplete battery —',
      countAnsweredEmotionItems(hydrated),
      'of',
      EXPECTED_EMOTION_RECOGNITION_ITEMS,
      'responses recorded — excluding from gate/modifier',
    );
    return null;
  }
  if (hydrated != null && isEmotionRecognitionBatteryComplete(hydrated)) {
    const fromResponses = emotionRecognitionProportionFromResponses(hydrated);
    if (fromResponses !== null) return fromResponses;
  }
  const r = params.emotionRecognitionRawScore;
  if (typeof r === 'number' && Number.isFinite(r)) {
    const stored = storedEmotionCorrectCountFromRaw(r);
    if (stored !== null) return stored / EMOTION_INTERVIEW_MODAL_ITEMS.length;
    const legacy = legacyEmotionProportionFromRaw(r);
    if (legacy !== null) return legacy;
    return null;
  }
  if (typeof r === 'string' && String(r).trim() !== '') {
    const n = Number(String(r).trim());
    if (!Number.isFinite(n)) return null;
    const stored = storedEmotionCorrectCountFromRaw(n);
    if (stored !== null) return stored / EMOTION_INTERVIEW_MODAL_ITEMS.length;
    const legacy = legacyEmotionProportionFromRaw(n);
    if (legacy !== null) return legacy;
    return null;
  }
  const c = params.emotionRecognitionCorrectCount;
  if (c === null || c === undefined) return null;
  if (typeof c === 'string' && String(c).trim() !== '') {
    const n = parseInt(String(c).trim(), 10);
    if (Number.isFinite(n) && n >= 0 && n <= 3) return n / EXPECTED_EMOTION_RECOGNITION_ITEMS;
  }
  if (typeof c === 'number' && Number.isFinite(c)) return c / EXPECTED_EMOTION_RECOGNITION_ITEMS;
  return null;
}

/** Attempts that failed solely on the removed emotion recognition hard floor (manual review). */
export function isLegacyEmotionRecognitionFloorOnlyFail(attempt: {
  passed?: boolean | null;
  weighted_score?: number | null;
  gate_fail_reasons?: unknown;
  weightedPassMin?: number;
}): boolean {
  if (attempt.passed !== false) return false;
  const ws = attempt.weighted_score;
  const min = attempt.weightedPassMin ?? 6.5;
  if (typeof ws !== 'number' || !Number.isFinite(ws) || ws < min) return false;
  const raw = attempt.gate_fail_reasons;
  if (!Array.isArray(raw)) return false;
  const codes = raw.filter((x): x is string => typeof x === 'string');
  return codes.length === 1 && codes[0] === 'emotion_recognition_floor';
}

export const LEGACY_EMOTION_RECOGNITION_FLOOR_REVIEW_NOTE =
  'Legacy fail — emotion recognition hard floor only (removed). Weighted score met threshold; manual override review recommended.';

/**
 * Client bundles use `\n\n` between the spoken transition lead and the next vignette / personal card.
 * Speak `beforeModal` first, show the emotion modal, then speak `afterModal` when non-empty.
 *
 * Model streams often omit `\n\n`; fall back to a line break before canonical vignette / handoff openers
 * so {@link splitScenarioTransitionForEmotionModal} still yields a non-empty `afterModal` when possible.
 */
/** Inline handoff openers when the model omits blank lines between wrap and next segment. */
const INLINE_EMOTION_MODAL_NEXT_SEGMENT_MARKERS: readonly RegExp[] = [
  /here'?s the next situation\s*:/i,
  /here'?s the third situation\s*:/i,
  /on to the second situation/i,
  /on to the third situation/i,
  /after this we(?:'|’)ll shift to something more personal/i,
  /before we shift to something more personal/i,
  /now we'?ll shift to something more personal/i,
  /now let'?s shift to something more personal/i,
  /there are only two questions left/i,
  /have you ever held a grudge/i,
  /\bhave you ever\b/i,
  /\bsarah has been job hunting\b/i,
  /\bsophie and daniel have had\b/i,
  /\bsophie and daniel\b/i,
];

export function splitScenarioTransitionForEmotionModal(fullText: string): {
  beforeModal: string;
  afterModal: string;
} {
  const t = fullText.trim();
  const ix = t.indexOf('\n\n');
  if (ix !== -1) {
    return { beforeModal: t.slice(0, ix).trim(), afterModal: t.slice(ix + 2).trim() };
  }
  /** First substantial line that starts the next segment (Situation 2/3 vignette or personal card). */
  const vignetteStart =
    /\n+(?=Sarah has been\b|Sophie and Daniel\b|There are only two questions left\b|Have you ever held a grudge\b|Personal reflection\b|Situation [23]\b)/i;
  const m = vignetteStart.exec(t);
  if (m != null && m.index >= 24) {
    return {
      beforeModal: t.slice(0, m.index).trim(),
      afterModal: t.slice(m.index).replace(/^\n+/, '').trim(),
    };
  }
  let inlineSplitAt = -1;
  for (const marker of INLINE_EMOTION_MODAL_NEXT_SEGMENT_MARKERS) {
    const inline = marker.exec(t);
    if (inline != null && inline.index >= 24) {
      inlineSplitAt = inlineSplitAt < 0 ? inline.index : Math.min(inlineSplitAt, inline.index);
    }
  }
  if (inlineSplitAt >= 0) {
    return {
      beforeModal: t.slice(0, inlineSplitAt).trim(),
      afterModal: t.slice(inlineSplitAt).trim(),
    };
  }
  return { beforeModal: t, afterModal: '' };
}

/**
 * Defer the emotion modal when the transition turn still owes an in-scenario answer
 * (e.g. repair-as-James bundled with S2→S3 handoff). Closing-question turns defer to the
 * closing-answer intercept; pure wrap transitions run the modal immediately.
 */
export function shouldDeferEmotionModalForTransitionText(transitionText: string): boolean {
  const t = (transitionText ?? '').trim();
  if (!t) return false;
  if (textIsEmotionModalClosingQuestion(t)) return true;

  const { beforeModal } = splitScenarioTransitionForEmotionModal(t);
  const before = beforeModal.trim();
  if (!before) return false;
  if (textIsEmotionModalClosingQuestion(before)) return true;
  if (isScenarioModalPureTransitionTurn(before)) return false;
  if (before.includes('?')) return true;

  return false;
}

/**
 * Natural-language S1→S2 / S2→S3 handoffs (no `[SCENARIO_COMPLETE:N]`).
 * Parallel streaming may advance `currentScenarioRef` before the post-stream handler runs.
 */
export function isNaturalLanguageScenarioHandoffTransition(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t || t.length < 48) return false;
  const lower = t.toLowerCase();
  const hasWrapPhrase =
    lower.includes("that's the end of this scenario") ||
    lower.includes('end of the three described situations') ||
    lower.includes("that's a wrap on this situation") ||
    (lower.includes("that's a wrap") && /\bgreat work\b/i.test(lower)) ||
    lower.includes('great work getting through all of this');
  if (!hasWrapPhrase) return false;
  return (
    INLINE_EMOTION_MODAL_NEXT_SEGMENT_MARKERS.some((re) => re.test(t)) ||
    textContainsScenarioBVignetteBody(t) ||
    textContainsScenarioCVignetteBody(t) ||
    assistantTextLooksLikeMoment4HandoffLead(t)
  );
}

/** S3 complete → Moment 4 personal card (no `detectScenarioFromResponse` — M4 is not scenario 4). */
export function isScenarioThreeToMoment4EmotionModalHandoff(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  return (
    lower.includes('end of the three described situations') ||
    assistantTextLooksLikeMoment4HandoffLead(t) ||
    (lower.includes('shift to something more personal') && /\bhave you ever\b/i.test(lower))
  );
}

/** Whether to show the emotion modal on a natural-language scenario boundary (no completion token). */
export function resolveNaturalLanguageEmotionModalGate(params: {
  displayText: string;
  priorScenario: 1 | 2 | 3;
  detectedScenario: 1 | 2 | 3 | null;
}): {
  emotionNaturalForward: boolean;
  completedScenario: 1 | 2 | 3 | null;
  deferBlocked: boolean;
} {
  const { displayText, priorScenario, detectedScenario } = params;
  const emotionSplit = splitScenarioTransitionForEmotionModal(displayText);
  const deferEmotionModal = shouldDeferEmotionModalForTransitionText(displayText);
  const deferBlocked = deferEmotionModal && !emotionSplit.afterModal.trim();
  /** Repair / in-scenario question bundled before handoff — wait for user answer before scoring or modal. */
  if (deferEmotionModal && emotionSplit.afterModal.trim()) {
    return { emotionNaturalForward: false, completedScenario: null, deferBlocked: false };
  }
  if (deferBlocked) {
    return { emotionNaturalForward: false, completedScenario: null, deferBlocked };
  }

  if (isScenarioThreeToMoment4EmotionModalHandoff(displayText)) {
    return { emotionNaturalForward: true, completedScenario: 3, deferBlocked };
  }

  const handoff = isNaturalLanguageScenarioHandoffTransition(displayText);
  if (handoff && detectedScenario !== null && detectedScenario >= 2 && detectedScenario <= 3) {
    const declared =
      detectedScenario > priorScenario
        ? ((detectedScenario - 1) as 1 | 2 | 3)
        : priorScenario;
    const completed = completedScenarioForEmotionModalFromTransition({
      declaredComplete: declared,
      transitionText: displayText,
      priorScenario,
    });
    return { emotionNaturalForward: true, completedScenario: completed, deferBlocked };
  }

  if (
    detectedScenario !== null &&
    detectedScenario > priorScenario &&
    detectedScenario <= 3 &&
    priorScenario >= 1 &&
    priorScenario <= 3
  ) {
    return { emotionNaturalForward: true, completedScenario: priorScenario, deferBlocked };
  }

  return { emotionNaturalForward: false, completedScenario: null, deferBlocked };
}

/** After resume catch-up for modal index 2, speak only the post-modal segment (not the full handoff). */
export function extractEmotionAfterModalForResumeCatchUp(
  transcriptMessages: ReadonlyArray<{ role: string; content?: string }>,
  catchUpIndices: readonly number[],
): string | null {
  if (!catchUpIndices.includes(2)) return null;
  for (let i = transcriptMessages.length - 1; i >= 0; i--) {
    const m = transcriptMessages[i];
    if (m?.role !== 'assistant') continue;
    const content = m.content ?? '';
    if (!/three described|grudge|two questions|more personal/i.test(content)) continue;
    const { afterModal } = splitScenarioTransitionForEmotionModal(content);
    if (afterModal.trim().length >= 20) return afterModal;
  }
  return null;
}
