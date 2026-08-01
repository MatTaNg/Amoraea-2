/**
 * Emotion recognition scoring for edge functions.
 * `emotion_recognition_raw_score` is an integer correct-count (0–3), not a proportion.
 * Legacy rows may store a fractional proportion in (0, 1) only when it is not an integer count.
 */
import { finiteNumberOrNull } from './attemptScoreSliceParsing.ts';
import { EMOTION_ITEM_CORRECT_ANSWERS } from '../../../src/config/scoring/emotionRecognitionItems.ts';

export { EMOTION_ITEM_CORRECT_ANSWERS } from '../../../src/config/scoring/emotionRecognitionItems.ts';
export const EMOTION_ITEM_COUNT = EMOTION_ITEM_CORRECT_ANSWERS.length;

export function isStoredEmotionCorrectCount(raw: number): boolean {
  if (!Number.isFinite(raw)) return false;
  const rounded = Math.round(raw);
  return rounded === raw && rounded >= 0 && rounded <= EMOTION_ITEM_COUNT;
}

/** Integer correct-count (0–3) from a stored raw field, or null if not interpretable as a count. */
export function storedEmotionCorrectCountFromRaw(raw: number | null): 0 | 1 | 2 | 3 | null {
  if (raw === null) return null;
  if (isStoredEmotionCorrectCount(raw)) return Math.round(raw) as 0 | 1 | 2 | 3;
  if (raw > 1 && raw <= EMOTION_ITEM_COUNT) return Math.round(raw) as 0 | 1 | 2 | 3;
  return null;
}

/** Legacy fractional proportion in (0, 1), excluding integer counts mistaken as 100%. */
export function legacyEmotionProportionFromRaw(raw: number): number | null {
  if (storedEmotionCorrectCountFromRaw(raw) !== null) return null;
  if (raw === 0) return 0;
  if (raw > 0 && raw < 1) return raw;
  return null;
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
    .slice(0, EMOTION_ITEM_COUNT);
}

/** Full 3-slot arrays keep index alignment; shorter arrays are compact sequential prefixes. */
export function hydrateEmotionResponsesFromStorage(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  if (raw.length === EMOTION_ITEM_COUNT) {
    return normalizeEmotionResponseLetters(raw);
  }
  return normalizeEmotionResponseLetters(raw).filter((s) => s.length > 0);
}

export function emotionResponsesUseFixedSlots(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false;
  return (
    raw.length === EMOTION_ITEM_COUNT &&
    raw.some((x) => x == null || (typeof x === 'string' && x.trim() === ''))
  );
}

function isEmotionItemAnsweredAt(responses: readonly string[], index: number): boolean {
  if (index < 0 || index >= EMOTION_ITEM_COUNT) return false;
  const letter = responses[index];
  return typeof letter === 'string' && letter.trim().length > 0;
}

export function countAnsweredEmotionItems(responses: readonly string[]): number {
  let n = 0;
  for (let i = 0; i < EMOTION_ITEM_COUNT; i++) {
    if (isEmotionItemAnsweredAt(responses, i)) n += 1;
  }
  return n;
}

export function isEmotionRecognitionBatteryComplete(responses: readonly string[]): boolean {
  return countAnsweredEmotionItems(responses) >= EMOTION_ITEM_COUNT;
}

export function emotionRecognitionCorrectCountFromResponses(
  responses: readonly string[],
): 0 | 1 | 2 | 3 | null {
  if (!isEmotionRecognitionBatteryComplete(responses)) return null;
  let n = 0;
  for (let i = 0; i < EMOTION_ITEM_COUNT; i++) {
    if (
      isEmotionItemAnsweredAt(responses, i) &&
      responses[i]!.trim().toUpperCase() === EMOTION_ITEM_CORRECT_ANSWERS[i]
    ) {
      n += 1;
    }
  }
  return n as 0 | 1 | 2 | 3;
}

export function emotionRecognitionCorrectCountFromRow(row: {
  emotion_recognition_responses?: unknown;
}): 0 | 1 | 2 | 3 | null {
  const hydrated = hydrateEmotionResponsesFromStorage(row.emotion_recognition_responses);
  return emotionRecognitionCorrectCountFromResponses(hydrated);
}

