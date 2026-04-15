export function isNoEvidenceText(text: string | null | undefined): boolean {
  if (!text) return false;
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
    /limited (close[- ]relationship|lived) (experience|opportunity)/i.test(t)
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
  const hasSpecificMoment =
    /\b(last|yesterday|today|week|month|birthday|anniversary|graduation|after|when|that time|once|on \w+day|at dinner|at work|turned \d+)\b/.test(
      t
    );
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

/** Single runtime pivot when the user has no strong behavioral example (replaces older specificity probe). */
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

/**
 * True when an assistant turn is (or contains) the Moment 5 appreciation / celebration prompt or
 * an approved framework variant. Used to slice the transcript for post-interview Moment 5 scoring.
 * Keep aligned with interviewerFrameworkPrompt Moment 5 bridges and scripted lines.
 */
export function isMoment5AppreciationAssistantAnchor(content: string | null | undefined): boolean {
  if (!content) return false;
  const c = content.replace(/\s+/g, ' ').trim();
  const lower = c.toLowerCase();
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
  /\b(sarah|james|job|offer|celebrat|salary|commute|fight|blindsided|appreciat|trails? off|promotion|hunt)\b/i;

/** Scenario B Q1: any on-topic engagement counts — shallow answers are scorable; do not force probes for depth. */
export function hasScenarioBQ1OnTopicEngagement(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 12) return false;
  if (SCENARIO_B_TOPIC_RE.test(t)) return true;
  const lower = t.toLowerCase();
  return (
    /\b(trail(ed|ing) off|needed to feel|emotional bid|logistics alone|salary alone|commute alone)\b/.test(lower) ||
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

  const referencesEmmaFinalLine =
    lower.includes("you've made that very clear") ||
    lower.includes('you have made that very clear') ||
    (lower.includes('very clear') && /\bemma\b/.test(lower));

  /** Hostile / verdict / relational-sting reads — not indirectness alone (see passive-aggressive rule below). */
  const hasStrongContemptQualityRead =
    /\b(cont(empt|emptuous)|harsh|cutting|dismissive|dismissed|cold|biting|sarcastic|verdict|mean|punitive|punish(es|ing)?|shut(ting)?\s+down|clos(e|ing|es)?\s+off|clos(es|ing)?\s+the\s+door|door[- ]?clos|last\s+word|finality|superior|condescend|condescending|derogat|belittl|scathing|hostile|demean|degrad|mock|mockery|sting|walling|stonewall)\b/i.test(
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

  return hasStrongContemptQualityRead;
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

/**
 * Scenario C: true only when the user named relationship-level exit / unworkability criteria — not vignette motion
 * alone ("Daniel leaves", "walk away" from the room) or generic repair language.
 */
export function hasScenarioCCommitmentThresholdInUserAnswer(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 12) return false;
  const irrecoverable =
    /\b(irrecover|unworkable|incompatib|deal[- ]?breaker|isn't working|isnt working|is not working|relationship is not working|not worth (it|continuing)|should (end|split)|break up|breakup|divorce|call it quits|done with (the relationship|them|him|her))\b/.test(
      t
    );
  const relationshipOutcome =
    /\b(walk away from (the relationship|it all|them|him|her)|leave (for good|the relationship)|end things|end the relationship|leave them for good|time to go|split up|separate for good)\b/.test(
      t
    );
  const decisionProcess =
    /\b(at what point (would|do) (you|they|i|we)|when (i|we) would (end|leave|quit)|when to (end|leave|call it)|before (i|we) give up|last straw|line in the sand|non[- ]?negotiable|if (it|they) keeps? happening|this pattern keeps? happening|pattern keeps? happening|pattern (never|doesn't|does not) change|after (multiple|repeated)|years of the same)\b/.test(
      t
    );
  return irrecoverable || relationshipOutcome || decisionProcess;
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
 * Assistant turn: Scenario C Q2 (repair) — not Q1 (make of "I didn't know how"), not commitment threshold.
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

/** Scenario C follow-up: when Daniel/Sophie should decide the relationship is not working (not the repair prompt). */
export function looksLikeScenarioCCommitmentThresholdAssistantPrompt(text: string): boolean {
  const t = (text ?? '').toLowerCase();
  return (
    t.includes("at what point would you say daniel or sophie should decide this relationship isn't working") ||
    (t.includes('daniel') &&
      t.includes('sophie') &&
      t.includes("isn't working") &&
      /\b(at what point|what point)\b/.test(t))
  );
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
  const t = text.toLowerCase();
  const referencesScenarioCharacters = /\b(daniel|sophie|they)\b/.test(t) && /\b(should|would|relationship|not working|walk away|end)\b/.test(t);
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
  return (
    t.includes('what do you make of') &&
    (t.includes("didn't know how") || t.includes('did not know how'))
  );
}

/**
 * User answered Q1 with repair/logistics/next-steps rather than interpreting Daniel's internal state
 * or the meaning of "I didn't know how."
 */
export function isMisplacedScenarioCQ1Answer(text: string): boolean {
  const t = normalizeInterviewTypography(text).replace(/\s+/g, ' ').trim();
  if (t.length < 40) return false;

  /** User engaged the quoted prompt line or a clear "what that line means" read — not only prescriptions. */
  const referencesDanielPromptLine =
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
    /\b(didn'?t know how (to|what)|lack(ed|s)? (the )?(skills|tools|words)|capacity|limitation|learning|growth|trying|effort|intent)\b/i.test(
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
