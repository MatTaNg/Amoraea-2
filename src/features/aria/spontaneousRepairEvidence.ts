/**
 * Detect meaningful unprompted repair content (not mere appreciation or third-person advice).
 * Used when S1/S2 hypothetical repair probes were not asked.
 */

const APPRECIATION_ONLY =
  /\b(appreciat|proud of|tell (her|him|them) (she'?s|he'?s|they'?re) (great|amazing|doing (a )?great)|celebrat|notice(d)? (her|him|their) (effort|work))\b/i;

const REPAIR_PROCESS =
  /\b(apologiz\w*|sorry|make amends|repair\w*|reconcil\w*|make (it|things) right|take responsibility|own(?:ing|ed)? (it|my|the|that)|check(\s+|-)?in|talk(?:ed)? (it|this|things) through|won'?t happen again|will not happen again|follow through|sit\s*-?\s*down|make it up|work (it|this) out|address (the|this) (hurt|harm|rupture)|listen (to (her|him|them) )?and (own|apolog)|come back (to|and))\b/i;

/** Concrete first-person repair move, not "James should appreciate Sarah". */
export function looksLikeMeaningfulSpontaneousRepairContent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (!REPAIR_PROCESS.test(t)) return false;
  if (APPRECIATION_ONLY.test(t) && !/\b(apologiz|sorry|repair|amends|responsibility|won'?t happen again|follow through)\b/i.test(t)) {
    return false;
  }
  return true;
}

export function userTurnsHaveMeaningfulSpontaneousRepair(
  messages: ReadonlyArray<{ role?: string; content?: string | null; scenarioNumber?: number }>,
  scenarioNumber?: 1 | 2 | 3,
): boolean {
  for (const m of messages) {
    if (m.role !== 'user') continue;
    if (
      scenarioNumber != null &&
      m.scenarioNumber != null &&
      m.scenarioNumber !== scenarioNumber
    ) {
      continue;
    }
    if (looksLikeMeaningfulSpontaneousRepairContent(String(m.content ?? ''))) return true;
  }
  return false;
}

export function looksLikeAssessableSpontaneousRepairEvidence(evidence: string | null | undefined): boolean {
  const t = evidence?.trim() ?? '';
  if (!t) return false;
  return looksLikeMeaningfulSpontaneousRepairContent(t) || /\bspontaneous\b/i.test(t);
}
