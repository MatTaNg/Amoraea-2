/** User-facing; when set in keyEvidence, participant skipped the remainder of this segment after a frustration offer. */
export const SKIPPED_BY_USER_FRUSTRATION_EVIDENCE =
  'Not scored — participant chose to skip the remaining prompt in this segment after a frustration signal.';

/** User-facing; when set in keyEvidence, the slice did not receive the prompt (session ended, audio, etc.). */
export const NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE =
  'Not assessed — session ended due to technical difficulties before this prompt was delivered.';

/**
 * True when the evidence line marks missing data from technical interruption, not a scored “0” performance.
 * Per-marker keyEvidence in scenario slices.
 */
export function isNotAssessedDueToTechnicalInterruption(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const t = text.trim().toLowerCase();
  if (t === NOT_ASSESSED_SESSION_ENDED_TECHNICAL_EVIDENCE.trim().toLowerCase()) return true;
  return (
    /\bnot assessed\b/.test(t) &&
    (/\b(session ended|ended early)\b.*\btechnical\b/.test(t) ||
      /\btechnical (difficult|interruption|failure)\b/.test(t) ||
      /\bbefore this prompt (was )?delivered\b/.test(t) ||
      /\binterview (ended|terminated)\b.*\btechnical\b/.test(t))
  );
}

/**
 * True when programmatic response-depth −1 may apply for this marker: model/keyEvidence
 * indicates nothing substantive to score (empty, recovery line, insufficient-evidence phrasing, etc.).
 * Returns false for technical non-assessment and frustration skip so we do not stack penalties.
 */
