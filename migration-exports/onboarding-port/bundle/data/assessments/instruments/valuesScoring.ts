// IMPORTANT: The PVQ-21/Schwartz Values canonical ESS scale presents items as
// 1 = "Very much like me" down to 6 = "Not like me at all".
// This app collects the REVERSE: 1 = "Not like me at all", 6 = "Very much like me".
// Scores are therefore already in the correct direction (high = high endorsement).
// DO NOT reverse-code any items before scoring.

import type { ValuesItem } from "./valuesItems";

export interface ValuesScores {
  conformity: number;
  tradition: number;
  benevolence: number;
  universalism: number;
  selfDirection: number;
  stimulation: number;
  hedonism: number;
  achievement: number;
  power: number;
  security: number;
}

const VALUE_KEYS: (keyof ValuesScores)[] = [
  "conformity",
  "tradition",
  "benevolence",
  "universalism",
  "selfDirection",
  "stimulation",
  "hedonism",
  "achievement",
  "power",
  "security",
];

/** Raw scores: mean of the relevant item responses per value (1–6 scale). */
/** Centered scores: raw minus MRAT (mean across all completed items). Use centered for matching. */
export function scoreValues(
  responses: Record<number, number>,
  itemMap: ValuesItem[]
): { raw: ValuesScores; centered: ValuesScores } {
  const raw = {} as ValuesScores;

  for (const key of VALUE_KEYS) {
    const items = itemMap.filter((i) => i.value === key);
    const sum = items.reduce((acc, item) => {
      const v = responses[item.id];
      return acc + (typeof v === "number" && Number.isFinite(v) ? v : 0);
    }, 0);
    raw[key] = items.length ? sum / items.length : 0;
  }

  const allResponses = itemMap.map((i) => responses[i.id]).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const mrat = allResponses.length ? allResponses.reduce((a, b) => a + b, 0) / allResponses.length : 0;

  const centered = {} as ValuesScores;
  for (const key of VALUE_KEYS) {
    centered[key] = raw[key] - mrat;
  }

  return { raw, centered };
}
