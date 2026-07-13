import { MOMENT5_LIKELY_PROPER_NAME_RE } from '@features/aria/moment5SpecificityRedirect';

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

  const namedPersonConflictAnchor =
    MOMENT5_LIKELY_PROPER_NAME_RE.test(t) &&
    /\b(called|said|told|texted|argued|fought|upset|angry|yelled|coach|conflict|disagreed|walked|criticized|judged|facilitator|resolved|perspectives|feedback|tense|hurt)\b/i.test(
      lower,
    );

  const relationalAnchor =
    namedPersonConflictAnchor ||
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
    /\b(my|our|the|a)\s+(friend|partner|ex|boss|coworker|co-worker|colleague|neighbor|manager|teammate|flatmate)\b/i.test(lower) ||
    /\bsomeone(?:\s+i\s+(?:trusted|cared\s+about|knew(?:\s+well)?)|\s+who|\s+that|\s+important|\s+close(?:\s+to)?)\b/i.test(
      lower,
    ) ||
    /\b(a|the) (woman|man|person)\b/i.test(lower) ||
    /\b(i was dating|we were dating|my relationship|with my )\b/i.test(lower) ||
    /\b(the|this)\s+(guy|gal|woman|man)\s+i\s+(was\s+)?(seeing|dating|living\s+with)\b/i.test(lower);

  const dyadicOrEpisode =
    /\bwe ('?ve|had|got|were|argued|fought|disagreed|talked|made up|resolved|reconciled)\b/i.test(lower) ||
    /\bwe (had a|had an|got into (a )?)(fight|argument|disagreement|conflict|rupture)\b/i.test(lower) ||
    /\b(i|we)\s+had\s+a(?:\s+\w+){0,3}\s+conflict\b/i.test(lower) ||
    /\b(had|have)\s+an?\s+(fight|argument|disagreement|conflict|rupture)\b/i.test(lower) ||
    /\b(she|he|they)\s+(was|were)\s+being\b/i.test(lower) ||
    /\b(i|we)\s+stopped\s+engaging\b/i.test(lower) ||
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
    /\b(argument|fight|disagreement|conflict|stopped talking|stopped texting|cut each other out|had a falling out|fell out|made up|talked again|worked out|resolved)\b/i.test(
      lower,
    );
  const strongNarrativeOverride =
    wc >= 35 && explicitNarrativeLead && relationalAnchor && conflictEpisodeLexicon;

  const concrete =
    strongNarrativeOverride ||
    (namedPersonConflictAnchor && wc >= 18) ||
    (relationalAnchor && (dyadicOrEpisode || situationalAnchor || wc >= 40)) ||
    (dyadicOrEpisode && (relationalAnchor || situationalAnchor || wc >= 28));

  if (wc >= 80 || /\bbest friend\b/i.test(lower) || /\bthere was a time\b/i.test(lower)) {
  }

  return concrete;
}

