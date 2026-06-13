export type NpiEntitlementQuestion = {
  id: number;
  optionA: string;
  optionB: string;
  optionAEntitlement: boolean;
  optionBEntitlement: boolean;
};

export type ShuffledNpiPair = {
  first: { text: string; isEntitlement: boolean };
  second: { text: string; isEntitlement: boolean };
  order: 'normal' | 'flipped';
};

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic flip per pair so resume/drafts stay aligned with on-screen order (same sessionSeed + pair id). */
export function shuffleNpiPair(question: NpiEntitlementQuestion, sessionSeed: number): ShuffledNpiPair {
  const rnd = mulberry32(sessionSeed + question.id * 997);
  const flipped = rnd() < 0.5;
  return {
    first: flipped
      ? { text: question.optionB, isEntitlement: question.optionBEntitlement }
      : { text: question.optionA, isEntitlement: question.optionAEntitlement },
    second: flipped
      ? { text: question.optionA, isEntitlement: question.optionAEntitlement }
      : { text: question.optionB, isEntitlement: question.optionBEntitlement },
    order: flipped ? 'flipped' : 'normal',
  };
}