export function evidenceAbsentForResponseDepthModifier(text: string | null | undefined): boolean {
  if (text == null || typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (isNotAssessedDueToTechnicalInterruption(trimmed)) return false;
  if (trimmed === SKIPPED_BY_USER_FRUSTRATION_EVIDENCE) return false;

  const lower = trimmed.toLowerCase();
  if (/score\s+recovered\s+from\s+model\s+output/i.test(trimmed)) return true;
  if (/insufficient\s+evidence/.test(lower)) return true;
  if (/no\s+assessable\s+evidence/.test(lower)) return true;
  if (/response\s+too\s+brief\s+to\s+assess/.test(lower)) return true;
  if (/too\s+brief\s+to\s+assess/.test(lower)) return true;

  if (isNoEvidenceText(trimmed)) return true;
  return false;
}

export function isNoEvidenceText(text: string | null | undefined): boolean {
  if (!text) return false;
  if (text.trim() === SKIPPED_BY_USER_FRUSTRATION_EVIDENCE) return true;
  const t = text.trim().toLowerCase();
  return (
    /no\s+[a-z_ ]+\s+content\s+in\s+this\s+(scenario|moment|interview)/i.test(t) ||
    /not\s+directly\s+assessed/i.test(t) ||
    /insufficient\s+evidence/i.test(t) ||
    /no\s+evidence\s+(was\s+)?(available|observed|surfaced)/i.test(t) ||
    /no substantive engagement with (the )?grudge/i.test(t) ||
    /moment 4[:\s]+no substantive engagement/i.test(t) ||
    /deflection, avoidance, or absent signal/i.test(t) ||
    /appreciation (was )?not assessed from this moment/i.test(t) ||
    /not assessed from this moment.*appreciation/i.test(t) ||
    /limited (close[- ]relationship|lived) (experience|opportunity)/i.test(t) ||
    /\bnot scored\b.*\bskip\b.*\bfrustration\b/i.test(t)
  );
}

export function normalizeScoresByEvidence(
  scores: Record<string, number | null | undefined> | null | undefined,
  keyEvidence: Record<string, string> | null | undefined
): Record<string, number> {
  if (!scores) return {};
  const out: Record<string, number> = {};
  Object.entries(scores).forEach(([id, raw]) => {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return;
    const ev = keyEvidence?.[id];
    if (isNoEvidenceText(ev)) return;
    out[id] = raw;
  });
  return out;
}

/** Named fixtures for tests — must NOT count as a temporally specific moment (habitual / values-only). */
export const MOMENT5_SPECIFIC_MOMENT_NEGATIVE_EXAMPLES = [
  "I try to acknowledge when people I care about do something significant, I'll send a message or take them out for a meal.",
  'I usually get people gifts for big occasions — birthdays, promotions, graduations',
  "I think it's important to let people know you're proud of them",
] as const;

/** Named fixtures — must count as a specific occasion / anchored narrative. */
export const MOMENT5_SPECIFIC_MOMENT_POSITIVE_EXAMPLES = [
  'I threw my friend a birthday party when she turned 30',
  'I flew in as a surprise when she defended her dissertation',
  'I wrote my partner a letter after they got the promotion',
] as const;

/**
 * True when the answer anchors to a particular occasion or past narrative — not habitual present-tense pattern.
 * Generic "I try to / I usually / I'll…" and values-only lines must return false.
 */
export function hasMoment5TemporallySpecificMoment(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  const lower = t.toLowerCase();

  if (
    /\b(i try to|i usually|i always|i'?ll often|i tend to|i make sure to|when people i care about do something|for big occasions)\b/.test(
      lower
    )
  ) {
    return false;
  }
  if (/\bi think it'?s important\b/.test(lower)) {
    const hasTemporalAnchor =
      /\b(when|after|threw|flew|wrote|party|turned|graduated|promotion|yesterday|last week|years ago|that time)\b/i.test(t);
    if (!hasTemporalAnchor) return false;
  }

  if (
    /\b(i (threw|flew|wrote|organized|planned|hosted|surprised)|we (threw|hosted|celebrated)|she (opened|cried)|he (opened|read))\b/i.test(
      lower
    )
  ) {
    return true;
  }
  if (
    /\b(when she (turned|graduated|defended)|when he (got|turned)|after (his|her|their) (promotion|birthday)|on (her|his|their) \d{1,2}(st|nd|rd|th)?\b|defended her dissertation|birthday party|after they got the promotion)\b/i.test(
      lower
    )
  ) {
    return true;
  }
  if (/\b(years ago|that time|one time|last (year|month|week)|yesterday)\b/.test(lower)) {
    return true;
  }
  if (/\b(my (friend|partner|wife|husband|mom|dad|mother|father))\b/i.test(lower)) {
    if (/\b(when|after|threw|wrote|flew|surprise|party|letter|turned)\b/i.test(t)) return true;
  }

  return false;
}

export function evaluateMoment5AppreciationSpecificity(text: string): {
  hasSpecificPerson: boolean;
  hasSpecificMoment: boolean;
  hasAttunement: boolean;
  hasRelationalSpecificity: boolean;
  isGeneric: boolean;
} {
  const t = text.toLowerCase().trim();
  if (!t || t.length < 12) {
    return {
      hasSpecificPerson: false,
      hasSpecificMoment: false,
      hasAttunement: false,
      hasRelationalSpecificity: false,
      isGeneric: true,
    };
  }
  const hasSpecificPerson =
    /\b(my|our)\s+(partner|wife|husband|boyfriend|girlfriend|friend|mom|mother|dad|father|sister|brother|cousin|aunt|uncle|daughter|son|teammate|roommate)\b|\b(he|she|they)\b/.test(
      t
    );
  const hasSpecificMoment = hasMoment5TemporallySpecificMoment(text);
  const hasAttunement =
    /\bneeded|was going through|felt|feeling|stressed|upset|overwhelmed|encourag|support|noticed|because they|hard year|hard time\b/.test(
      t
    );
  const hasConnectionMoment =
    /\b(in that moment|when (she|he|they) (opened it|saw it|heard it|responded)|we hugged|teared up|started crying|smiled and|it landed|really touched)\b/.test(
      t
    );
  const hasWordsExchanged =
    /"(.*?)"|\b(she said|he said|they said|i said|i told (her|him|them)|they told me)\b/.test(
      t
    );
  const hasMeaningDetail =
    /\b(meaningful|mattered|why it mattered|what made it meaningful|because (she|he|they) (had|were|was)|for (her|him|them) specifically)\b/.test(
      t
    );
  const hasRelationalSpecificity = hasConnectionMoment || hasWordsExchanged || hasMeaningDetail;
  const isGeneric = !(hasSpecificPerson && hasSpecificMoment && hasAttunement && hasRelationalSpecificity);
  return {
    hasSpecificPerson,
    hasSpecificMoment,
    hasAttunement,
    hasRelationalSpecificity,
    isGeneric,
  };
}

/** Client-injected Moment 5 (follows Moment 4 threshold answer). */
export const MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT =
  'Think of a time when you had a conflict with someone important to you. What happened, and how did things get resolved between you two?';

export const MOMENT_5_ACCOUNTABILITY_PROBE_TEXT = 'What was your part in how it unfolded?';

/** Client-only — when the example may not contain a genuine conflict before accountability scoring. */
export const MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT =
  'Was there a point where it actually got tense between you two, or did it resolve pretty smoothly?';

/** Moment 5 only — when the user disclosed bereavement/death, prepend one brief ack before the scripted probe (same assistant turn). */
export const MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT =
  'I appreciate you getting vulnerable with me. What was your part in how it unfolded?';

/** Client-only — concrete anchor before accountability when the first answer is generic/process-only. */
export const MOMENT_5_SPECIFICITY_REDIRECT_TEXT =
  'Can you think of a specific time — maybe with a partner, friend, or family member — and walk me through what happened?';

/** Alternate client-only redirect (detection only). */
export const MOMENT_5_SPECIFICITY_REDIRECT_ALT_TEXT =
  'Is there a specific person or situation that comes to mind when you think about conflict?';

/** After redirect, user still abstract — offer to move on (no accountability probe). */
export const MOMENT_5_PERSISTENT_ABSTRACT_MOVE_ON_TEXT =
  "That's okay — we don't need to force a specific story. Whenever you're ready, we can wrap up.";

/** True when assistant turn is the scripted Moment 5 specificity redirect (before accountability probe). */
export function looksLikeMoment5SpecificityRedirectPrompt(text: string | null | undefined): boolean {
  const n = (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!n) return false;
  return (
    (n.includes('specific time') && n.includes('walk me through')) ||
    (n.includes('specific person') && n.includes('comes to mind') && n.includes('conflict'))
  );
}

export function looksLikeMoment5ConflictValidityClarificationPrompt(text: string | null | undefined): boolean {
  const n = (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  return n.includes('actually got tense between you two') || n.includes('resolve pretty smoothly');
}

export function moment5ResponseAddsTensionDetail(userText: string): boolean {
  const t = userText.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return false;
  return /\b(argument|fight|disagreement|tension|tense|rupture|strained|strain|upset|hurt|angry|frustrated|resent|blew up|yelled|raised (my|their|our) voice|stopped talking|silent treatment|walked out|cried|crying|defensive|apologiz|repair|make amends)\b/i.test(
    t
  );
}

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

/**
 * Moment 5 only: true when the user anchored to a specific relationship/person and a particular episode,
 * not only generic conflict advice or first-person process habits.
 */
export function moment5PersonalNarrativeHasConcreteAnchor(userText: string): boolean {
  const raw = userText.replace(/\s+/g, ' ').trim();
  if (!raw || raw.length < 28) return false;
  const t = raw;
  const lower = t.toLowerCase();
  const wc = t.split(/\s+/).filter(Boolean).length;

  const instructionalYouHeavy =
    /\b(you should|you need to|you have to|when you have (a )?conflict|if you('re| are) (in|having))\b/i.test(lower) &&
    (t.match(/\byou\b/gi) ?? []).length >= 2 &&
    (t.match(/\bi\b/gi) ?? []).length <= 2 &&
    !/\b(my |me,|me |mine |i was |i had |with my |our )\b/i.test(lower);

  if (instructionalYouHeavy) return false;

  const genericProcessOnly =
    /^\s*(well |honestly |so |look, )?i (usually|often|always|typically|generally|just|try to|tend to)\s+(address|handle|discuss|talk|communicate|listen|find|navigate|mediate|work through|figure out)\b/i.test(
      lower,
    ) &&
    !/\b(she|he|they|we had|we got|my |our |friend|partner|boss|mom|dad)\b/i.test(lower) &&
    wc < 70;

  if (genericProcessOnly) return false;

  const relationalAnchor =
    /\b(my (mom|mum|dad|mother|father|parents|brother|sister|son|daughter|kids|child|children|husband|wife|partner|spouse|ex|boss|friend|friends|coworker|colleague|neighbor|roommate|gf|bf|aunt|uncle|cousin|niece|nephew|buddy|teammate|client|coach|landlord|tenant))\b/i.test(
      t,
    ) ||
    /\bmy\s+(mother|father|sister|brother)-in-law\b/i.test(lower) ||
    /\b(my|our)\s+(parents-in-law|in-laws)\b/i.test(lower) ||
    /\bmy\s+step(mother|father|dad|mom|brother|sister|sibling|kid|child)\b/i.test(lower) ||
    /\b(?:my\s+)?(?:fiance|fiancé|fiancée)\b/i.test(lower) ||
    /\b(a|my)\s+buddy\b/i.test(lower) ||
    /** "my best friend", "my late best friend" — not matched by `my friend` (word immediately after my). */
    /\bmy\s+(?:\w+\s+){0,3}friend\b/i.test(lower) ||
    /\b(best|close|childhood)\s+friend\b/i.test(lower) ||
    /\b(my|our|the|a)\s+(friend|partner|ex|boss|coworker|colleague|neighbor|manager|teammate|flatmate)\b/i.test(lower) ||
    /\bsomeone(?:\s+i\s+(?:trusted|cared\s+about|knew(?:\s+well)?)|\s+who|\s+that|\s+important|\s+close(?:\s+to)?)\b/i.test(
      lower,
    ) ||
    /\b(a|the) (woman|man|person)\b/i.test(lower) ||
    /\b(i was dating|we were dating|my relationship|with my )\b/i.test(lower) ||
    /\b(the|this)\s+(guy|gal|woman|man)\s+i\s+(was\s+)?(seeing|dating|living\s+with)\b/i.test(lower);

  const dyadicOrEpisode =
    /\bwe ('?ve|had|got|were|argued|fought|disagreed|talked|made up|resolved|reconciled)\b/i.test(lower) ||
    /\bwe (had a|had an|got into (a )?)(fight|argument|disagreement)\b/i.test(lower) ||
    /\b(had|have)\s+an?\s+(fight|argument|disagreement)\b/i.test(lower) ||
    /\bwe\s+stopped\s+(talking|texting|hanging)\b/i.test(lower) ||
    /\bstopped\s+(talking|texting)\s+(to\s+each\s+other|completely)\b/i.test(lower) ||
    /\b(blew\s+up|blown\s+up|shut\s+down|stonewall(ed|ing)?|silent\s+treatment|cold\s+shoulder)\b/i.test(lower) ||
    /\b(ghost(ed)?|blocked\s+me|unfollow(ed)?)\b/i.test(lower) ||
    /\b(cheated\s+on|lied\s+to|betray(ed)?|crossed\s+(a\s+)?line)\b/i.test(lower) ||
    /\b(apologiz(ed|ing)|(?:said|offered)\s+an?\s+apology|forg(?:ave|ive|iveness))\b/i.test(lower) ||
    /\b(clear(ed)?\s+the\s+air|make\s+amends|sat\s+down\s+(together\s+)?to\s+talk|couples\s+therapy)\b/i.test(lower) ||
    /\b(she|he|they) (said|told me|texted|called|left|walked out|yelled|was upset|didn'?t)\b/i.test(lower) ||
    /\b(i|we) (went to|walked out|during the|after (she|he|they|that)|before (she|he|that))\b/i.test(lower);

  const situationalAnchor =
    /\b(last (week|month|year|night|summer|time)|at work|at home|during (the )?(vacation|trip|party|holiday|call)|when we were)\b/i.test(
      lower,
    ) ||
    /\b(that\s+night|the\s+next\s+morning|right\s+before\s+the\s+wedding|on\s+the\s+drive\s+home|over\s+text|in\s+the\s+kitchen|at\s+dinner)\b/i.test(
      lower,
    ) ||
    /\b(a\s+few\s+years\s+ago|back\s+in\s+(high\s+school|college)|during\s+covid|when\s+we\s+were\s+living)\b/i.test(
      lower,
    ) ||
    /\bafter\s+(she|he|they)\s+moved\s+out\b/i.test(lower) ||
    /\b(about (the )?(money|kids|trust|cheating|sleep|chores|deadline|schedule))\b/i.test(lower);

  /**
   * Safety net for long first-person narratives that clearly describe one conflict episode
   * but can miss narrower regex combinations (e.g. "there was a time ... we cut each other out ...").
   */
  const explicitNarrativeLead =
    /\b(there was a time|one time|at one point|i remember when)\b/i.test(lower) &&
    /\b(i|my|we)\b/i.test(lower);
  const conflictEpisodeLexicon =
    /\b(argument|fight|disagreement|stopped talking|stopped texting|cut each other out|had a falling out|fell out|made up|talked again|worked out|resolved)\b/i.test(
      lower,
    );
  const strongNarrativeOverride =
    wc >= 35 && explicitNarrativeLead && relationalAnchor && conflictEpisodeLexicon;

  const concrete =
    strongNarrativeOverride ||
    (relationalAnchor && (dyadicOrEpisode || situationalAnchor || wc >= 40)) ||
    (dyadicOrEpisode && (relationalAnchor || situationalAnchor || wc >= 28));

  if (wc >= 80 || /\bbest friend\b/i.test(lower) || /\bthere was a time\b/i.test(lower)) {
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e43434' },
      body: JSON.stringify({
        sessionId: 'e43434',
        runId: 'm5-anchor-debug',
        hypothesisId: 'H2_anchor_false_negative',
        location: 'probeAndScoringUtils.ts:moment5PersonalNarrativeHasConcreteAnchor',
        message: 'm5_anchor_eval',
        data: {
          wc,
          relationalAnchor,
          dyadicOrEpisode,
          situationalAnchor,
          strongNarrativeOverride,
          concrete,
          preview: raw.slice(0, 220),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }

  return concrete;
}

/** Single runtime pivot when the user has no strong behavioral example (legacy transcripts only). */
export const MOMENT_5_INEXPERIENCE_FALLBACK_QUESTION =
  "What would meaningful celebration look like to you — either something you'd want to do for someone, or something that would feel meaningful to receive?";

export function isMoment5InexperienceFallbackPrompt(text: string): boolean {
  const lower = text.replace(/\s+/g, ' ').trim().toLowerCase();
  return (
    lower.includes('what would meaningful celebration') &&
    lower.includes('look like to you') &&
    lower.includes('want to do for someone') &&
    lower.includes('meaningful to receive')
  );
}

/** True when assistant turn is the scripted Moment 5 accountability follow-up probe. */
export function looksLikeMoment5AccountabilityProbeAssistantPrompt(text: string | null | undefined): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  return (
    t.includes('what was your part in how it unfolded') ||
    (t.includes('your part') && t.includes('unfolded'))
  );
}

export type Moment5AccountabilityProbeEvaluation = {
  shouldProbe: boolean;
  /** Machine-readable: why we fire the scripted probe, or why we skip it. */
  reason:
    | 'lacks_explicit_self_accountability'
    | 'explicit_self_accountability'
    | 'too_short'
    | 'decline_or_vague_evade';
  selfReference: Moment5AccountabilitySelfReferenceEvaluation;
};

export type Moment5AccountabilitySelfReferenceType =
  | 'general_advice'
  | 'specific_ownership'
  | 'boundary_expression'
  | 'process_description';

export type Moment5AccountabilitySelfReferenceEvaluation = {
  accountability_probe_self_reference_detected: boolean;
  self_reference_type: Moment5AccountabilitySelfReferenceType;
};

/**
 * Voluntary ownership of one's part in the conflict — **not** mere first-person narration
 * ("I felt…", "I said…", "I remember…") which can still be blame-only.
 */
export function moment5AnswerHasExplicitSelfAccountability(userText: string): boolean {
  const t = userText.replace(/\s+/g, ' ').trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  return (
    /\bi\s+contributed\b/i.test(t) ||
    /\bmy\s+role\s+(was|here|in\s+that)\b/i.test(lower) ||
    /\bmy\s+part\s+(was|here|in\s+that)\b/i.test(lower) ||
    /\bhow\s+i\s+(contributed|acted|handled|messed up|made things worse|made it worse)\b/i.test(lower) ||
    /\bwhat\s+i\s+did\s+wrong\b/i.test(lower) ||
    /\bI\s+realiz(?:e|ed)\s+i\b/i.test(t) ||
    /\bI\s+realis(?:e|ed)\s+i\b/i.test(t) ||
    /\bi\s+also\s+(knew|realized|realised|should|could|regret|thought\s+i\s+was|had\s+to\s+admit|felt\s+responsible|took\s+(some\s+)?(blame|responsibility)|owned)\b/i.test(lower) ||
    /\bmy\s+(fault|mistake)\b/i.test(lower) ||
    /\b(that|this)\s+was\s+on\s+me\b/i.test(lower) ||
    /\bI\s+take\s+responsibility\b/i.test(t) ||
    /\bi\s+took\s+responsibility\b/i.test(lower) ||
    /\bi\s+take\s+ownership\b/i.test(lower) ||
    /\bi\s+took\s+ownership\b/i.test(lower) ||
    /\bi\s+own(?:ed)?\s+(my|that|it)\b/i.test(lower) ||
    /\bi\s+own(?:ed)?\s+my\s+side\b/i.test(lower) ||
    /\bmy\s+side\s+of\s+(this|it|that)\b/i.test(lower) ||
    /\bmy\s+responsibilit(?:y|ies)\s+was\b/i.test(lower) ||
    /\bI\s+was\s+(wrong|at fault|to blame|unfair|defensive|too harsh)\b/i.test(t) ||
    /\bi\s+was\s+(out\s+of\s+line|disrespectful|controlling|accusatory)\b/i.test(lower) ||
    /\bi\s+crossed\s+a\s+line\b/i.test(lower) ||
    /\bi\s+did\s+(yell|raise\s+my\s+voice|snap|shut\s+down|stonewall|withdraw|avoid)\b/i.test(lower) ||
    /\bi\s+shut\s+(him|her|them)\s+out\b/i.test(lower) ||
    /\bi\s+(wasn'?t|was\s+not|didn'?t)\s+listen(?:ing)?\b/i.test(lower) ||
    /\bi\s+(got|became)\s+(defensive|reactive)\b/i.test(lower) ||
    /\bi\s+got\s+accusatory\b/i.test(lower) ||
    /\bi\s+came\s+in\s+hot\b/i.test(lower) ||
    /\bi\s+came\s+at\s+(him|her|them)\s+hard\b/i.test(lower) ||
    /\bI\s+(should|could)\s+have\b/i.test(t) ||
    /\bi\s+should(?:n'?t| not)\s+have\s+reacted\s+like\s+that\b/i.test(lower) ||
    /\bi\s+could\s+have\s+communicat(?:ed|e)\s+better\b/i.test(lower) ||
    /\bI\s+wish\s+I(\s+had)?\b/i.test(t) ||
    /\bI\s+(apologized|apologised)\b/i.test(t) ||
    /\bI\s+('?m|am)\s+sorry\s+(for\s+)?(what\s+i|my|how\s+i)\b/i.test(t) ||
    /\bI\s+(owned|admitted)\b/i.test(t) ||
    /\bI\s+acknowledged\s+(that|my|the|I)\b/i.test(t) ||
    /\bI\s+(overreacted|escalated)\b/i.test(t) ||
    /\bi\s+handled\s+(it|that)\s+(badly|poorly)\b/i.test(lower) ||
    /\bi\s+was\s+projecting\b/i.test(lower) ||
    /\bi\s+(made|was\s+making)\s+assumptions\b/i.test(lower) ||
    /\bi\s+jumped\s+to\s+conclusions\b/i.test(lower) ||
    /\bmy\s+share\s+of\b/i.test(lower) ||
    /\b(part|role)\s+i\s+(played|had|took)\b/i.test(lower) ||
    /\bI\s+regret\s+(what\s+i|my|how\s+i|that\s+i)\b/i.test(t) ||
    /\bI\s+see\s+(now\s+)?that\s+i\b/i.test(t) ||
    (/\blooking\s+back,?\s+i\b/i.test(lower) &&
      /\b(wrong|should|could|regret|fault|mistake|overreact|unfair|defensive)\b/i.test(lower))
  );
}

export function evaluateMoment5AccountabilitySelfReference(
  userText: string
): Moment5AccountabilitySelfReferenceEvaluation {
  const t = userText.replace(/\s+/g, ' ').trim();
  const lower = t.toLowerCase();
  if (!t) {
    return { accountability_probe_self_reference_detected: false, self_reference_type: 'process_description' };
  }

  const boundaryExpression =
    /\bi\s+(would\s+have\s+appreciated|would'?ve\s+appreciated|needed|need|wanted|want|set\s+a\s+limit|set\s+a\s+boundary)\b/i.test(
      lower
    ) ||
    /\bi\s+don'?t\s+take\s+(your|his|her|their|someone'?s)?\s*(opinion|criticism|feedback)\s+seriously\b/i.test(
      lower
    ) ||
    /\bi\s+told\s+(him|her|them)\b.{0,120}\b(appreciated|needed|need|wanted|want|don'?t\s+take|limit|boundary)\b/i.test(
      lower
    );
  if (boundaryExpression) {
    return { accountability_probe_self_reference_detected: true, self_reference_type: 'boundary_expression' };
  }

  const specificConflictSelfReference =
    moment5AnswerHasExplicitSelfAccountability(t) ||
    /\bi\s+(yelled|shouted|snapped|raised\s+my\s+voice|got\s+triggered|was\s+triggered|shut\s+down|withdrew|walked\s+away|stormed\s+off|avoided|stonewalled|got\s+defensive|became\s+defensive|overreacted|escalated|calmed\s+down|regulated\s+myself|apologized|apologised)\b/i.test(
      lower
    ) ||
    /\bi\s+(didn'?t|did\s+not)\s+(communicate|listen|say|explain|understand|handle)\b/i.test(lower) ||
    /\bi\s+felt\s+(hurt|dismissed|angry|upset|triggered|defensive|insecure|attacked|criticized|criticised|disrespected)\b/i.test(
      lower
    ) ||
    /\bi\s+(said|told|asked)\s+(him|her|them)\b/i.test(lower) ||
    /\bi\s+was\s+the\s+one\s+who\b/i.test(lower) ||
    /\bi\s+got\s+triggered\s+because\b/i.test(lower) ||
    /\bi\s+was\s+(just\s+)?(starting\s+out|insecure)\b/i.test(lower);
  if (specificConflictSelfReference) {
    return { accountability_probe_self_reference_detected: true, self_reference_type: 'specific_ownership' };
  }

  const generalAdvice =
    /\bi\s+(think|believe|find|feel)\s+(it'?s|it\s+is)?\s*(important|helpful|better|good|useful)\b/i.test(lower) ||
    /\b(communication|listening|taking\s+turns|repeat(?:ing)?\s+back)\s+is\s+(just\s+)?(really\s+)?(important|helpful|useful)\b/i.test(
      lower
    ) ||
    /\bi\s+(always|usually|generally|try\s+to|like\s+to|make\s+sure)\b.{0,80}\b(conflict|heard|understood|listen|repeat|communicat|take\s+turns)\b/i.test(
      lower
    );
  return {
    accountability_probe_self_reference_detected: false,
    self_reference_type: generalAdvice ? 'general_advice' : 'process_description',
  };
}

/**
 * At most one scripted follow-up: fire unless the user already names their **own** contribution
 * to the tension (not only story-telling or other-blame).
 */
export function evaluateMoment5AccountabilityProbe(userText: string): Moment5AccountabilityProbeEvaluation {
  const t = userText.replace(/\s+/g, ' ').trim();
  const lower = t.toLowerCase();
  const wordCount = t.split(/\s+/).filter(Boolean).length;
  const selfReference = evaluateMoment5AccountabilitySelfReference(t);
  if (t.length < 36 || wordCount < 10) {
    return { shouldProbe: false, reason: 'too_short', selfReference };
  }
  if (/\b(i don'?t have|nothing comes|can'?t think|no conflict|never really|not sure what to say)\b/i.test(lower) && t.length < 100) {
    return { shouldProbe: false, reason: 'decline_or_vague_evade', selfReference };
  }
  if (selfReference.accountability_probe_self_reference_detected) {
    return { shouldProbe: false, reason: 'explicit_self_accountability', selfReference };
  }
  return { shouldProbe: true, reason: 'lacks_explicit_self_accountability', selfReference };
}

/** @deprecated Prefer {@link evaluateMoment5AccountabilityProbe} for logging; boolean is equivalent to `shouldProbe`. */
export function shouldProbeMoment5NoSelfReference(userText: string): boolean {
  return evaluateMoment5AccountabilityProbe(userText).shouldProbe;
}

/**
 * True when assistant content embeds the **scripted Moment 5 conflict question** (possibly inside a
 * longer client bundle with reflection + pivot). Use for closing gates and post-M5 user-turn counting
 * when {@link isMoment5AssistantAnchor} is too strict for sanitized typography.
 */
export function transcriptAssistantContainsMoment5PrimaryConflictQuestion(content: string | null | undefined): boolean {
  if (content == null || typeof content !== 'string') return false;
  if (looksLikeMoment5AccountabilityProbeAssistantPrompt(content)) return false;
  if (isMoment5AssistantAnchor(content)) return true;
  const lower = content.replace(/\s+/g, ' ').trim().toLowerCase();
  const hasConflictIntro = lower.includes('think of a time when you had a conflict with someone important');
  const hasResolutionAsk =
    lower.includes('how did things get resolved') ||
    (lower.includes('what happened') && lower.includes('resolved'));
  return hasConflictIntro && hasResolutionAsk;
}

/**
 * True when an assistant turn is (or contains) the Moment 5 primary prompt, legacy appreciation prompts,
 * or related pivots. Used to slice the transcript for post-interview Moment 5 scoring.
 */
export function isMoment5AssistantAnchor(content: string | null | undefined): boolean {
  if (!content) return false;
  const c = content.replace(/\s+/g, ' ').trim();
  const lower = c.toLowerCase();
  if (lower.includes('conflict or disagreement with someone important')) return true;
  if (
    lower.includes('think of a time when you had a conflict with someone important') &&
    lower.includes('how did things get resolved')
  ) {
    return true;
  }
  /** Common Sonnet paraphrase of the scripted conflict prompt (not matched by canonical strings). */
  if (
    /\btell me about a specific conflict\b/i.test(c) &&
    /\b(someone important|important in your life|important to you)\b/i.test(lower) &&
    /\b(resolved|resolution|didn'?t)\b/i.test(lower)
  ) {
    return true;
  }
  if (lower.includes('tell me about a time you had a conflict') && lower.includes('how did it get resolved')) {
    return true;
  }
  if (isMoment5InexperienceFallbackPrompt(c)) return true;
  if (lower.includes('think of a time you really celebrated someone')) return true;
  if (lower.includes('really celebrated') && /\b(your life|in your life|them that|show them)\b/.test(lower)) {
    return true;
  }
  if (lower.includes('really got to show someone close to you') && lower.includes('mattered')) return true;
  if (
    /\b(moment you celebrated someone|celebrated someone who mattered)\b/.test(lower) ||
    (/\bcelebrated someone\b/.test(lower) &&
      /\b(mattered|meaningful|close to you|in your life|your life)\b/.test(lower))
  ) {
    return true;
  }
  if (
    /\bshow(?:ed)? up for someone\b/.test(lower) &&
    /\b(what comes to mind|time|moment|talk about|can we|love to hear|curious|tell me)\b/.test(lower)
  ) {
    return true;
  }
  if (lower.includes('what did you do to show them that')) return true;
  if (
    /\bwarmer beat from your own life\b/.test(lower) &&
    /\b(celebrat|appreciat|generous|show up)\b/.test(lower)
  ) {
    return true;
  }
  if (
    /\bhearing where that line is for you\b/.test(lower) &&
    /\bgenerous instead of careful\b/.test(lower)
  ) {
    return true;
  }
  if (
    /\bhow you name that threshold\b/.test(lower) &&
    /\b(show them|celebrat|warmer|generous)\b/.test(lower)
  ) {
    return true;
  }
  if (
    /\btaking that in\b/.test(lower) &&
    /\b(celebrat|appreciat|warmer)\b/.test(lower) &&
    /\b(side|moment|beat|life)\b/.test(lower)
  ) {
    return true;
  }
  return false;
}

/** @deprecated Use {@link isMoment5AssistantAnchor} — name retained for legacy imports. */
export const isMoment5AppreciationAssistantAnchor = isMoment5AssistantAnchor;

export function moment5AcknowledgesLimitedCloseRelationshipExperience(text: string): boolean {
  const t = text.toLowerCase();
  return /\b(haven'?t had many|haven'?t really had|few (close )?(relationships|friends)|not many (close )?(relationships|friends)|don'?t have many (close )?(relationships|friends|people)|limited experience|not a lot of close|no close friends|family (was never|is never|wasn'?t|isn'?t) (very )?(demonstrative|affectionate|warm)|family was never (really )?(demonstrative|affectionate)|not (very|really) demonstrative|hard to think of (a |any )?specific|don'?t have a great example|no great example|nothing (really )?specific|never really had (a )?(close |anyone )?|not many opportunities to|didn'?t grow up (with|in) (a |much )?(hug|affection)|we weren'?t big on (hugs|celebrat|showing))\b/i.test(
    t
  );
}

/** True when the user already articulated values / attunement without needing the scripted pivot. */
export function moment5HasSubstantiveCelebrationValuesReflection(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 48) return false;
  if (isMoment5AppreciationAbsenceOfSignal(text)) return false;
  const lower = t.toLowerCase();
  return /\b(meaningful celebration|what (would|might) (feel|look) meaningful|feel meaningful|something I'?d want to do (for|to)|want to do for someone|show (them |someone )?(I care|they matter)|be there (for|when)|what they (need|needed|value)|noticed (what|that)|attun|mentaliz|empath|validate their|visibly valued|personal(ized)? (note|gesture|touch)|mark(ed)? the moment|celebrate them as a person)\b/i.test(
    lower
  );
}

/** Concrete behavioral example: passes Moment 5 specificity (not generic) and is not absence-of-signal. */
export function moment5HasHighInformationBehavioralExample(text: string): boolean {
  if (isMoment5AppreciationAbsenceOfSignal(text)) return false;
  return !evaluateMoment5AppreciationSpecificity(text).isGeneric;
}

/**
 * Infer he/she/they for the appreciated person from the user's answer.
 * Defaults to inclusive "them" when unclear or mixed signals.
 */
function moment5TargetPronoun(userText: string): 'her' | 'him' | 'them' {
  const lower = userText.toLowerCase();
  const female =
    /\b(she|her|hers|girlfriend|wife|woman|girl|mom|mother|sister|aunt|daughter|grandmother|stepmom)\b/.test(
      lower
    );
  const male =
    /\b(he|him|his|boyfriend|husband|man|guy|dad|father|brother|uncle|son|grandfather|stepdad)\b/.test(
      lower
    );
  if (female && !male) return 'her';
  if (male && !female) return 'him';
  return 'them';
}

/**
 * Pulls a short infinitive phrase describing what the user did, for Moment 5 appreciation probes.
 * Returns null when we cannot extract confidently (caller may fall back).
 */
function extractMoment5AppreciationInfinitivePhrase(trimmed: string): string | null {
  const lower = trimmed.toLowerCase();

  if (
    /\b(birthday\s+party|surprise\s+party)\b/i.test(trimmed) &&
    /\b(threw|throw|gave|hosted|planned|organized|put\s+on)\b/i.test(trimmed)
  ) {
    const p = moment5TargetPronoun(trimmed);
    return `throw ${p} that party`;
  }

  if (
    /\b(threw|hosted|planned|organized|put\s+on)\b/i.test(trimmed) &&
    /\bparty\b/i.test(trimmed) &&
    !/\b(office|work|company)\s+party\b/i.test(lower)
  ) {
    const p = moment5TargetPronoun(trimmed);
    return `throw ${p} that party`;
  }

  if (/\bwrote\b/i.test(trimmed) && /\bletter\b/i.test(trimmed)) {
    const p = moment5TargetPronoun(trimmed);
    return `write ${p} that letter`;
  }

  if (/\bflew\s+in\b/i.test(lower) || /\bflying\s+in\b/i.test(lower)) {
    return /\bsurpris/i.test(lower) ? 'fly in as a surprise' : 'fly in like that';
  }

  if (/\b(drove|driving)\s+/i.test(trimmed) && /\b(surprise|unexpected|unannounced)\b/i.test(lower)) {
    return 'make that trip as a surprise';
  }

  if (/\bsurprised\s+(her|him|them)\b/i.test(lower)) {
    const m = lower.match(/\bsurprised\s+(her|him|them)\b/);
    const p = (m?.[1] as 'her' | 'him' | 'them' | undefined) ?? 'them';
    return `plan something like that surprise for ${p}`;
  }

  if (/\bcooked\b/i.test(lower) && /\b(dinner|meal|breakfast|lunch|brunch)\b/i.test(lower)) {
    const p = moment5TargetPronoun(trimmed);
    return `cook ${p} that meal`;
  }

  if (/\b(bought|got|picked\s+up)\b/i.test(lower) && /\bgift\b/i.test(lower)) {
    return 'choose that gift';
  }

  if (/\b(took|booked)\b/i.test(lower) && /\b(trip|vacation|getaway)\b/i.test(lower)) {
    return 'plan that trip';
  }

  if (/\bsent\b/i.test(lower) && /\b(flowers|a\s+care\s+package)\b/i.test(lower)) {
    return 'send something like that';
  }

  if (/\bmade\b/i.test(lower) && /\b(scrapbook|photo\s+album|playlist|video)\b/i.test(lower)) {
    const p = moment5TargetPronoun(trimmed);
    return `make something like that for ${p}`;
  }

  if (/\bcalled\b/i.test(lower) && /\b(just\s+to\s+check|to\s+see\s+how)\b/i.test(lower)) {
    const p = moment5TargetPronoun(trimmed);
    return `reach out to ${p} that way`;
  }

  const takeOutWho = lower.match(/\btake\s+(them|her|him)\s+out\b/)?.[1];
  if (takeOutWho) {
    if (/\bmeal\b/i.test(lower)) return `take ${takeOutWho} out for a meal like that`;
    if (/\bdinner\b/i.test(lower)) return `take ${takeOutWho} out to dinner like that`;
    return `take ${takeOutWho} out like that`;
  }

  if (/\bsend\s+(a\s+)?message\b/i.test(lower)) {
    const p = moment5TargetPronoun(trimmed);
    return `send ${p} a message like that`;
  }

  return null;
}

/**
 * MOMENT5_PROBE_WORDING — Moment 5 appreciation follow-up must echo the user's described act
 * (not a generic "that specifically" script). Used when the runtime forces a single probe.
 */
const MOMENT5_SPECIFIC_BRIDGE =
  "Do you have a specific moment that comes to mind — even something small? If nothing surfaces, that's okay too and we can move on.";

export function buildMoment5AppreciationProbeQuestion(userText: string): string {
  const trimmed = userText.replace(/\s+/g, ' ').trim();
  const lower = trimmed.toLowerCase();
  if (!trimmed) {
    return MOMENT5_SPECIFIC_BRIDGE;
  }
  if (/\b(always|usually|generally|typically)\b/.test(lower)) {
    return MOMENT5_SPECIFIC_BRIDGE;
  }
  const act = extractMoment5AppreciationInfinitivePhrase(trimmed);
  if (act) {
    return `What made you decide to ${act}?`;
  }
  return MOMENT5_SPECIFIC_BRIDGE;
}

/** Moment 5: probe only when there is no engagement — not for shallow/generic but on-topic answers. */
export function isMoment5AppreciationAbsenceOfSignal(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 8) return true;
  const lower = t.toLowerCase();
  if (
    /^(I )?(don'?t|do not) know\.?$|^(no|nope)\.?$|^not sure\.?$|^nothing\.?$|^pass\.?$|^skip\.?$|^idk\.?$/i.test(
      lower
    )
  ) {
    return true;
  }
  if (
    /^(nothing|can'?t think|nothing comes|no idea|nothing surfaces|hard to think)/i.test(lower) &&
    t.length < 40
  ) {
    return true;
  }
  return false;
}

const SCENARIO_B_TOPIC_RE =
  /\b(sarah|james|job|offer|celebrat|salary|commute|fight|blindsided|appreciat|tears?|tearful|cry|cries|promotion|hunt)\b/i;

/** Scenario B Q1: any on-topic engagement counts — shallow answers are scorable; do not force probes for depth. */
export function hasScenarioBQ1OnTopicEngagement(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 12) return false;
  if (SCENARIO_B_TOPIC_RE.test(t)) return true;
  const lower = t.toLowerCase();
  return (
    /\b(needed to feel|emotional bid|logistics alone|salary alone|commute alone|don'?t cry|tears? up|redirect(ing)?|trail(ed|ing) off|worth it)\b/.test(
      lower
    ) ||
    /\b(sarah needed|she needed|she wanted|he needed|he wanted)\b.*\b(comfort|validation|acknowledg|empathy|care|attunement)\b/.test(
      lower
    )
  );
}

const SCENARIO_C_TOPIC_RE =
  /\b(sophie|daniel|repair|argument|silent|avoid|come back|relationship|communicat|boundary|listen|upset|resolved)\b/i;

/** Scenario C Q2: on-topic repair engagement (separate from commitment-threshold probe forcing). */
export function hasScenarioCQ2OnTopicEngagement(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 10) return false;
  return SCENARIO_C_TOPIC_RE.test(t);
}

const SCENARIO_A_TOPIC_RE =
  /\b(emma|ryan|dinner|mother|mom|bill|call|family|first|wrong|tension|hurt|frustrat|angry|upset|clear)\b/i;

/**
 * Scenario A Q1: user already showed a **contempt-quality** read of Emma's "you've made that very clear" line —
 * hostile, dismissive, verdict-issuing, or relationally closing — not mere indirectness or minimization.
 *
 * Does **not** skip the probe for: passive-aggressive-only, "stating a fact," "just upset/venting," or
 * Emma's hurt without a dismissive/hostile read of that line. Long Ryan-only answers never qualify.
 */
export function hasScenarioAQ1ContemptProbeCoverage(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 10) return false;
  if (!SCENARIO_A_TOPIC_RE.test(t)) return false;
  const lower = t.replace(/\u2019/g, "'").replace(/\u2018/g, "'").toLowerCase();

  const hasInterpretiveCue =
    /\b(what\s+she\s+meant|what\s+emma\s+meant|what\s+emma\s+was\s+(getting\s+at|trying\s+to\s+say)|she\s+meant|when\s+she\s+said|she\s+was\s+basically\s+saying|emma'?s\s+point\s+was|that\s+(line|statement|comment|response|remark|phrase|phrasing)|the\s+subtext\s+was|the\s+undertone\s+was|the\s+way\s+she\s+said|the\s+way\s+that\s+landed|that\s+came\s+across\s+as|it\s+landed\s+as|tone|that\s+comment\s+from\s+emma|emma'?s\s+(response|wording)\s+there)\b/.test(
      lower
    );
  const referencesEmmaFinalLine =
    lower.includes("you've made that very clear") ||
    lower.includes('you have made that very clear') ||
    /\byou\s+made\s+that\s+very\s+clear\b/.test(lower) ||
    (lower.includes('very clear') && /\bemma\b/.test(lower)) ||
    (/\bemma\b/.test(lower) && hasInterpretiveCue);

  /** Hostile / verdict / relational-sting reads — not indirectness alone (see passive-aggressive rule below). */
  const hasStrongContemptQualityRead =
    /\b(cont(empt|emptuous)|harsh|cutting|dismissive|dismissed|cold|biting|sarcastic|verdict|mean|punitive|punish(es|ing)?|shut(ting)?\s+down|clos(e|ing|es)?\s+off|clos(es|ing)?\s+the\s+door|door[- ]?clos|last\s+word|finality|superior|condescend|condescending|derogat|belittl|scathing|hostile|demean|degrad|mock|mockery|sting|walling|stonewall|jab|dig|put[- ]?down|swipe|loaded|taking\s+a\s+shot)\b/i.test(
      lower
    );
  /** Substantive interpretive read of the line's relational meaning even without explicit contempt adjectives. */
  const hasSubstantiveInterpretiveRead =
    /\b(accumulated\s+frustration|built[- ]?up\s+frustration|established\s+behavior|not\s+an\s+isolated\s+incident|current\s+pattern|for\s+some\s+time|tolerated\s+for\s+some\s+time|response\s+to\s+established\s+behavior|prioritiz(?:e|es|ing)\s+(his|her|their)\s+family)\b/i.test(
      lower
    );

  const hasPassiveAggressive = /\bpassive[- ]aggressive\b/i.test(lower);
  /** PA names delivery style, not necessarily contempt — insufficient alone to skip the probe. */
  const onlyPassiveAggressive = hasPassiveAggressive && !hasStrongContemptQualityRead;

  const minimizesEmmaLineRead =
    /\b(just\s+)?stating\s+a\s+fact\b|\bemma\s+is\s+just\s+stating\b|\bjust\s+(upset|venting)\b|\bonly\s+(saying|stating)\s+a\s+fact\b/i.test(
      lower
    );

  if (!referencesEmmaFinalLine) return false;
  if (onlyPassiveAggressive) return false;
  if (minimizesEmmaLineRead && !hasStrongContemptQualityRead) return false;

  return hasStrongContemptQualityRead || hasSubstantiveInterpretiveRead;
}

export function debugScenarioAQ1ContemptProbeCoverageDetail(text: string): {
  normalizedLength: number;
  hasScenarioATopic: boolean;
  hasInterpretiveCue: boolean;
  referencesEmmaFinalLine: boolean;
  hasStrongContemptQualityRead: boolean;
  hasSubstantiveInterpretiveRead: boolean;
  hasPassiveAggressive: boolean;
  onlyPassiveAggressive: boolean;
  minimizesEmmaLineRead: boolean;
  coverage: boolean;
} {
  const t = text.replace(/\s+/g, ' ').trim();
  const hasScenarioATopic = SCENARIO_A_TOPIC_RE.test(t);
  const lower = t.replace(/\u2019/g, "'").replace(/\u2018/g, "'").toLowerCase();
  const hasInterpretiveCue =
    /\b(what\s+she\s+meant|what\s+emma\s+was\s+(getting\s+at|trying\s+to\s+say)|she\s+meant|when\s+she\s+said|she\s+was\s+basically\s+saying|emma'?s\s+point\s+was|that\s+(line|statement|comment|response|remark|phrase|phrasing)|the\s+subtext\s+was|the\s+undertone\s+was|the\s+way\s+she\s+said|the\s+way\s+that\s+landed|that\s+came\s+across\s+as|it\s+landed\s+as|tone|that\s+comment\s+from\s+emma|emma'?s\s+(response|wording)\s+there)\b/.test(
      lower
    );
  const referencesEmmaFinalLine =
    lower.includes("you've made that very clear") ||
    lower.includes('you have made that very clear') ||
    /\byou\s+made\s+that\s+very\s+clear\b/.test(lower) ||
    (lower.includes('very clear') && /\bemma\b/.test(lower)) ||
    (/\bemma\b/.test(lower) && hasInterpretiveCue);
  const hasStrongContemptQualityRead =
    /\b(cont(empt|emptuous)|harsh|cutting|dismissive|dismissed|cold|biting|sarcastic|verdict|mean|punitive|punish(es|ing)?|shut(ting)?\s+down|clos(e|ing|es)?\s+off|clos(es|ing)?\s+the\s+door|door[- ]?clos|last\s+word|finality|superior|condescend|condescending|derogat|belittl|scathing|hostile|demean|degrad|mock|mockery|sting|walling|stonewall|jab|dig|put[- ]?down|swipe|loaded|taking\s+a\s+shot)\b/i.test(
      lower
    );
  const hasSubstantiveInterpretiveRead =
    /\b(accumulated\s+frustration|built[- ]?up\s+frustration|established\s+behavior|not\s+an\s+isolated\s+incident|current\s+pattern|for\s+some\s+time|tolerated\s+for\s+some\s+time|response\s+to\s+established\s+behavior|prioritiz(?:e|es|ing)\s+(his|her|their)\s+family)\b/i.test(
      lower
    );
  const hasPassiveAggressive = /\bpassive[- ]aggressive\b/i.test(lower);
  const onlyPassiveAggressive = hasPassiveAggressive && !hasStrongContemptQualityRead;
  const minimizesEmmaLineRead =
    /\b(just\s+)?stating\s+a\s+fact\b|\bemma\s+is\s+just\s+stating\b|\bjust\s+(upset|venting)\b|\bonly\s+(saying|stating)\s+a\s+fact\b/i.test(
      lower
    );

  return {
    normalizedLength: t.length,
    hasScenarioATopic,
    hasInterpretiveCue,
    referencesEmmaFinalLine,
    hasStrongContemptQualityRead,
    hasSubstantiveInterpretiveRead,
    hasPassiveAggressive,
    onlyPassiveAggressive,
    minimizesEmmaLineRead,
    coverage: hasScenarioAQ1ContemptProbeCoverage(text),
  };
}

/**
 * Scenario A Q1: broad on-topic engagement (e.g. scoring / analytics). Includes long answers that
 * only center Ryan — use {@link hasScenarioAQ1ContemptProbeCoverage} to decide contempt-probe forcing.
 */
export function hasScenarioAQ1VignetteEngagement(text: string): boolean {
  if (hasScenarioAQ1ContemptProbeCoverage(text)) return true;
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 10) return false;
  if (!SCENARIO_A_TOPIC_RE.test(t)) return false;
  return t.length >= 28;
}

/** Debug/instrumentation: which Scenario C commitment-threshold regex bucket matched (if any). */
export function scenarioCCommitmentThresholdMatchDetail(text: string): {
  irrecoverable: boolean;
  relationshipOutcome: boolean;
  decisionProcess: boolean;
} {
  const t = text.replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 12) return { irrecoverable: false, relationshipOutcome: false, decisionProcess: false };
  const irrecoverable =
    /\b(irrecover|unworkable|incompatib|deal[- ]?breaker|isn't working|isnt working|is not working|relationship is not working|not worth (it|continuing)|should (end|split)|break up|breakup|divorce|call it quits|done with (the relationship|them|him|her))\b/.test(
      t
    );
  const relationshipOutcome =
    /\b(walk away from (the relationship|it all|them|him|her)|leave (for good|the relationship)|end things|end(ing)? the relationship|leave them for good|time to go|split up|separate for good)\b/.test(
      t
    );
  const decisionProcess =
    /\b(at what point (would|do) (you|they|i|we)|when (i|we) would (end|leave|quit)|when to (end|leave|call it)|before (i|we) give up|last straw|line in the sand|non[- ]?negotiable|if (it|they) keeps? happening|this pattern keeps? happening|pattern keeps? happening|pattern (never|doesn't|does not) change|after (multiple|repeated)|years of the same)\b/.test(
      t
    );
  return { irrecoverable, relationshipOutcome, decisionProcess };
}

/**
 * Scenario C: true only when the user named relationship-level exit / unworkability criteria — not vignette motion
 * alone ("Daniel leaves", "walk away" from the room) or generic repair language.
 */
export function hasScenarioCCommitmentThresholdInUserAnswer(text: string): boolean {
  const f = scenarioCCommitmentThresholdMatchDetail(text);
  return f.irrecoverable || f.relationshipOutcome || f.decisionProcess;
}

/**
 * Threshold-style language **and** Daniel/Sophie named — satisfies the scripted Scenario C commitment probe.
 * Repair-only answers ("they're incompatible") without naming the characters do **not** skip forcing the question.
 */
export function hasScenarioCVignetteCommitmentThresholdSignal(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 12) return false;
  if (!/\b(daniel|sophie)\b/i.test(t)) return false;
  return hasScenarioCCommitmentThresholdInUserAnswer(t);
}

/**
 * Assistant turn: Scenario C Q2 (repair) — not Q1 (make of Daniel's "I didn't know what to say" line), not commitment threshold.
 * Models paraphrase; keep in sync with AriaScreen `replyingToScenarioCQ2` / forced threshold injection.
 */
export function isScenarioCRepairAssistantPrompt(text: string): boolean {
  const raw = normalizeInterviewTypography(text ?? '');
  const t = raw.replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 22) return false;
  if (looksLikeScenarioCCommitmentThresholdAssistantPrompt(raw)) return false;
  if (isScenarioCQ1Prompt(raw)) return false;
  const canonical = t.includes('how do you think this situation could be repaired');
  const dropSituation = /\bhow do you think this could be repaired\b/.test(t);
  const modalShort =
    /\bhow (might|could|would|should) this situation be repaired\b/.test(t) ||
    /\bhow (might|could|would) this be repaired\b/.test(t);
  const canBeRepaired =
    /\bhow (can|could) (this situation|this|they|things) be repaired\b/.test(t) ||
    /\bhow (can|could) (they|daniel and sophie) repair\b/.test(t);
  const repairIng =
    /\bhow would you (approach|begin) repair(ing)?\b/.test(t) ||
    /\bhow (might|should) (they|the couple) repair\b/.test(t);
  return canonical || dropSituation || modalShort || canBeRepaired || repairIng;
}

/**
 * True when assistant text embeds the canonical scripted Scenario C commitment-threshold line
 * (client inject or model). Used to avoid duplicate forces, resume false negatives, and races
 * before `scenarioCCommitmentThresholdProbeAskedRef` flips.
 */
export function assistantContainsScenarioCCommitmentThresholdForcedLine(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '')
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (t.length < 50) return false;
  if (!t.includes('at what point would you say daniel or sophie should decide')) return false;
  return (
    t.includes("this relationship isn't working") ||
    t.includes('this relationship is not working') ||
    (t.includes('relationship') && (/\bisn'?t working\b/.test(t) || /\bis not working\b/.test(t)))
  );
}

/** Scenario C follow-up: when Daniel/Sophie should decide the relationship is not working (not the repair prompt). */
export function looksLikeScenarioCCommitmentThresholdAssistantPrompt(text: string): boolean {
  if (assistantContainsScenarioCCommitmentThresholdForcedLine(text)) return true;
  const raw = normalizeInterviewTypography(text ?? '');
  const t = raw.replace(/\u2019/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 24) return false;
  if (!/\bdaniel\b/.test(t) || !/\bsophie\b/.test(t)) return false;

  const relationshipBroken =
    t.includes("this relationship isn't working") ||
    t.includes('this relationship is not working') ||
    t.includes("relationship isn't working") ||
    t.includes('relationship is not working') ||
    /\b(isn'?t|is not)\s+working\b/.test(t) ||
    (/\brelationship\b/.test(t) && /\bnot working\b/.test(t));

  if (!relationshipBroken) return false;

  const canonical =
    t.includes('at what point would you say daniel or sophie should decide this relationship') ||
    t.includes("at what point would you say daniel or sophie should decide this relationship isn't working");

  const pointAsk = /\b(at what point|what point)\b/.test(t);
  const framedAsk =
    pointAsk &&
    (/\bwould you say\b/.test(t) || /\bdo you decide\b/.test(t)) &&
    (/\bshould decide\b/.test(t) || /\brelationship\b/.test(t));
  /** e.g. "At what point would you decide Sophie and Daniel's relationship isn't working?" — models omit "say" / "should". */
  const wouldYouDecideBothNamed =
    pointAsk &&
    /\bwould you decide\b/.test(t) &&
    /\bdaniel\b/.test(t) &&
    /\bsophie\b/.test(t) &&
    relationshipBroken;

  return Boolean(canonical || framedAsk || wouldYouDecideBothNamed);
}

/**
 * Assistant turn that pivots from fictional Scenario C to personal Moment 4 (grudge / dislike).
 * Production still tags post-handoff messages as `scenarioNumber: 3`, so scoring must cut here.
 */
export function isScenarioCToPersonalHandoffAssistantContent(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const grudgeOrDislike =
    t.includes('held a grudge') ||
    (t.includes("really didn't like") && /\b(someone|your life|people)\b/.test(t));
  if (!grudgeOrDislike) return false;
  return (
    t.includes('three situations') ||
    t.includes("we've finished") ||
    t.includes('finished the three') ||
    t.includes('last two questions') ||
    t.includes('two questions are more personal') ||
    t.includes('only two questions') ||
    (t.includes('good work') && t.includes('three situations'))
  );
}

/** Drop assistant + user turns from personal Moment 4 onward — keeps Scenario C slice fiction-only. */
export function sliceTranscriptBeforeScenarioCToPersonalHandoff<
  T extends { role: string; content?: string },
>(transcript: readonly T[]): T[] {
  let cut = transcript.length;
  for (let i = 0; i < transcript.length; i++) {
    const m = transcript[i];
    if (
      m.role === 'assistant' &&
      typeof m.content === 'string' &&
      isScenarioCToPersonalHandoffAssistantContent(m.content)
    ) {
      cut = i;
      break;
    }
  }
  return transcript.slice(0, cut) as T[];
}

export type ScenarioCorpusMessageSlice = {
  role: string;
  content?: string;
  scenarioNumber?: number | null;
};

/**
 * User answer(s) to the Scenario C **repair** question only — stops before the commitment-threshold
 * assistant turn so the repair answer is never concatenated with the threshold follow-up (scoring
 * and probe logic must stay independent).
 */
export function extractScenario3UserCorpusAfterLastRepairPrompt(
  msgs: readonly ScenarioCorpusMessageSlice[],
): string {
  let lastRepairIdx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role === 'assistant' && typeof m.content === 'string' && isScenarioCRepairAssistantPrompt(m.content)) {
      lastRepairIdx = i;
      break;
    }
  }
  if (lastRepairIdx < 0) return '';
  const parts: string[] = [];
  for (let i = lastRepairIdx + 1; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role === 'assistant' && m.scenarioNumber === 3 && typeof m.content === 'string') {
      if (looksLikeScenarioCCommitmentThresholdAssistantPrompt(m.content)) break;
      continue;
    }
    if (m.role === 'user' && m.scenarioNumber === 3) {
      const t = String(m.content ?? '').trim();
      if (t) parts.push(t);
    }
  }
  return parts.join(' ');
}

/**
 * User answer(s) in Scenario C **before** the general repair assistant prompt — unprompted relative to
 * "How do you think this situation could be repaired?" (typically Q1 and any prior user turns in this scenario).
 */
export function extractScenario3UserCorpusBeforeRepairPrompt(
  msgs: readonly ScenarioCorpusMessageSlice[],
): string {
  let lastRepairIdx = -1;
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.role === 'assistant' && typeof m.content === 'string' && isScenarioCRepairAssistantPrompt(m.content)) {
      lastRepairIdx = i;
      break;
    }
  }
  if (lastRepairIdx < 0) return '';
  const parts: string[] = [];
  for (let i = 0; i < lastRepairIdx; i++) {
    const m = msgs[i];
    if (m.role === 'user' && m.scenarioNumber === 3) {
      const t = String(m.content ?? '').trim();
      if (t) parts.push(t);
    }
  }
  return parts.join(' ');
}

/** User answer(s) to the Scenario C commitment-threshold follow-up only (Daniel/Sophie), for sole-source scoring. */
export function extractScenario3CommitmentThresholdUserAnswerAfterPrompt(
  msgs: readonly ScenarioCorpusMessageSlice[],
): string {
  let threshIdx = -1;
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    if (
      m.role === 'assistant' &&
      m.scenarioNumber === 3 &&
      typeof m.content === 'string' &&
      looksLikeScenarioCCommitmentThresholdAssistantPrompt(m.content)
    ) {
      threshIdx = i;
      break;
    }
  }
  if (threshIdx < 0) return '';
  const parts: string[] = [];
  for (let i = threshIdx + 1; i < msgs.length; i++) {
    const m = msgs[i];
    if (m.role === 'assistant') break;
    if (m.role === 'user' && m.scenarioNumber === 3) {
      const t = String(m.content ?? '').trim();
      if (t) parts.push(t);
    }
  }
  return parts.join(' ');
}

/** Moment 4: a personal grudge answer with any narrative substance — used for scoring helpers, not to gate the threshold probe. */
export function hasMoment4PersonalNarrativeEngagement(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 25) return false;
  return /\b(i|my|me|we|our|us)\b/i.test(t);
}

