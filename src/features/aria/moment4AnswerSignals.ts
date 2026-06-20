import { normalizeInterviewTypography } from './interviewTypography';

export function countInterviewWords(text: string): number {
  const t = (text ?? '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** Named person-like token (not sentence-initial I/A); conservative — proper names in relational context only. */
const LIKELY_NAME_IN_RELATION_RE =
  /\b(?:my|our|with|from|and)\s+[A-Z][a-z]{1,24}\b|\b[A-Z][a-z]{1,24}\s+(?:said|told|called|texted|yelled|left|cut|betrayed)\b/;

/**
 * Named or clearly referenced specific person — mirrors {@link inferResponseConcretenessFromTranscript}
 * moment-4 `namedPerson` heuristic (personalMomentEmotionalVocab.ts).
 */
export function moment4HasNamedOrReferencedPerson(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '').trim();
  if (!t) return false;

  if (
    /\b(my (friend|mom|dad|mother|father|brother|sister|partner|ex|boss|coworker|colleague|neighbor|roommate|husband|wife))\b/i.test(
      t,
    ) ||
    /\b(with|from)\s+[A-Z][a-z]{1,24}\b/.test(t) ||
    LIKELY_NAME_IN_RELATION_RE.test(t)
  ) {
    return true;
  }

  if (/\b(this|that|the)\s+(woman|man|guy|girl|lady|gentleman|person|driver|dude|kid)\b/i.test(t)) {
    return true;
  }

  return false;
}

/** Episodic anchor: a specific interpersonal event or situation, not habits/philosophy alone. */
export function moment4HasSpecificEventDescription(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '').trim();
  if (!t) return false;
  const lower = t.toLowerCase();

  const dyadicOrEpisode =
    /\bwe ('?ve|had|got|were|argued|fought|disagreed|talked|made up|resolved|reconciled)\b/i.test(lower) ||
    /\bwe (had a|had an|got into (a )?)(fight|argument|disagreement|conflict|rupture)\b/i.test(lower) ||
    /\b(i|we)\s+had\s+a\s+conflict\b/i.test(lower) ||
    /\b(had|have)\s+an?\s+(fight|argument|disagreement|conflict|rupture|falling out|fallout)\b/i.test(lower) ||
    /\b(she|he|they)\s+(said|told me|texted|called|yelled|was upset|cut|betrayed|left|didn'?t)\b/i.test(lower) ||
    /\b(i|we)\s+(went to|walked out|stopped talking|cut (him|her|them) off)\b/i.test(lower) ||
    /\b(cheated on|lied to|betrayed|broke up|split up|fell out|cut me off)\b/i.test(lower) ||
    /\b(coordinat|planning).{0,80}\b(vacation|visit|trip|event)\b/i.test(lower);

  const situationalAnchor =
    /\b(when|once|that time|that day|that night|years? ago|last (year|week|month|summer|night))\b/i.test(lower) ||
    /\b(there was (a |one )?time|one time|i remember when|at one point)\b/i.test(lower) ||
    /\b(at work|at home|in (high )?school|during (the )?(vacation|trip|call|game))\b/i.test(lower) ||
    /\b(visiting|coming to see|next week|tomorrow)\b/i.test(lower);

  const episodicWithBehavior =
    situationalAnchor &&
    /\b(happened|argued|fought|upset|hurt|angry|yelled|misunderstood|frustrated|betray|cut off|stopped|left|said|told|misunderstanding|disagreed|fell out|grudge|game|amicably)\b/i.test(
      lower,
    );

  return dyadicOrEpisode || episodicWithBehavior;
}

export function moment4HasGenericSelfDescriptionOpener(text: string): boolean {
  const lower = normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!lower) return false;
  return (
    /\bi'?m\s+generally\b/.test(lower) ||
    /\bi\s+don'?t\s+really\b/.test(lower) ||
    /\bi\s+tend\s+to\s+(not\b|not\s+)/.test(lower) ||
    /\bi\s+(usually|often|typically|generally)\s+(don'?t|do not|try|tend)\b/.test(lower) ||
    /\bi\s+think\s+people\s+should\b/.test(lower) ||
    /\bi\s+am\s+a\s+spiritual\s+person\b/.test(lower)
  );
}
