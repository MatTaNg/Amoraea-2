import type { ConflictStylePair } from "./conflictStyleQuestions";
import type { ConflictStyleKey } from "./conflictStyleTypes";

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ShuffledPair {
  prompt: string;
  first: { text: string; style: ConflictStyleKey };
  second: { text: string; style: ConflictStyleKey };
  /** 'normal' = A is first, 'flipped' = B is first */
  order: "normal" | "flipped";
}

/**
 * Deterministic flip per pair so resume/drafts stay aligned with on-screen order (same sessionSeed + pair.id).
 */
export function shufflePair(pair: ConflictStylePair, sessionSeed: number): ShuffledPair {
  const rnd = mulberry32(sessionSeed + pair.id * 997);
  const flipped = rnd() < 0.5;
  return {
    prompt: pair.prompt,
    first: flipped ? pair.optionB : pair.optionA,
    second: flipped ? pair.optionA : pair.optionB,
    order: flipped ? "flipped" : "normal",
  };
}

export function shuffleAllPairs(pairs: ConflictStylePair[], sessionSeed: number): ShuffledPair[] {
  return pairs.map((p) => shufflePair(p, sessionSeed));
}