/**
 * Authoritative correct count for persist/display: per-index check against {@link EMOTION_ITEM_CORRECT_ANSWERS}
 * when the battery is complete; otherwise fall back to stored integer raw count only.
 */
export function emotionRecognitionCorrectCountForPersist(row: {
  emotion_recognition_raw_score?: unknown;
  emotion_recognition_responses?: unknown;
}): 0 | 1 | 2 | 3 | null {
  const fromResponses = emotionRecognitionCorrectCountFromRow(row);
  if (fromResponses !== null) return fromResponses;
  return storedEmotionCorrectCountFromRaw(finiteNumberOrNull(row.emotion_recognition_raw_score));
}

/** 0–100 display percent; prefers stored integer correct-count over response recompute. */
export function emotionRecognitionDisplayPercentFromRow(row: {
  emotion_recognition_score?: unknown;
  emotion_recognition_raw_score?: unknown;
  emotion_recognition_responses?: unknown;
}): number | null {
  const storedCount = storedEmotionCorrectCountFromRaw(
    finiteNumberOrNull(row.emotion_recognition_raw_score),
  );
  if (storedCount !== null) {
    return Math.round((storedCount / EMOTION_ITEM_COUNT) * 100);
  }
  const correct = emotionRecognitionCorrectCountFromRow(row);
  if (correct !== null) {
    return Math.round((correct / EMOTION_ITEM_COUNT) * 100);
  }
  const legacy = legacyEmotionProportionFromRaw(
    finiteNumberOrNull(row.emotion_recognition_raw_score) ?? NaN,
  );
  if (legacy !== null) return Math.round(legacy * 100);
  const display = finiteNumberOrNull(row.emotion_recognition_score);
  if (display === null) return null;
  if (display > 10) return Math.round(display);
  return Math.round((display / 10) * 100);
}

/** Gate/modifier input: proportion in [0, 1]; prefers hydrated responses when battery complete. */
export function emotionRecognitionProportionForGate(row: {
  emotion_recognition_raw_score?: unknown;
  emotion_recognition_responses?: unknown;
}): number | null {
  const hydrated = hydrateEmotionResponsesFromStorage(row.emotion_recognition_responses);
  if (!isEmotionRecognitionBatteryComplete(hydrated)) return null;
  const fromResponses = emotionRecognitionCorrectCountFromResponses(hydrated);
  if (fromResponses !== null) return fromResponses / EMOTION_ITEM_COUNT;
  const storedCount = storedEmotionCorrectCountFromRaw(
    finiteNumberOrNull(row.emotion_recognition_raw_score),
  );
  if (storedCount !== null) return storedCount / EMOTION_ITEM_COUNT;
  const legacy = legacyEmotionProportionFromRaw(
    finiteNumberOrNull(row.emotion_recognition_raw_score) ?? NaN,
  );
  return legacy;
}

export function emotionRecognitionPersistFieldsFromRow(row: {
  emotion_recognition_raw_score?: unknown;
  emotion_recognition_responses?: unknown;
}): { rawCount: number | null; displayPercent: number | null; proportionForGate: number | null } {
  const rawCount = emotionRecognitionCorrectCountForPersist(row);
  const displayPercent =
    rawCount !== null ? Math.round((rawCount / EMOTION_ITEM_COUNT) * 100) : null;
  const proportionForGate =
    rawCount !== null ? rawCount / EMOTION_ITEM_COUNT : emotionRecognitionProportionForGate(row);
  return { rawCount, displayPercent, proportionForGate };
}

/** Reconcile stale DB rows so score always matches integer raw count (never proportion×100). */
export function reconcileEmotionRecognitionAttemptFields(row: {
  emotion_recognition_raw_score?: unknown;
  emotion_recognition_responses?: unknown;
  emotion_recognition_score?: unknown;
}): {
  emotion_recognition_raw_score: number | null;
  emotion_recognition_score: number | null;
} {
  const { rawCount, displayPercent } = emotionRecognitionPersistFieldsFromRow(row);
  if (rawCount !== null && displayPercent !== null) {
    return {
      emotion_recognition_raw_score: rawCount,
      emotion_recognition_score: displayPercent,
    };
  }
  const storedRaw = storedEmotionCorrectCountFromRaw(finiteNumberOrNull(row.emotion_recognition_raw_score));
  if (storedRaw !== null) {
    const pct = Math.round((storedRaw / EMOTION_ITEM_COUNT) * 100);
    return { emotion_recognition_raw_score: storedRaw, emotion_recognition_score: pct };
  }
  return {
    emotion_recognition_raw_score: finiteNumberOrNull(row.emotion_recognition_raw_score),
    emotion_recognition_score: finiteNumberOrNull(row.emotion_recognition_score),
  };
}

