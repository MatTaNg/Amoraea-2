export function looksLikeMoment5ConflictValidityClarificationPrompt(text: string | null | undefined): boolean {
  const n = (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!n) return false;
  /** Client-injected canonical copy */
  if (n.includes('actually got tense between you two') || n.includes('resolve pretty smoothly')) return true;
  /**
   * Models often paraphrase (drop "actually"/"pretty", reorder) — still the same construct so we must
   * dedupe TTS/transcript and avoid stacking a second client inject on top of a model-delivered ask.
   */
  const mentionsTenseBetweenYouTwo =
    /\b(between\s+you\s+two|the\s+two\s+of\s+you)\b/.test(n) && /\b(tense|tension|got\s+tense)\b/.test(n);
  const mentionsResolveSmooth =
    /\bresolve[d]?\b/.test(n) && /\b(smoothly|smooth)\b/.test(n);
  const pointOrEitherBranch =
    /\bwas\s+there\s+a\s+point\b/.test(n) ||
    /\bdid\s+it\s+resolve\b/.test(n) ||
    /\bor\s+did\b.*\bresolve\b/i.test(n) ||
    /\bwas\s+it\s+tense\b/i.test(n);
  return mentionsTenseBetweenYouTwo && mentionsResolveSmooth && pointOrEitherBranch;
}

export function moment5ResponseAddsTensionDetail(userText: string): boolean {
  const t = userText.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return false;
  return /\b(argument|fight|disagreement|tension|tense|rupture|strained|strain|upset|hurt|angry|frustrated|resent|blew up|yelled|raised (my|their|our) voice|stopped talking|silent treatment|walked out|cried|crying|defensive|apologiz|repair|make amends)\b/i.test(
    t
  );
}

export type ConflictValidityResult = 'no_conflict' | 'resolved_well' | 'genuine_conflict';

export const M5_NO_CONFLICT_SIGNAL_PHRASES = [
  'no it was fine',
  'nothing got tense',
  'it was never really tense',
  'pretty smooth',
  'resolved smoothly',
  'not really tense',
  'no tension',
  'it was actually smooth',
  'honestly pretty smooth',
  'not much tension',
  'it stayed calm',
  'it was fine',
  'ended fine',
  'resolved fine',
  'worked it out',
  'made up',
  'moved on',
  'not a big deal',
  'calmed down',
  'sorted it out',
  'figured it out',
] as const;

export const M5_RESOLVED_WELL_SIGNAL_PHRASES = [
  'it did get tense',
  'there was tension',
  'it was tense for a bit',
  'it was tense',
  'yeah it got heated',
  'things got a bit tense',
  'it was uncomfortable',
  'there was a moment',
  'we had words',
  'it escalated briefly',
  'feelings were hurt',
  'there was some tension',
] as const;

const PRIOR_M5_TENSION_PATTERN_SOURCE =
  'apologize|disrespect|upset|hurt|conflict|argument|tense|heated|altercation|altercations|fight|yell|yelled|yelling|shouted|shouting|angry|anger|frustrated|frustration|disagreement|confrontation|blowup|blow\\s*up';

/** Prior M5 narrative cues that disambiguate smooth clarification answers toward resolved_well. */
export const PRIOR_M5_TENSION_SIGNAL_PATTERN = new RegExp(PRIOR_M5_TENSION_PATTERN_SOURCE, 'i');

export function priorM5TranscriptHadTension(priorM5Transcript: string): boolean {
  return PRIOR_M5_TENSION_SIGNAL_PATTERN.test(priorM5Transcript);
}

function priorM5TensionTokenMatches(priorM5Transcript: string): string[] {
  const matches: string[] = [];
  for (const m of priorM5Transcript.toLowerCase().matchAll(new RegExp(PRIOR_M5_TENSION_PATTERN_SOURCE, 'gi'))) {
    const token = m[0]?.trim();
    if (token && !matches.includes(token)) matches.push(token);
  }
  return matches;
}

export type ConflictValidityClassificationDebug = {
  result: ConflictValidityResult;
  clarificationResponse: string;
  hasNoConflict: boolean;
  hasResolvedWell: boolean;
  priorHadTension: boolean;
  matchedNoConflictPhrases: string[];
  matchedResolvedWellPhrases: string[];
  priorTensionMatches: string[];
};

export function analyzeConflictValidityClassification(
  clarificationResponse: string,
  priorM5Transcript: string,
): ConflictValidityClassificationDebug {
  const text = clarificationResponse.toLowerCase();
  const matchedNoConflictPhrases = M5_NO_CONFLICT_SIGNAL_PHRASES.filter((s) => text.includes(s));
  const matchedResolvedWellPhrases = M5_RESOLVED_WELL_SIGNAL_PHRASES.filter((s) => text.includes(s));
  const priorTensionMatches = priorM5TensionTokenMatches(priorM5Transcript);
  const hasNoConflict = matchedNoConflictPhrases.length > 0;
  const hasResolvedWell = matchedResolvedWellPhrases.length > 0;
  const priorHadTension = priorTensionMatches.length > 0;
  const result = classifyConflictValidity(clarificationResponse, priorM5Transcript);
  return {
    result,
    clarificationResponse,
    hasNoConflict,
    hasResolvedWell,
    priorHadTension,
    matchedNoConflictPhrases: [...matchedNoConflictPhrases],
    matchedResolvedWellPhrases: [...matchedResolvedWellPhrases],
    priorTensionMatches,
  };
}

/**
 * Classifies the user's answer to the conflict-validity clarification question.
 * Uses prior M5 narrative context to disambiguate smooth-resolution phrasing.
 */
