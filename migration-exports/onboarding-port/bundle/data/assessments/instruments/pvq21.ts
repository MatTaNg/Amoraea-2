import { TWIVI_ITEMS, TWIVI_DISPLAY_STRINGS } from "./valuesItems";
import { scoreValues, type ValuesScores } from "./valuesScoring";

/** Schwartz Values items with portrait-values stem (same instrument id: PVQ-21). */
export const PVQ21_ITEMS: string[] = TWIVI_DISPLAY_STRINGS;

/** Maps camelCase value keys to legacy snake_case keys stored in Supabase / insights. */
const TO_SNAKE: Record<keyof ValuesScores, string> = {
  conformity: "conformity",
  tradition: "tradition",
  benevolence: "benevolence",
  universalism: "universalism",
  selfDirection: "self_direction",
  stimulation: "stimulation",
  hedonism: "hedonism",
  achievement: "achievement",
  power: "power",
  security: "security",
};

const DIM_KEYS: (keyof ValuesScores)[] = [
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

/**
 * MRAT-centered Schwartz-type scores for Schwartz Values (20 items).
 * Primary keys (`self_direction`, etc.) = **centered** scores for matching & insights.
 * `raw_*` keys = raw domain means (1–6) for diagnostics / reliability.
 */
export function scorePVQ21(responses: Record<string, number>): Record<string, number> {
  const numResponses: Record<number, number> = {};
  for (const [k, v] of Object.entries(responses)) {
    const id = Number(k);
    if (Number.isFinite(id) && typeof v === "number") numResponses[id] = v;
  }

  const { raw, centered } = scoreValues(numResponses, TWIVI_ITEMS);

  const out: Record<string, number> = {};
  for (const key of DIM_KEYS) {
    const snake = TO_SNAKE[key];
    out[snake] = centered[key];
    out[`raw_${snake}`] = raw[key];
  }

  out.self_transcendence = (out.benevolence + out.universalism) / 2;
  out.self_enhancement = (out.achievement + out.power) / 2;
  out.openness_to_change = (out.self_direction + out.stimulation + out.hedonism) / 3;
  out.conservation = (out.security + out.conformity + out.tradition) / 3;

  return out;
}
