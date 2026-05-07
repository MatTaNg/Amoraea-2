import type { ConflictStyle } from "./conflictStyleQuestions";

/**
 * Five conflict approach labels (internal / results only — not shown during assessment).
 */
export const CONFLICT_STYLE_KEYS = [
  "competing",
  "collaborating",
  "compromising",
  "avoiding",
  "accommodating",
] as const satisfies readonly ConflictStyle[];

export type ConflictStyleKey = ConflictStyle;
