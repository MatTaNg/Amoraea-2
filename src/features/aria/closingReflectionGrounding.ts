function normalizeGroundingCompare(text: string): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export type ClosingPillarContext = {
  mentalizing: number | null;
  accountability: number | null;
  repair: number | null;
  averagePillar: number | null;
};

type ScenarioScoresForClosing = Record<
  number,
  { pillarScores: Record<string, number | null> } | undefined
>;

const VAGUE_CLOSING_OBSERVATION_PHRASES = [
  'you remember what happened between you and how it felt',
  'you remember what happened between you',
  'what happened between you and how it felt',
  'you think carefully about when a relationship is worth working through',
  'you stay with how uncomfortable it got between you two',
] as const;

const CLOSING_OBSERVATION_OPENER_RE =
  /(?:what (?:i heard|i got|came through|landed for me) was that|what (?:stuck|stood) out(?:\s+to me)? was(?: that)?|it sounds like you)\s+/i;

const MENTALIZING_CLOSING_CLAIM_RE =
  /\b(perspective[- ]taking|see(?:ing)? (?:it|things) from (?:their|his|her)|their (?:side|experience|point of view)|reading (?:his|her|their)|attuned to|mentaliz)\b/i;

const REPAIR_CLOSING_CLAIM_RE =
  /\b(repair orientation|making amends|fix(?:ing)? things|work(?:ing)? (?:it )?through|reconnect|owned your part|what you own)\b/i;

const ACCOUNTABILITY_CLOSING_CLAIM_RE =
  /\b(what you own|own in it|owned your part|name what happened between you and what you own|your part in|the awareness you demonstrated|the care you showed)\b/i;

/** Pull the observation core from a closing reflection sentence, if present. */
export function extractClosingObservationCore(closing: string): string | null {
  const match = (closing ?? '').match(
    new RegExp(
      `${CLOSING_OBSERVATION_OPENER_RE.source}([^.!?]+)`,
      'i',
    ),
  );
  return match?.[1]?.trim() ?? null;
}

/**
 * True when a closing observation sounds meaningful but is vague, generic, or grammatically thin.
 */
export function isVagueOrWeakClosingObservation(closing: string): boolean {
  const core = extractClosingObservationCore(closing)?.toLowerCase() ?? '';
  if (!core) return false;
  if (VAGUE_CLOSING_OBSERVATION_PHRASES.some((phrase) => core.includes(phrase))) return true;
  if (/^you remember\b/.test(core) && !/\b(said|told|named|owned|admitted|called|missed)\b/.test(core)) {
    return true;
  }
  if (/\band how it felt\b/.test(core) && !/\b(said|felt about|when (you|they|she|he))\b/.test(core)) {
    return true;
  }
  const contentWords = core.split(/\s+/).filter((w) => w.length > 3);
  return contentWords.length < 4;
}

export function buildTwoSentenceClosingWithoutObservation(participantFirstName: string): string {
  const name = participantFirstName.trim();
  const thanks = name
    ? `Thank you for being so open with me, ${name}.`
    : 'Thank you for being so open with me.';
  const ack = name
    ? `Good work getting through all of this, ${name}.`
    : 'Good work getting through all of this.';
  return `${ack} Your interview is complete. ${thanks}`.replace(/\s+/g, ' ').trim();
}

/**
 * Ensure spoken closings state completion before the thanks line (model often omits it).
 */