/** Gate input: proportion in [0, 1] from per-index response scoring when battery complete. */
export function emotionRecognitionRawScoreFromRow(row: {
  emotion_recognition_raw_score?: unknown;
  emotion_recognition_responses?: unknown;
}): number | null {
  return emotionRecognitionPersistFieldsFromRow(row).proportionForGate;
}

/** 0–100 display percent; integer raw 0–3 is a correct-count, never a proportion. */
export function emotionRecognitionDisplayScoreFromRow(row: {
  emotion_recognition_score?: unknown;
  emotion_recognition_raw_score?: unknown;
  emotion_recognition_responses?: unknown;
}): number | null {
  const reconciled = emotionRecognitionPersistFieldsFromRow(row).displayPercent;
  if (reconciled !== null) return reconciled;
  return emotionRecognitionDisplayPercentFromRow(row);
}

/** Proportion correct in [0, 1] — used by gate/modifier and legacy helpers. */
export function emotionRecognitionProportionFromResponses(responses: readonly string[]): number | null {
  const correct = emotionRecognitionCorrectCountFromResponses(responses);
  return correct === null ? null : correct / EMOTION_ITEM_COUNT;
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
      EMOTION_ITEM_COUNT,
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
    if (stored !== null) return stored / EMOTION_ITEM_COUNT;
    const legacy = legacyEmotionProportionFromRaw(r);
    if (legacy !== null) return legacy;
    return null;
  }
  if (typeof r === 'string' && String(r).trim() !== '') {
    const n = Number(String(r).trim());
    if (!Number.isFinite(n)) return null;
    const stored = storedEmotionCorrectCountFromRaw(n);
    if (stored !== null) return stored / EMOTION_ITEM_COUNT;
    const legacy = legacyEmotionProportionFromRaw(n);
    if (legacy !== null) return legacy;
    return null;
  }
  const c = params.emotionRecognitionCorrectCount;
  if (c === null || c === undefined) return null;
  if (typeof c === 'string' && String(c).trim() !== '') {
    const n = parseInt(String(c).trim(), 10);
    if (Number.isFinite(n) && n >= 0 && n <= EMOTION_ITEM_COUNT) return n / EMOTION_ITEM_COUNT;
  }
  if (typeof c === 'number' && Number.isFinite(c)) {
    const stored = storedEmotionCorrectCountFromRaw(c);
    if (stored !== null) return stored / EMOTION_ITEM_COUNT;
    return c / EMOTION_ITEM_COUNT;
  }
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
    if (legacy !== null) return Math.round(legacy * EMOTION_ITEM_COUNT) as 0 | 1 | 2 | 3;
    return null;
  }
  if (typeof r === 'string' && String(r).trim() !== '') {
    const n = Number(String(r).trim());
    if (!Number.isFinite(n)) return null;
    const stored = storedEmotionCorrectCountFromRaw(n);
    if (stored !== null) return stored;
    const legacy = legacyEmotionProportionFromRaw(n);
    if (legacy !== null) return Math.round(legacy * EMOTION_ITEM_COUNT) as 0 | 1 | 2 | 3;
    return null;
  }
  const c = params.emotionRecognitionCorrectCount;
  if (c === null || c === undefined) return null;
  if (typeof c === 'string' && String(c).trim() !== '') {
    const n = parseInt(String(c).trim(), 10);
    if (Number.isFinite(n) && n >= 0 && n <= EMOTION_ITEM_COUNT) return n as 0 | 1 | 2 | 3;
  }
  if (typeof c === 'number' && Number.isFinite(c)) {
    const stored = storedEmotionCorrectCountFromRaw(c);
    if (stored !== null) return stored;
    if (c >= 0 && c <= EMOTION_ITEM_COUNT) return Math.round(c) as 0 | 1 | 2 | 3;
  }
  return null;
}
