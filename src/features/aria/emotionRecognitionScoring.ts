import {
  EMOTION_INTERVIEW_MODAL_ITEMS,
  EMOTION_ITEM_CORRECT_ANSWERS,
  EXPECTED_EMOTION_RECOGNITION_ITEMS,
} from './emotionInterviewModalContent';
import { GATE_PASS_WEIGHTED_MIN } from '@config/scoring/interviewGateThresholds';
import {
  countAnsweredEmotionItems,
  emotionResponsesForStorage,
  hydrateEmotionResponsesFromStorage,
  isEmotionItemAnsweredAt,
  isEmotionRecognitionBatteryComplete,
} from './emotionResponseStorage';

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

/**
 * Gate / modifier input: returns correct count (0–3) for complete batteries only.
 * Prefer {@link emotionRecognitionResponses} when available.
 */
export function resolveEmotionRecognitionCorrectCountForGate(params: {
  emotionRecognitionRawScore?: number | null;
  emotionRecognitionCorrectCount?: 0 | 1 | 2 | 3 | null;
  emotionRecognitionResponses?: unknown;
}): 0 | 1 | 2 | 3 | null {
  const hydrated =
    params.emotionRecognitionResponses != null
      ? hydrateEmotionResponsesFromStorage(params.emotionRecognitionResponses)
      : null;
  if (hydrated != null && !isEmotionRecognitionBatteryComplete(hydrated)) {
    return null;
  }
  if (hydrated != null && isEmotionRecognitionBatteryComplete(hydrated)) {
    const fromResponses = emotionRecognitionCorrectCountFromResponses(hydrated);
    if (fromResponses !== null) return fromResponses;
  }
  const r = params.emotionRecognitionRawScore;
  if (typeof r === 'number' && Number.isFinite(r)) {
    const stored = storedEmotionCorrectCountFromRaw(r);
    if (stored !== null) return stored;
    const legacy = legacyEmotionProportionFromRaw(r);
    if (legacy !== null) return Math.round(legacy * EXPECTED_EMOTION_RECOGNITION_ITEMS) as 0 | 1 | 2 | 3;
    return null;
  }
  if (typeof r === 'string' && String(r).trim() !== '') {
    const n = Number(String(r).trim());
    if (!Number.isFinite(n)) return null;
    const stored = storedEmotionCorrectCountFromRaw(n);
    if (stored !== null) return stored;
    const legacy = legacyEmotionProportionFromRaw(n);
    if (legacy !== null) return Math.round(legacy * EXPECTED_EMOTION_RECOGNITION_ITEMS) as 0 | 1 | 2 | 3;
    return null;
  }
  const c = params.emotionRecognitionCorrectCount;
  if (c === null || c === undefined) return null;
  if (typeof c === 'string' && String(c).trim() !== '') {
    const n = parseInt(String(c).trim(), 10);
    if (Number.isFinite(n) && n >= 0 && n <= 3) return n as 0 | 1 | 2 | 3;
  }
  if (typeof c === 'number' && Number.isFinite(c)) {
    const stored = storedEmotionCorrectCountFromRaw(c);
    if (stored !== null) return stored;
    if (c >= 0 && c <= 3) return Math.round(c) as 0 | 1 | 2 | 3;
  }
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
  const min = attempt.weightedPassMin ?? GATE_PASS_WEIGHTED_MIN;
  if (typeof ws !== 'number' || !Number.isFinite(ws) || ws < min) return false;
  const raw = attempt.gate_fail_reasons;
  if (!Array.isArray(raw)) return false;
  const codes = raw.filter((x): x is string => typeof x === 'string');
  return codes.length === 1 && codes[0] === 'emotion_recognition_floor';
}

export const LEGACY_EMOTION_RECOGNITION_FLOOR_REVIEW_NOTE =
  'Legacy fail — emotion recognition hard floor only (removed). Weighted score met threshold; manual override review recommended.';