export function ensureInterviewCompleteSpokenLine(closing: string): string {
  const t = (closing ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return t;
  if (/\byour interview is complete\b/i.test(t)) return t;
  if (/\bthank you for being so open with me\b/i.test(t)) {
    return t
      .replace(
        /\bthank you for being so open with me\b/i,
        'Your interview is complete. Thank you for being so open with me',
      )
      .replace(/\s+/g, ' ')
      .trim();
  }
  return `${t.replace(/[.!?]\s*$/, '')}. Your interview is complete.`.replace(/\s+/g, ' ').trim();
}

/** Average pillar scores across completed scenario bundles (1–3). */
export function deriveClosingPillarContextFromScenarioScores(
  scenarioScores: ScenarioScoresForClosing | undefined | null,
): ClosingPillarContext | null {
  if (!scenarioScores || Object.keys(scenarioScores).length === 0) return null;
  const pillarSums: Record<string, number> = {};
  const pillarCounts: Record<string, number> = {};
  const allValues: number[] = [];

  for (const n of [1, 2, 3] as const) {
    const ps = scenarioScores[n]?.pillarScores;
    if (!ps) continue;
    for (const v of Object.values(ps)) {
      if (typeof v === 'number' && Number.isFinite(v)) {
        allValues.push(v);
      }
    }
    for (const key of ['mentalizing', 'accountability', 'repair'] as const) {
      const v = ps[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        pillarSums[key] = (pillarSums[key] ?? 0) + v;
        pillarCounts[key] = (pillarCounts[key] ?? 0) + 1;
      }
    }
  }

  if (allValues.length === 0) return null;
  const avg = (key: string) => (pillarCounts[key] ? pillarSums[key]! / pillarCounts[key]! : null);
  return {
    mentalizing: avg('mentalizing'),
    accountability: avg('accountability'),
    repair: avg('repair'),
    averagePillar: allValues.reduce((sum, v) => sum + v, 0) / allValues.length,
  };
}

/**
 * True when pillar scores forbid the positive relational qualities implied by the observation.
 */
export function closingObservationFailsPillarGate(
  closing: string,
  pillarContext: ClosingPillarContext | null | undefined,
): boolean {
  if (!pillarContext) return false;
  if (pillarContext.averagePillar != null && pillarContext.averagePillar < 4) return true;
  if (MENTALIZING_CLOSING_CLAIM_RE.test(closing)) {
    if ((pillarContext.mentalizing ?? 0) < 6) return true;
  }
  if (ACCOUNTABILITY_CLOSING_CLAIM_RE.test(closing)) {
    if ((pillarContext.accountability ?? 0) < 6) return true;
  }
  if (REPAIR_CLOSING_CLAIM_RE.test(closing)) {
    if ((pillarContext.repair ?? 0) < 6) return true;
  }
  return false;
}

/** True when the user voluntarily names their own contribution, fault, or repair in conflict. */
export function userAnswerSupportsAccountabilityClaim(userAnswer: string): boolean {
  const u = normalizeGroundingCompare(userAnswer);
  if (!u) return false;
  return (
    /\b(my part|my fault|i should have|i could have|what i did|take responsibility|own my|owned (that|my|it)|i apolog|i was wrong|i overreacted|i contributed|i admitted|that's on me|i take ownership)\b/.test(
      u,
    ) || /\bi\s+owned\b/.test(u)
  );
}

/**
 * True when closing copy credits accountability/ownership the user's words do not support.
 */
export function closingAttributesUnsupportedAccountability(
  closing: string,
  userAnswer: string,
): boolean {
  const c = normalizeGroundingCompare(closing);
  const wordCount = (userAnswer ?? '').trim().split(/\s+/).filter(Boolean).length;
  if (!c || wordCount < 5) return false;
  if (!ACCOUNTABILITY_CLOSING_CLAIM_RE.test(c)) return false;
  return !userAnswerSupportsAccountabilityClaim(userAnswer);
}

/** Blame is attributed entirely to the other party with no self-examination. */
export function userAnswerIsExternallyBlamingOnly(userAnswer: string): boolean {
  const u = normalizeGroundingCompare(userAnswer);
  if (!u || u.split(/\s+/).filter(Boolean).length < 8) return false;
  if (userAnswerSupportsAccountabilityClaim(userAnswer)) return false;
  return (
    /\b(unreasonable|ridiculous|blew it|out of proportion|their fault|needed to calm|narcissist|toxic|manipulative|completely wrong|she was being|he was being|they were being)\b/.test(
      u,
    ) &&
    /\b(fight|argument|conflict|roommate|partner|friend|ex|coworker|she|he|they)\b/.test(u)
  );
}