export function classifyConflictValidity(
  clarificationResponse: string,
  priorM5Transcript: string,
): ConflictValidityResult {
  const text = clarificationResponse.toLowerCase();

  const hasNoConflict = M5_NO_CONFLICT_SIGNAL_PHRASES.some((s) => text.includes(s));
  const hasResolvedWell = M5_RESOLVED_WELL_SIGNAL_PHRASES.some((s) => text.includes(s));

  const priorHadTension = priorM5TranscriptHadTension(priorM5Transcript);

  if (hasResolvedWell) return 'resolved_well';
  if (hasNoConflict && !priorHadTension) return 'no_conflict';
  if (hasNoConflict && priorHadTension) return 'resolved_well';

  return 'genuine_conflict';
}

/** @deprecated Prefer {@link classifyConflictValidity} after the clarification question fires. */
export function moment5ConflictValidityIsLow(userText: string): boolean {
  const t = userText.replace(/\s+/g, ' ').trim();
  if (t.length < 24) return false;
  const lower = t.toLowerCase();
  if (moment5ResponseAddsTensionDetail(t)) return false;

  const smoothOrLogistics =
    /\b(resolved pretty smoothly|pretty smooth|smoothly|no big deal|wasn'?t a big deal|not really a conflict|not much conflict|no real conflict|just talked it out|talked it out|we talked and it was fine)\b/i.test(
      lower
    ) ||
    /\b(boundary|boundaries|schedule|scheduling|logistics|plans?|calendar|chores|money|budget)\b/i.test(lower);

  const lowRuptureProcess =
    /\b(we|i)\s+(just\s+)?(talked|discussed|communicated|set|decided|agreed)\b/i.test(lower) &&
    !/\b(then|after that|eventually)\b.{0,80}\b(apologiz|repair|made up|resolved|came back|owned|took responsibility)\b/i.test(
      lower
    );

  return smoothOrLogistics || lowRuptureProcess;
}

/**
 * Moment 5 only: user disclosed death / bereavement (not merely breakup or estrangement).
 * Conservative on metaphors ("death of the relationship") and on "lost them" without bereavement cues.
 */
export function moment5ResponseContainsDeathDisclosure(userText: string): boolean {
  const raw = userText.replace(/\s+/g, ' ').trim();
  if (raw.length < 14) return false;
  const lower = raw.toLowerCase();

  const splitOrMetaphorBreakup =
    /\b(dead to me|dead to us|relationship (is |was )?dead to)\b/i.test(raw) ||
    /\bdeath of (the |our )?relationship\b/i.test(lower);
  if (splitOrMetaphorBreakup) {
    const personBereavement =
      /\b(passed away|passed on|funeral|burial|memorial service|deceased|suicide)\b/i.test(lower) ||
      /\bi lost my (dad|father|mom|mother|mum|parents|brother|sister|son|daughter|baby)\b/i.test(lower) ||
      /\b(my|our|his|her|their)\s+(dad|mom|mother|father|brother|sister|son|daughter|spouse|partner|wife|husband)\s+died\b/i.test(
        lower,
      ) ||
      (/\b(she|he|they)\s+died\b/i.test(lower) && !/\bnobody\s+died\b/i.test(lower));
    if (!personBereavement) return false;
  }

  const estrangementLost =
    /\blost (him|her|them)\b/i.test(lower) &&
    /\b(after|when|because)\b/i.test(lower) &&
    /\b(break up|broke up|cheat|cheating|left me|walked out|divorce|split up|ghosted|argument|fight)\b/i.test(lower) &&
    !/\b(died|passed away|passed on|death|funeral|deceased|suicide|burial|memorial)\b/i.test(lower);
  if (estrangementLost) return false;

  const deathLexicon =
    /\b(died|passed away|passed on|deceased|funeral|memorial service|burial|cremat|bereavement|bereaved|suicide|took (his|her|their) own life|lost (his|her|their) life|fatal|homicide|stillborn|miscarriage|in hospice)\b/i.test(
      lower,
    );
  const explicitDeath =
    deathLexicon ||
    /\bdeath of (my|our|his|her|their)\b/i.test(lower) ||
    /\b(my|our|his|her|their)\s+(dad|mom|mother|father|parent|brother|sister|son|daughter|spouse|partner|wife|husband)\s+(died|passed)\b/i.test(lower);

  const lostFamilyMember =
    /\bi lost (my )?(dad|father|mom|mother|mum|parents|brother|sister|son|daughter|child|children|baby|grandma|grandmother|grandpa|grandfather)\b/i.test(
      lower,
    );
  const lostPartnerOrFriendWithDeathCue =
    /\bi lost (my )?(husband|wife|spouse|partner|friend|gf|bf)\b/i.test(lower) && deathLexicon;
  const lostCloseRelative = lostFamilyMember || lostPartnerOrFriendWithDeathCue;

  const lostPronounWithBereavementCue =
    /\blost (him|her|them)\b/i.test(lower) &&
    /\b(died|passed away|passed on|death|funeral|burial|memorial|gone forever|taken (from us|too soon)|no longer (with us|here))\b/i.test(lower);

  const goneEuphemism =
    /\b(they'?re|they are|he'?s|she'?s|he is|she is) gone\b/i.test(lower) &&
    /\b(died|passed away|passed on|death|funeral|burial|memorial|lost (him|her|them))\b/i.test(lower);

  const capitalizedNameDied =
    /\b[A-Z][a-z]{1,24}\s+(died|passed away|passed on)\b/.test(raw);

  return explicitDeath || lostCloseRelative || lostPronounWithBereavementCue || goneEuphemism || capitalizedNameDied;
}
