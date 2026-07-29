import {
  countInterviewWords,
  moment4HasGenericSelfDescriptionOpener,
  moment4HasNamedOrReferencedPerson,
  moment4HasSpecificEventDescription,
} from './moment4AnswerSignals';
import { normalizeInterviewTypography } from './interviewTypography';

/** Moment 4 concreteness includes episodic levels plus coherent non-applicable grudge answers. */
export type Moment4ConcretenessLevel =
  | 'absent'
  | 'low'
  | 'moderate'
  | 'high'
  | 'valid_non_applicable';

export function normalizeMoment4Concreteness(raw: unknown): Moment4ConcretenessLevel | null {
  if (raw == null) return null;
  const t = String(raw).trim().toLowerCase();
  if (
    t === 'absent' ||
    t === 'low' ||
    t === 'moderate' ||
    t === 'high' ||
    t === 'valid_non_applicable'
  ) {
    return t as Moment4ConcretenessLevel;
  }
  return null;
}

/** User claims no current grudge / no one who got under their skin, or explains resolved/non-maintained stance. */
export function moment4StatesAbsenceOfCurrentGrudge(text: string): boolean {
  const lower = normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!lower) return false;
  return (
    /\b(don'?t (really )?hold grudges|don'?t hold grudges|don'?t usually hold grudges|usually don'?t hold grudges|don'?t have.*grudges|no grudges|not hold grudges)\b/.test(
      lower,
    ) ||
    /\b(no one comes to mind|nobody comes to mind|can'?t think of anyone|don'?t have anyone|nothing comes to mind)\b/.test(
      lower,
    ) ||
    /\b(no specific person|not a specific person|don'?t have a specific person|doesn'?t have a specific person|does not have a specific person|do not have a specific person)\b/.test(
      lower,
    ) ||
    /\b((a )?person|no one|nobody|anyone) (doesn'?t|does not|didn'?t) come to mind\b/.test(lower) ||
    /\b(can'?t|cannot) think of (a )?(specific )?(person|anyone|someone)\b/.test(lower) ||
    /\b(can'?t|cannot) think of anyone specific\b/.test(lower) ||
    /\b(not|don'?t think i'?m?) holding on to anything\b/.test(lower) ||
    /\b(genuinely )?can'?t point to (someone|anyone|a person)\b/.test(lower) ||
    /\b(can'?t|cannot) think of (a )?time\b/.test(lower) ||
    /\b(can'?t|cannot) (think of|point to|name) (anyone|someone|one)\b/.test(lower) ||
    /\bno one (i'?m|that i'?m) still carrying\b/.test(lower) ||
    /\b(never really had anyone|no one that|nobody that).{0,40}(get under my skin|didn'?t like)\b/.test(lower) ||
    /\b(haven'?t held a grudge|never held a grudge|no, i haven'?t)\b/.test(lower) ||
    /\bholding grudges doesn'?t work\b/.test(lower) ||
    /\b(grudges?.{0,40}resolved|resolved.{0,40}grudges?)\b/.test(lower) ||
    /\b(don'?t remember any).{0,40}grudges?\b/.test(lower) ||
    /\b(choose not to spend time|don'?t include those people|don'?t allow)\b/.test(lower) ||
    /\b(held grudges when i was younger|grudges when i was younger)\b/.test(lower) ||
    (/\bheld grudges when i was younger\b/.test(lower) &&
      /\b(learned|reflect|forgive|move on|childhood|trauma|trust)\b/.test(lower))
  );
}

/**
 * User explicitly declines to name a specific person or states no one comes to mind.
 * Skips the client-injected specificity follow-up even when the answer is brief.
 */
export function moment4UserDeclinesToNameSpecificPerson(text: string): boolean {
  const lower = normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!lower) return false;
  if (moment4StatesAbsenceOfCurrentGrudge(text)) return true;
  return (
    /\b(no specific person|not a specific person|don'?t have a specific person|doesn'?t have a specific person|does not have a specific person|do not have a specific person)\b/.test(
      lower,
    ) ||
    /\b((a )?person|no one|nobody|anyone) (doesn'?t|does not|didn'?t) come to mind\b/.test(lower) ||
    /\b(can'?t|cannot) think of (a )?(specific )?(person|anyone|someone)\b/.test(lower) ||
    /\b(can'?t|cannot) think of anyone specific\b/.test(lower) ||
    /\bnothing comes to mind\b/.test(lower) ||
    /\bno one in particular\b/.test(lower)
  );
}

/** Stated reasoning, values, or personal pattern — not a bare circular claim. */
export function moment4HasCoherentNonApplicableReasoning(text: string): boolean {
  const lower = normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const wc = countInterviewWords(text);
  if (wc < 15) return false;
  return (
    /\b(because|since|learned|grown|evolv|forgive|forgiving|energy|capacity|boundary|boundaries|reflect|pattern|childhood|trauma|trust|healing|spiritual|quality over|shifted|resolved|moved on|working on|inner|personal growth|intentional|conscious effort|habit of|when i was|as i'?ve|at this point in my life|in my life now|over time|relationships? (are|in) excellent)\b/.test(
      lower,
    ) || /\b(friendships? have shifted|path of (personal|spiritual) growth|surround myself with)\b/.test(lower)
  );
}

/** Genuine bypass: no engagement, near-empty, or circular restatement without personal reasoning. */
export function moment4IsGenuineBypassWithoutEngagement(text: string): boolean {
  const lower = normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  const wc = countInterviewWords(text);
  if (wc <= 3) return true;
  if (wc < 12 && !moment4HasCoherentNonApplicableReasoning(text)) return true;

  const bareNoGrudge =
    /\b(life is too short|don'?t hold grudges|too short to hold|nobody can make me|almost hate anybody)\b/.test(
      lower,
    );
  const hasRealReasoning = moment4HasCoherentNonApplicableReasoning(text);
  if (bareNoGrudge && !hasRealReasoning && wc < 55) return true;

  if (
    wc < 15 &&
    /\b(hard to get rid|happens all the time)\b/.test(lower) &&
    !hasRealReasoning &&
    !moment4HasNamedOrReferencedPerson(text)
  ) {
    return true;
  }

  /** Generic spiritual philosophy without personal reflective content (e.g. 6c0470b7). */
  if (
    /\bi am a spiritual person\b/.test(lower) &&
    /\bforgiving is so good\b/.test(lower) &&
    !/\b(childhood|trauma|when i was|learned to reflect|my younger)\b/.test(lower) &&
    wc < 80
  ) {
    return true;
  }

  return false;
}

/**
 * Specific interpersonal episode (not developmental reflection alone).
 * Used to distinguish valid_non_applicable from moderate/low episodic answers.
 */
export function moment4HasInterpersonalEpisodicAnchor(text: string): boolean {
  if (moment4HasNamedOrReferencedPerson(text)) return true;
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

  if (dyadicOrEpisode) return true;

  /** Growth narrative ("when I was younger I learned...") is not a specific interpersonal episode. */
  if (
    /\bwhen i was (younger|a kid|little|way younger)\b/.test(lower) &&
    /\b(learned|reflect|childhood|trauma|trust|forgive|move on)\b/.test(lower)
  ) {
    return false;
  }

  return false;
}

/**
 * Coherent answer explaining genuine absence of grudges — informative about the construct,
 * not a disclosure failure. Requires stated absence + reasoning, without episodic anchors.
 */
export function moment4QualifiesAsValidNonApplicable(text: string): boolean {
  if (moment4HasNamedOrReferencedPerson(text)) return false;
  if (moment4HasInterpersonalEpisodicAnchor(text)) return false;
  if (moment4IsGenuineBypassWithoutEngagement(text)) return false;
  if (!moment4StatesAbsenceOfCurrentGrudge(text)) return false;
  if (!moment4HasCoherentNonApplicableReasoning(text)) return false;
  return true;
}

/** Heuristic M4 concreteness when the scorer JSON omits or mislabels `response_concreteness`. */
export function inferMoment4ConcretenessFromText(text: string): Moment4ConcretenessLevel | null {
  const combined = (text ?? '').trim();
  if (!combined) return null;
  const wc = countInterviewWords(combined);
  if (wc === 0) return null;
  const lower = combined.toLowerCase();

  if (moment4IsGenuineBypassWithoutEngagement(combined)) return 'absent';
  if (moment4QualifiesAsValidNonApplicable(combined)) return 'valid_non_applicable';

  const namedPerson =
    moment4HasNamedOrReferencedPerson(combined) ||
    /\b(my (friend|mom|dad|mother|father|brother|sister|partner|ex|boss|coworker|colleague|neighbor|roommate|husband|wife))\b/i.test(
      combined,
    ) ||
    /\b(with|from)\s+[A-Z][a-z]{1,24}\b/.test(combined);
  const hasEmotion = /\b(felt|feel|angry|hurt|frustrated|upset|bitter|resentful|ashamed|guilty)\b/i.test(lower);
  if (namedPerson && wc >= 50 && hasEmotion) return 'high';
  if (namedPerson && wc >= 25) return 'moderate';
  if (wc >= 35) return 'low';
  return 'low';
}

/** Prefer model label unless heuristic detects valid_non_applicable or absent bypass more accurately. */
export function reconcileMoment4Concreteness(
  modelLevel: unknown,
  userText: string,
): Moment4ConcretenessLevel | null {
  const normalized = normalizeMoment4Concreteness(modelLevel);
  const heuristic = inferMoment4ConcretenessFromText(userText);
  if (heuristic === 'valid_non_applicable' && (normalized === 'low' || normalized === 'absent' || normalized == null)) {
    return 'valid_non_applicable';
  }
  if (heuristic === 'absent' && (normalized == null || normalized === 'low')) {
    return 'absent';
  }
  return normalized ?? heuristic;
}

/** Resolve M4 concreteness for gate/modifier paths (client-safe — no edge re-export chain). */
export function mergeMoment4ConcretenessForGate(
  storedMoment: unknown,
  rowColumnFallback: unknown,
  moment4UserText?: string | null,
): Moment4ConcretenessLevel | null {
  let fromStored: Moment4ConcretenessLevel | null = null;
  if (storedMoment != null && typeof storedMoment === 'object' && !Array.isArray(storedMoment)) {
    const o = storedMoment as Record<string, unknown>;
    fromStored =
      normalizeMoment4Concreteness(o.response_concreteness) ??
      normalizeMoment4Concreteness(o.specificity);
  }
  const fromColumn = normalizeMoment4Concreteness(rowColumnFallback);
  const raw = fromStored ?? fromColumn;
  const text = (moment4UserText ?? '').trim();
  if (text) return reconcileMoment4Concreteness(raw, text);
  return raw;
}

/**
 * Depth-signal concreteness delta for paired M4/M5 levels.
 * valid_non_applicable: user gave a coherent, reflective answer explaining genuine
 * absence of grudges. This is informative signal about the construct (whether they
 * hold onto grudges) and should not be penalized as a disclosure failure. Distinct
 * from `absent`, which is reserved for genuine bypass/non-engagement.
 */
export function moment4Moment5ConcretenessDepthSignalDelta(
  moment4: string | null | undefined,
  moment5: string | null | undefined,
): number {
  const m4 = normalizeMoment4Concreteness(moment4) ?? '';
  const m5 = (moment5 ?? '').toString().trim().toLowerCase();

  if (m4 === 'valid_non_applicable') {
    return 0;
  }

  if (m4 === 'absent' && m5 === 'absent') return -0.5;
  if ((m4 === 'absent' && m5 === 'low') || (m4 === 'low' && m5 === 'absent')) return -0.35;
  if (m4 === 'low' && m5 === 'low') return -0.3;
  if ((m4 === 'low' && m5 === 'moderate') || (m4 === 'moderate' && m5 === 'low')) return -0.1;
  if (m4 === 'moderate' && m5 === 'moderate') return 0;
  if ((m4 === 'high' && m5 === 'moderate') || (m4 === 'moderate' && m5 === 'high')) return 0.1;
  if (m4 === 'high' && m5 === 'high') return 0.2;
  return 0;
}

export const MOMENT4_RESPONSE_CONCRETENESS_SCORING_INSTRUCTION = `Assess the concreteness of the user's personal response and return as response_concreteness:
absent — no engagement with the question: single-word or near-single-word non-answers, pure abstract philosophizing with no personal reasoning or self-reference (e.g. "Life is too short to hold grudges" with nothing further), or other genuine bypass/evasion.
valid_non_applicable — the user states they do not hold grudges (or have no one who got under their skin) AND provides coherent personal reasoning (values, growth, boundaries, forgiveness practice, resolved past patterns, etc.) WITHOUT naming a specific person or describing a specific event. This is informative about whether they hold onto grudges — not a disclosure failure. Use when ALL three hold: (1) stated absence of current grudges/dislike target, (2) coherent explanation why, (3) no named person or specific episodic event. If they name a person or describe a specific event, use low/moderate/high instead.
low — vague reference to a type of situation or general pattern without naming a specific person, event, or time period, and without qualifying as valid_non_applicable above.
moderate — specific person or situation named but thin on narrative detail.
high — specific person named, concrete event described, emotional content present, and some degree of personal reflection.
Return response_concreteness as a string field using exactly one of: "absent", "valid_non_applicable", "low", "moderate", "high".`;
