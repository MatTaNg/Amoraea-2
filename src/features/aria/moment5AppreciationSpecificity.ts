import { looksLikeMoment4ThresholdQuestion } from './moment4ProbeLogic';
import { normalizeInterviewTypography } from './interviewTypography';

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

