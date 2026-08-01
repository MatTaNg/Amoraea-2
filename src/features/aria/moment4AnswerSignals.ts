import { normalizeInterviewTypography } from './interviewTypography';

/** Spoken transcripts often hyphenate role nouns ("co-worker") that regexes match without a hyphen. */
function normalizeMoment4RoleNounHyphens(text: string): string {
  return text.replace(/\bco-workers?\b/gi, (match) =>
    /s$/i.test(match) ? 'coworkers' : 'coworker',
  );
}

export function countInterviewWords(text: string): number {
  const t = (text ?? '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** Named person-like token (not sentence-initial I/A); conservative — proper names in relational context only. */
const LIKELY_NAME_IN_RELATION_RE =
  /\b(?:my|our|with|from|and)\s+[A-Z][a-z]{1,24}\b|\b[A-Z][a-z]{1,24}\s+(?:said|told|called|texted|yelled|left|cut|betrayed)\b/;

/** Role noun followed by appositive or "named" proper name — e.g. "a woman, Michelle", "my friend named Sarah". */
const ROLE_NOUN_APPOSED_NAME_RE =
  /\b(?:a|an|the|my|our|with)?\s*(?:close |old |former )?(?:woman|man|guy|girl|lady|gentleman|person|friend|roommate|housemate|partner|colleague|coworker|neighbor|boss|ex|cousin|buddy)\s*(?:,|named)\s+[A-Z][a-z]{2,24}\b/i;

/** Role noun immediately followed by proper name — e.g. "my friend Devanshu", "my cousin Rita". */
const ROLE_NOUN_INLINE_NAME_RE =
  /\b(?:my|our|a|an|the)?\s*(?:close |old |former )?(?:friend|cousin|brother|sister|roommate|housemate|coworker|colleague|neighbor|boss|partner|ex|buddy)\s+[A-Z][a-z]{2,24}\b/i;

/**
 * Named or clearly referenced specific person — mirrors {@link inferResponseConcretenessFromTranscript}
 * moment-4 `namedPerson` heuristic (personalMomentSliceEnrichment.ts).
 */
export function moment4HasNamedOrReferencedPerson(text: string): boolean {
  const t = normalizeMoment4RoleNounHyphens(normalizeInterviewTypography(text ?? '').trim());
  if (!t) return false;

  if (
    /\b(my (?:close |old |former )?(?:friend|mom|dad|mother|father|brother|sister|partner|ex|boss|coworker|colleague|neighbor|roommate|husband|wife))\b/i.test(
      t,
    ) ||
    /\b(?:(?:i|we) )?had (?:a |an |my |our )(?:close |old |former |childhood )?(?:friend|roommate|coworker|colleague)\b/i.test(
      t,
    ) ||
    /\b(?:a |an |my |our |one )(?:close |old |former )?(?:friend|roommate|housemate|coworker|colleague|boss|partner|ex|neighbor|cousin|woman|man|individual)\b/i.test(
      t,
    ) ||
    /\b(?:a |an )person who\b/i.test(t) ||
    /\bthere was (?:a |an |one )?(?:close |old |former )?(?:friend|roommate|housemate|coworker|colleague|boss|partner|ex|neighbor|cousin|woman|man|person|guy|girl|individual)\b/i.test(
      t,
    ) ||
    /\b(?:a|the)\s+(woman|man|guy|girl|lady|gentleman|individual)\b/i.test(t) ||
    /\b(?:a|the)\s+person who\b/i.test(t) ||
    /\b(with|from)\s+[A-Z][a-z]{1,24}\b/.test(t) ||
    ROLE_NOUN_APPOSED_NAME_RE.test(t) ||
    ROLE_NOUN_INLINE_NAME_RE.test(t) ||
    LIKELY_NAME_IN_RELATION_RE.test(t)
  ) {
    return true;
  }

  if (/\b(this|that|the|one)\s+individual\b/i.test(t)) {
    return true;
  }

  if (/\b(this|that|the)\s+(woman|man|guy|girl|lady|gentleman|person|driver|dude|kid)\b/i.test(t)) {
    return true;
  }

  /** "this one guy", "that one woman" — common spoken reference without a proper name. */
  if (
    /\b(this|that|the)\s+one\s+(woman|man|guy|girl|lady|gentleman|person|driver|dude|kid)\b/i.test(t)
  ) {
    return true;
  }

  /** "one guy who thought…", "one woman who said…" — specific individual without a name. */
  if (/\bone\s+(woman|man|guy|girl|person|dude|kid)\s+who\b/i.test(t)) {
    return true;
  }

  /** Third-person pronoun tied to a concrete interpersonal action — e.g. "She shared…", "He lied…". */
  if (
    /\b(?:she|he)\s+(?:was|were|has|had|shared|betrayed|told|said|texted|called|yelled|lied|cheated|ignored|abandoned|didn'?t|wouldn'?t|left|hurt|angered|cut|giving|pushing|inserting|used|acted|repeatedly)\b/i.test(
      t,
    )
  ) {
    return true;
  }

  /** Plural they/them when tied to concrete interpersonal behavior — e.g. "they acted… on a trip". */
  if (
    /\bthey\s+(?:was|were|has|had|have|shared|betrayed|told|said|texted|called|yelled|lied|cheated|ignored|abandoned|didn'?t|wouldn'?t|left|hurt|angered|cut|acted|repeatedly)\b/i.test(
      t,
    )
  ) {
    return true;
  }

  /** Object pronoun after direct address — e.g. "talking to her about it". */
  if (/\b(talk(?:ed|ing)|speak(?:ing|)|spoke)\s+(?:to|with)\s+(?:her|him)\b/i.test(t)) {
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
    /\b(she|he|they)\s+(said|told me|texted|called|yelled|was upset|was giving|was pushing|cut|betrayed|left|didn'?t|hasn'?t|haven'?t|responded)\b/i.test(
      lower,
    ) ||
    /\b(i|we)\s+(went to|walked out|stopped talking|cut (him|her|them) off|moved in|moved out|moved to)\b/i.test(lower) ||
    /\b(we|i)\s+don'?t talk\b/i.test(lower) ||
    /\bdon'?t talk (anymore|any more|much|any longer)\b/i.test(lower) ||
    /\b(didn'?t|doesn'?t|don'?t)\s+like\s+(my|his|her|their|the|that|this|it)\b/i.test(lower) ||
    /\bwho (didn'?t|doesn'?t|don'?t|wouldn'?t|wasn'?t|hasn'?t|haven'?t)\b/i.test(lower) ||
    /\b(moved in with|moved out|lived with)\b/i.test(lower) ||
    /\b(cheated on|lied to|betrayed|broke up|split up|fell out|cut me off)\b/i.test(lower) ||
    /\b(coordinat|planning).{0,80}\b(vacation|visit|trip|event)\b/i.test(lower);

  const situationalAnchor =
    /\b(when|once|that time|that day|that night|years? ago|\d+\s+weeks? ago|\d+\s+months? ago|last (year|week|month|summer|night))\b/i.test(
      lower,
    ) ||
    /\b(there was (a |one )?time|one time|i remember when|at one point)\b/i.test(lower) ||
    /\b(at work|at home|in (high )?school|during (the )?(vacation|trip|call|game))\b/i.test(lower) ||
    /\b(visiting|coming to see|next week|tomorrow)\b/i.test(lower);

  const episodicWithBehavior =
    situationalAnchor &&
    /\b(happened|argued|fought|upset|hurt|angry|yelled|misunderstood|frustrated|betray|cut off|stopped|left|said|told|misunderstanding|disagreed|fell out|grudge|game|amicably|moved|advice|personality|responded|text)\b/i.test(
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