/** Curly / typographic apostrophes and quotes → ASCII so string checks match model output. */
export function normalizeInterviewTypography(text: string): string {
  return text
    .replace(/\u2018|\u2019|\u201b/g, "'")
    .replace(/\u201c|\u201d/g, '"');
}

export function isLikelyMisplacedPersonalNarrativeForScenarioCThreshold(text: string): boolean {
  /**
   * Answers that already express commitment / exit timing (e.g. "third time… end the relationship")
   * often omit "Daniel/Sophie/their" — must not be treated as misplaced personal Moment-4 narrative
   * (session_logs: SC3_MISPLACED_THRESHOLD_SEQUENCE after threshold probe + whisper "end the relationship").
   */
  if (hasScenarioCCommitmentThresholdInUserAnswer(text)) return false;
  const t = text.toLowerCase();
  /**
   * Third-person about the vignette couple often uses "their relationship" / "them" — not `\bthey\b`.
   * Misclassifying that as a personal Moment-4 narrative re-fires the redirect + threshold TTS loop (see SC3_MISPLACED_THRESHOLD_SEQUENCE).
   */
  const referencesScenarioCharacters =
    /\b(daniel|sophie|they|their|them)\b/.test(t) &&
    /\b(should|would|relationship|not working|walk away|end|ending|fight|fighting|couple|together)\b/.test(t);
  if (referencesScenarioCharacters) return false;
  const hasPersonalNarrativeSignals =
    /\b(i|my|me|we|our|us)\b/.test(t) &&
    /\b(ex|relationship|partner|wife|husband|boyfriend|girlfriend|friend|family|when i|i had|i was|i felt|i decided|i left|i stayed)\b/.test(
      t
    );
  return hasPersonalNarrativeSignals;
}

