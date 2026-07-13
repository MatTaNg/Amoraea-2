import {
  EMOTION_INTERVIEW_MODAL_ITEMS,
  EXPECTED_EMOTION_RECOGNITION_ITEMS,
} from './emotionInterviewModalContent';

/** Sequential answers: index `i` is answered when the array has a letter at position `i`. */
export function isEmotionItemAnsweredAt(responses: readonly string[], index: number): boolean {
  if (index < 0 || index >= EMOTION_INTERVIEW_MODAL_ITEMS.length) return false;
  const letter = responses[index];
  return typeof letter === 'string' && letter.trim().length > 0;
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

/** True when every modal index 0..2 has a non-empty answer. */
export function isEmotionRecognitionBatteryComplete(responses: readonly string[]): boolean {
  return countAnsweredEmotionItems(responses) >= EXPECTED_EMOTION_RECOGNITION_ITEMS;
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

export function emotionResponsesUseFixedSlots(raw: unknown): boolean {
  if (!Array.isArray(raw)) return false;
  return (
    raw.length === EMOTION_INTERVIEW_MODAL_ITEMS.length &&
    raw.some((x) => x == null || (typeof x === 'string' && x.trim() === ''))
  );
}
