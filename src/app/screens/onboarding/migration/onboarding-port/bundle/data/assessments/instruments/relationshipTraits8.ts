/** 1-based question indices that use reverse scoring: reversed = 8 - response (1–7 scale). */
export const RELATIONSHIP_TRAITS_REVERSE_ITEMS = new Set([1, 2, 6]);

export const RELATIONSHIP_TRAITS_ITEM_COUNT = 8;

export const RELATIONSHIP_TRAITS_ITEMS: string[] = [
  "When I'm stressed about something unrelated to my relationship, it tends to affect how I treat my partner.",
  "During conflict, I find it hard to stay calm until I've fully expressed how upset I am.",
  "After an argument, I can usually return to my normal baseline within a few hours.",
  "My mood in a relationship tends to be relatively stable day to day.",
  "When a partner does something that bothers me, my first instinct is to assume there is a reasonable explanation.",
  "I find it difficult to trust that a partner's good intentions are genuine, even when things are going well.",
  "I tend to assume people close to me have my best interests at heart until proven otherwise.",
  "When there is ambiguity in a partner's behavior, I usually lean toward giving them the benefit of the doubt.",
];

export function reverseLikert7(response: number): number {
  return 8 - response;
}

function scoredItem(raw: Record<string, number>, questionIndex1Based: number): number {
  const v = raw[String(questionIndex1Based)];
  if (typeof v !== "number" || !Number.isFinite(v)) {
    return NaN;
  }
  return RELATIONSHIP_TRAITS_REVERSE_ITEMS.has(questionIndex1Based)
    ? reverseLikert7(v)
    : v;
}

function mean4(a: number, b: number, c: number, d: number): number {
  const vals = [a, b, c, d].filter((x) => Number.isFinite(x));
  if (vals.length === 0) return 0;
  return vals.reduce((s, x) => s + x, 0) / vals.length;
}

/**
 * Trait keys match persisted `scores` on user_assessments / test_results (`test_id`: relationship_traits).
 */
export function scoreRelationshipTraits8(responses: Record<string, number>): Record<string, number> {
  const s = (q: number) => scoredItem(responses, q);
  return {
    emotional_stability_under_stress: mean4(s(1), s(2), s(3), s(4)),
    dispositional_trust: mean4(s(5), s(6), s(7), s(8)),
  };
}

export interface RelationshipTraitsQualityFlags {
  straight_lining: boolean;
  low_variance: boolean;
  completed_too_fast: boolean;
}

/** Minimum seconds for the battery before `completed_too_fast` is flagged. */
export const RELATIONSHIP_TRAITS_MIN_COMPLETION_SEC = 30;

export function computeRelationshipTraitsQualityFlags(
  rawResponses: Record<string, number>,
  timeTakenSec: number
): RelationshipTraitsQualityFlags {
  const vals: number[] = [];
  for (let i = 1; i <= RELATIONSHIP_TRAITS_ITEM_COUNT; i++) {
    const v = rawResponses[String(i)];
    if (typeof v === "number" && Number.isFinite(v)) {
      vals.push(v);
    }
  }
  const straight_lining =
    vals.length === RELATIONSHIP_TRAITS_ITEM_COUNT && vals.every((x) => x === vals[0]);
  const mean = vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);
  const variance =
    vals.length > 0
      ? vals.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) / vals.length
      : 0;
  const low_variance = !straight_lining && variance < 0.12;
  const completed_too_fast =
    typeof timeTakenSec === "number" &&
    timeTakenSec >= 0 &&
    timeTakenSec < RELATIONSHIP_TRAITS_MIN_COMPLETION_SEC;
  return { straight_lining, low_variance, completed_too_fast };
}