/** True when the assistant turn is Scenario C Q1 (interpret Daniel's line), not Q2/repair/threshold. */
export function isScenarioCQ1Prompt(text: string): boolean {
  const t = normalizeInterviewTypography(text).replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 12) return false;
  if (/\bhow do you think this situation could be repaired\b/.test(t)) return false;
  if (/\bat what point would you say daniel or sophie\b/.test(t)) return false;
  if (t.includes("isn't working") && t.includes('daniel') && t.includes('sophie')) return false;
  const quotesDanielReturnLine =
    t.includes("didn't know what to say") ||
    t.includes('did not know what to say') ||
    t.includes("didn't know how") ||
    t.includes('did not know how');
  return t.includes('what do you make of') && quotesDanielReturnLine;
}

/**
 * User answered Q1 with repair/logistics/next-steps rather than interpreting Daniel's internal state
 * or the meaning of his return line ("I didn't know what to say"; legacy transcripts may say "I didn't know how").
 */
export function isMisplacedScenarioCQ1Answer(text: string): boolean {
  const t = normalizeInterviewTypography(text).replace(/\s+/g, ' ').trim();
  if (t.length < 40) return false;

  /** User engaged the quoted prompt line or a clear "what that line means" read — not only prescriptions. */
  const referencesDanielPromptLine =
    /\b(i |he |she |they )?didn'?t know what to say\b/i.test(t) ||
    /\b(i |he |she |they )?didn'?t know how\b/i.test(t) ||
    /\bwhat (that |he |daniel )?(line|said|means?|meant)\b/i.test(t) ||
    /\bwhen (daniel |he )(comes back |says|said )\b/i.test(t) ||
    /\b(that|those) words\b/i.test(t);

  const danielInternalRead =
    /\b(daniel|he)('?s| is| was| felt| seems| sounds| means| meant)\b/i.test(t) ||
    /\b(his|him) (own|inner|shame|fear|anxiety|avoidance|struggle|vulnerability|emotion|state|head|heart)\b/i.test(
      t
    ) ||
    /\b(meaning|read|interpretation) (of|is|that)|what (that|he) mean|what (that|it) (says|tells|signals|shows)\b/i.test(
      t
    ) ||
    /\b(where he'?s at|what he'?s going through|going on (for|with) him|in his (shoes|position))\b/i.test(t) ||
    /\b(overwhelmed|ashamed|embarrassed|stuck|lost|flooded|shut down|shutdown|vulnerable|raw|defensive|avoidant|withdraw|withdrawing)\b/i.test(
      t
    ) ||
    /\b(didn'?t know what to say|didn'?t know how (to|what)|lack(ed|s)? (the )?(skills|tools|words)|capacity|limitation|learning|growth|trying|effort|intent)\b/i.test(
      t
    ) ||
    /\b(remorse|guilt|shame)\b/i.test(t);

  if (danielInternalRead) return false;

  const prescriptiveDanielSophie =
    /\b(daniel|sophie)\s+(needs? to|has to|must)\b/i.test(t) || /\bdaniel should\b/i.test(t);

  const relationshipVerdictOrThreshold =
    /\b(relationship (is )?(not )?working|whether (this |the )?relationship|walk away|end (the relationship|it)|seriously consider|fourth time|third time|one more time|without real change|deal[- ]?breaker)\b/i.test(
      t
    );

  if (!referencesDanielPromptLine && (prescriptiveDanielSophie || relationshipVerdictOrThreshold)) {
    return true;
  }

  const logisticsOrRepairNextSteps =
    /\b(they should|the couple (should|needs to)|both (need|should) to|sophie and daniel should|next step|action plan|ground rules|start by|begin by|sit down (and|to)|schedule|couples therapy|therapy|mediat|take turns|check[- ]?ins?\b|communicate better|talk it out|work (it|this) out|resolve (this|it)|repair (this|the|their)|how (they|we) (could|should|can) (fix|repair|handle)|patch things|make a plan|come up with|agree on|structure|boundar(y|ies))\b/i.test(
      t
    );

  return logisticsOrRepairNextSteps;
}
