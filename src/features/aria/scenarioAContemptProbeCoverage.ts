import { normalizeApostrophesForPromptMatch } from './interviewTypography';
import {
  looksLikeScenarioAContemptProbeQuestion,
  normalizeInterviewApostrophesForMatching,
  normalizeScenarioAThatLineAsrTypos,
  SCENARIO_A_TOPIC_RE,
  userReferencesEmmaClosingLineIndirectly,
  userReferencesEmmaClosingLineQuote,
} from './scenarioAContemptProbeTextMatch';

/** Minimal message shape for {@link aggregateScenario1Moment1UserTextForContemptGate}. */
export type Scenario1Moment1UserMessageLike = {
  role: string;
  content?: string;
  scenarioNumber?: number;
  interviewMoment?: number;
};

/**
 * Join all Scenario 1, interview-moment-1 user turns (e.g. initial Q1 + short resume follow-up).
 * Used so contempt-probe skip/coverage still sees Emma-line engagement after welcome-back when the
 * current utterance alone is too short to match.
 */
export function aggregateScenario1Moment1UserTextForContemptGate(
  messages: readonly Scenario1Moment1UserMessageLike[],
): string {
  const parts: string[] = [];
  for (const m of messages) {
    if (m.role !== 'user') continue;
    if ((m.scenarioNumber ?? 0) !== 1) continue;
    const im = m.interviewMoment;
    if (im !== undefined && im !== 1) continue;
    const c = String(m.content ?? '').trim();
    if (c) parts.push(c);
  }
  return parts.join('\n').trim();
}

/** User ties their read to Emma's closing line without necessarily quoting it verbatim. */
const SCENARIO_A_EMMA_CLOSING_LINE_INTERPRETIVE_CUE_RE =
  /\b(what\s+she\s+meant|what\s+emma\s+meant|what\s+emma\s+was\s+(?:getting\s+at|trying\s+to\s+say)|she\s+meant|when\s+she\s+said|she\s+was\s+basically\s+saying|emma'?s\s+point\s+was|that\s+(?:line|statement|comment|response|remark|phrase|phrasing)|her\s+statement|emma'?s\s+(?:statement|words|comment|line)|the\s+subtext\s+was|the\s+undertone\s+was|the\s+way\s+she\s+said|the\s+way\s+that\s+landed|that\s+came\s+across\s+as|it\s+landed\s+as|tone|that\s+comment\s+from\s+emma|emma'?s\s+(?:response|wording)\s+there)\b/i;

function scenarioAEmmaClosingLineInterpretiveCueMatched(lower: string): boolean {
  return SCENARIO_A_EMMA_CLOSING_LINE_INTERPRETIVE_CUE_RE.test(lower);
}

function scenarioAUserReferencesEmmaClearLineWithEmmaName(lower: string): boolean {
  return (
    (lower.includes('very clear') || lower.includes('really clear')) && /\bemma\b/.test(lower)
  );
}

/** Skip reasons for {@link evaluateScenarioAQ1ContemptProbePreProbeSkip} (auditable). */
export type ScenarioAContemptProbeSkipReason =
  | 'literal_quote_present'
  | 'indirect_closing_line_reference'
  | 'closing_line_significance_read'
  | 'register_addressed'
  | 'pattern_interpretation_tied_to_line';

/**
 * User read resignation, recurrence, or deeper-than-tonight meaning in Emma's closing remark —
 * even when they do not quote the line verbatim.
 */
function userDemonstratesEmmaClosingLineSignificance(
  lower: string,
  onScenarioATopic: boolean,
  text: string,
): boolean {
  if (!onScenarioATopic) return false;

  const tiesToEmmaClosingBeat =
    userReferencesEmmaClosingLineIndirectly(text) ||
    (/\bemma\b/.test(lower) &&
      /\b(?:end|last|close|final|that\s+comment|that\s+line|closes?\s+(?:it\s+out|the\s+conversation))\b/i.test(
        lower,
      )) ||
    (/\b(?:she|her)\b/.test(lower) &&
      /\b(?:end|last|close|final|that\s+comment|that\s+line|closes?\s+(?:it\s+out|the\s+conversation))\b/i.test(
        lower,
      ));

  if (!tiesToEmmaClosingBeat) return false;

  const significancePatterns: RegExp[] = [
    /\b(?:isn'?t|is\s+not|not)\s+(?:the\s+)?first\s+time\b/i,
    /\byou\s+can\s+tell\s+(?:this|it)\b/i,
    /\bshe'?s\s+given\s+up\b/i,
    /\bgiven\s+up\s+(?:explaining|trying|asking|on)\b/i,
    /\bshe\s+sounds?\s+resigned\b/i,
    /\bshe'?s\s+resigned\b/i,
    /\bshe'?s\s+said\s+this\s+before\b/i,
    /\bit'?s\s+become\s+a\s+pattern\b/i,
    /\b(?:become|became)\s+a\s+pattern\b/i,
    /\b(?:recurring|repeat(?:ed|s|ing)?|happened\s+before|many\s+times|keeps?\s+happening|keep\s+doing\s+this)\b/i,
    /\bthat\s+tone\s+(?:suggests?|shows?|signals?|indicates?|means?)\b/i,
    /\b(?:deeper|more\s+than)\b[^.]{0,40}\b(?:one[- ]?(?:off|time)|just\s+tonight|this\s+night|single\s+incident)\b/i,
    /\bunresolved\s+(?:pattern|dynamic|issue|conflict)\b/i,
    /\b(?:this|it)\s+has\s+happened\s+before\b/i,
    /\bnot\s+just\s+(?:about\s+)?tonight\b/i,
    /\b(?:isn'?t|is\s+not)\s+just\s+(?:about\s+)?(?:this|tonight|the\s+call)\b/i,
    /\bshe'?s\s+stopped\s+expecting\b/i,
    /\bshe\s+already\s+knows\s+(?:he|ryan)\s+won'?t\b/i,
    /\bnot\s+asking\s+(?:him|ryan|her)\s+to\s+stop\b/i,
  ];

  return significancePatterns.some((re) => re.test(lower));
}

/**
 * Pre-probe gate: if the user's **initial** Scenario A Q1 answer already engages Emma's final line,
 * the scripted contempt probe is redundant. Evaluates conditions 1–3 before {@link hasScenarioAQ1ContemptProbeCoverage}.
 */
export function evaluateScenarioAQ1ContemptProbePreProbeSkip(text: string): {
  skip: boolean;
  reason: ScenarioAContemptProbeSkipReason | null;
} {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 8) return { skip: false, reason: null };
  const lower = normalizeScenarioAThatLineAsrTypos(
    normalizeInterviewApostrophesForMatching(t),
  )
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const onScenarioATopic = SCENARIO_A_TOPIC_RE.test(t);

  /** Condition 1 — literal quote or close ASR variant (same line must not get a second scripted ask). */
  if (userReferencesEmmaClosingLineQuote(t)) return { skip: true, reason: 'literal_quote_present' };

  /** Condition 1b — deictic / indirect reference to Emma's closing beat ("Emma's line," "when Emma says that"). */
  if (userReferencesEmmaClosingLineIndirectly(t)) {
    return { skip: true, reason: 'indirect_closing_line_reference' };
  }

  /** Condition 1c — resignation / recurrence read tied to Emma's closing remark without quoting it. */
  if (userDemonstratesEmmaClosingLineSignificance(lower, onScenarioATopic, t)) {
    return { skip: true, reason: 'closing_line_significance_read' };
  }

  /** User named Emma/Ryan and described Emma's closing move ("not asking…", "already knows he won't") — same beat as "you've made that very clear". */
  const namesEmmaOrRyan = /\b(emma|ryan)\b/i.test(lower);
  const emmaClosingRhetoricNamed =
    onScenarioATopic &&
    namesEmmaOrRyan &&
    (/\bshe'?s\s+not\s+asking\s+(?:him|ryan|her)\s+to\s+stop\b/i.test(lower) ||
      /\bshe\s+isn'?t\s+asking\s+(?:him|ryan|her)\s+to\s+stop\b/i.test(lower) ||
      /\btelling\s+(?:him|ryan|her)\s+she\s+already\s+knows\b/i.test(lower) ||
      /\bshe'?s\s+telling\s+(?:him|ryan|her)\s+she\s+already\s+knows\b/i.test(lower) ||
      /\bshe\s+already\s+knows\s+(?:that\s+)?(?:he|ryan)\s+won'?t\b/i.test(lower) ||
      /\balready\s+knows\s+(?:he|ryan)\s+won'?t\b/i.test(lower));
  if (emmaClosingRhetoricNamed) {
    return { skip: true, reason: 'register_addressed' };
  }

  /** Condition 2 — register of the line (lexicon + closing-line engagement, or explicit deeper-than-frustration phrases). */
  const registerLexicon =
    /\b(sarcasm|sarcastic|passive[- ]aggressive|sharp(?:ness)?|resigned|resignation|bitter|contemptuous|cutting|dismissive|cold|loaded|pointed|snide|condescend(?:ing)?)\b/i;
  const interpretiveCueForClosingLine = scenarioAEmmaClosingLineInterpretiveCueMatched(lower);
  /** Bare "Emma + condescending" in a general Q1 answer is not enough — must tie register to the closing line. */
  const engagesEmmaClosingLineSpecifically =
    userReferencesEmmaClosingLineIndirectly(t) ||
    scenarioAUserReferencesEmmaClearLineWithEmmaName(lower) ||
    (/\bemma\b/.test(lower) && interpretiveCueForClosingLine);
  const deeperThanSurfaceFrustration =
    /\bshe'?s\s+given\s+up\b/i.test(lower) ||
    /\bgiven\s+up\s+on\b/i.test(lower) ||
    /\bresignation\b/i.test(lower) ||
    /\bstopped\s+expecting\b/i.test(lower) ||
    /\bshe'?s\s+shutting\s+down\b/i.test(lower) ||
    (onScenarioATopic && /\b(a\s+)?shutdown\b/i.test(lower)) ||
    /\bwriting\s+him\s+off\b/i.test(lower) ||
    /\b(not\s+just\s+frustration|that'?s\s+not\s+just\s+frustration)\b/i.test(lower) ||
    /\bgo(es)?\s+deeper\s+than\s+tonight\b/i.test(lower) ||
    /\bshe'?s\s+being\s+passive[- ]aggressive\b/i.test(lower) ||
    /\bthat'?s\s+a\s+sarcastic\s+comment\b/i.test(lower) ||
    /\bshe'?s\s+making\s+a\s+dig\b/i.test(lower) ||
    /\bthat'?s\s+contempt\b/i.test(lower);

  if (deeperThanSurfaceFrustration) {
    return { skip: true, reason: 'register_addressed' };
  }
  if (registerLexicon.test(lower) && engagesEmmaClosingLineSpecifically) {
    return { skip: true, reason: 'register_addressed' };
  }

  /** Condition 3 — pattern interpretation tied to that specific line / comment. */
  const patternTiedToLine =
    (/\bsaid\s+this\s+before\b/i.test(lower) && /\bnothing\s+changed\b/i.test(lower)) ||
    /\bclearly\s+said\s+this\s+before\b/i.test(lower) ||
    /\bisn'?t\s+just\s+about\s+tonight\b/i.test(lower) ||
    /\bthat\s+line\s+shows\b/i.test(lower) ||
    /\bshe'?s\s+resigned\s+to\s+it\b/i.test(lower) ||
    /\bthat\s+comment\s+is\s+about\s+more\s+than\b/i.test(lower) ||
    (/\b(?:isn'?t|is\s+not)\s+(?:the\s+)?first\s+time\b/i.test(lower) &&
      userReferencesEmmaClosingLineIndirectly(t)) ||
    (/\bthat\s+line\b/i.test(lower) &&
      /\b(shutdown|not\s+(?:just\s+)?(?:a\s+)?complaint|resigned|dismissive|closing|sarcastic|sting)\b/i.test(
        lower,
      ));

  if (patternTiedToLine) {
    return { skip: true, reason: 'pattern_interpretation_tied_to_line' };
  }

  return { skip: false, reason: null };
}

const SCENARIO_A_CONTEMPT_PROBE_SHORT_AFFECT_RE =
  /\b(?:frustrated|disappointed|condescending|contemptuous|dismissive|sarcastic|hostile|hurt|angry|upset|resentful|resigned|passive[- ]aggressive|contempt|cold|harsh|sharp|loaded|bitter|exasperated|annoyed|disdainful|demeaning|belittling|shutting\s+down|given\s+up|fed\s+up)\b/i;

/**
 * Scenario A contempt probe ("what do you make of that?") accepts brief Emma-line reads —
 * e.g. "Emma was frustrated", "she's being condescending", "So, I think she's very frustrated and disappointed."
 */
export function looksLikeScenarioAContemptProbeAssessableShortAnswer(userText: string): boolean {
  const t = userText.replace(/\s+/g, ' ').trim();
  if (!t || t.length < 6) return false;
  const low = t.toLowerCase().replace(/[\u201c\u201d\u2018\u2019]/g, "'");
  if (!/\b(?:emma|she|her)\b/i.test(low)) return false;
  if (SCENARIO_A_CONTEMPT_PROBE_SHORT_AFFECT_RE.test(low)) return true;
  if (/\b(?:sounds?|seems?|looks?|reads?|feels?)\s+(?:done|over\s+it|fed\s+up|through)\b/i.test(low)) {
    return true;
  }
  return false;
}

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
  const lower = normalizeScenarioAThatLineAsrTypos(
    normalizeInterviewApostrophesForMatching(t),
  )
    .replace(/\s+/g, ' ')
    .toLowerCase();

  const hasInterpretiveCue = scenarioAEmmaClosingLineInterpretiveCueMatched(lower);
  const referencesEmmaClosingRhetoric =
    /\bshe'?s\s+not\s+asking\s+(?:him|ryan|her)\s+to\s+stop\b/i.test(lower) ||
    /\bshe\s+isn'?t\s+asking\s+(?:him|ryan|her)\s+to\s+stop\b/i.test(lower) ||
    /\btelling\s+(?:him|ryan|her)\s+she\s+already\s+knows\b/i.test(lower) ||
    /\bshe'?s\s+telling\s+(?:him|ryan|her)\s+she\s+already\s+knows\b/i.test(lower) ||
    /\bshe\s+already\s+knows\s+(?:that\s+)?(?:he|ryan)\s+won'?t\b/i.test(lower) ||
    /\balready\s+knows\s+(?:he|ryan)\s+won'?t\b/i.test(lower);
  const referencesEmmaFinalLine =
    userReferencesEmmaClosingLineIndirectly(t) ||
    scenarioAUserReferencesEmmaClearLineWithEmmaName(lower) ||
    (/\bemma\b/.test(lower) && hasInterpretiveCue) ||
    (/\b(emma|ryan)\b/.test(lower) && referencesEmmaClosingRhetoric);

  /** Hostile / verdict / relational-sting reads — not indirectness alone (see passive-aggressive rule below). */
  const hasStrongContemptQualityRead =
    /\b(cont(empt|emptuous)|harsh|cutting|dismissive|dismissed|cold|biting|sarcastic|verdict|mean|punitive|punish(es|ing)?|shut(ting)?\s+down|shutdown|clos(e|ing|es)?\s+off|clos(es|ing)?\s+the\s+door|door[- ]?clos|last\s+word|finality|superior|condescend|condescending|derogat|belittl|scathing|hostile|demean|degrad|mock|mockery|sting|walling|stonewall|jab|dig|put[- ]?down|swipe|loaded|taking\s+a\s+shot)\b/i.test(
      lower
    );
  /** Substantive interpretive read of the line's relational meaning even without explicit contempt adjectives. */
  const hasSubstantiveInterpretiveRead =
    /\b(accumulated\s+frustration|built[- ]?up\s+frustration|established\s+behavior|not\s+an\s+isolated\s+incident|current\s+pattern|for\s+some\s+time|for\s+a\s+while|tolerated\s+for\s+some\s+time|response\s+to\s+established\s+behavior|prioritiz(?:e|es|ing)\s+(his|her|their)\s+family)\b/i.test(
      lower
    );

  const hasPassiveAggressive = /\bpassive[- ]aggressive\b/i.test(lower);
  /** PA names delivery style, not necessarily contempt — insufficient alone to skip the probe. */
  const onlyPassiveAggressive = hasPassiveAggressive && !hasStrongContemptQualityRead;

  const minimizesEmmaLineRead =
    /\b(just\s+)?stating\s+a\s+fact\b|\bemma\s+is\s+just\s+stating\b|\bjust\s+(upset|venting)\b|\bonly\s+(saying|stating)\s+a\s+fact\b/i.test(
      lower
    );

  /** Named Emma/Ryan + explicit read of Emma's closing move — sufficient without contempt adjectives (e.g. "won't change"). */
  if (/\b(emma|ryan)\b/.test(lower) && referencesEmmaClosingRhetoric) {
    if (onlyPassiveAggressive) return false;
    if (minimizesEmmaLineRead && !hasStrongContemptQualityRead) return false;
    return true;
  }

  if (!referencesEmmaFinalLine) return false;
  if (onlyPassiveAggressive) return false;
  if (minimizesEmmaLineRead && !hasStrongContemptQualityRead) return false;

  return hasStrongContemptQualityRead || hasSubstantiveInterpretiveRead;
}

export function debugScenarioAQ1ContemptProbeCoverageDetail(text: string): {
  normalizedLength: number;
  hasScenarioATopic: boolean;
  hasInterpretiveCue: boolean;
  referencesEmmaClosingRhetoric: boolean;
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
  const lower = normalizeScenarioAThatLineAsrTypos(
    normalizeInterviewApostrophesForMatching(t),
  )
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const hasInterpretiveCue = scenarioAEmmaClosingLineInterpretiveCueMatched(lower);
  const referencesEmmaClosingRhetoric =
    /\bshe'?s\s+not\s+asking\s+(?:him|ryan|her)\s+to\s+stop\b/i.test(lower) ||
    /\bshe\s+isn'?t\s+asking\s+(?:him|ryan|her)\s+to\s+stop\b/i.test(lower) ||
    /\btelling\s+(?:him|ryan|her)\s+she\s+already\s+knows\b/i.test(lower) ||
    /\bshe'?s\s+telling\s+(?:him|ryan|her)\s+she\s+already\s+knows\b/i.test(lower) ||
    /\bshe\s+already\s+knows\s+(?:that\s+)?(?:he|ryan)\s+won'?t\b/i.test(lower) ||
    /\balready\s+knows\s+(?:he|ryan)\s+won'?t\b/i.test(lower);
  const referencesEmmaFinalLine =
    userReferencesEmmaClosingLineIndirectly(t) ||
    scenarioAUserReferencesEmmaClearLineWithEmmaName(lower) ||
    (/\bemma\b/.test(lower) && hasInterpretiveCue) ||
    (/\b(emma|ryan)\b/.test(lower) && referencesEmmaClosingRhetoric);
  const hasStrongContemptQualityRead =
    /\b(cont(empt|emptuous)|harsh|cutting|dismissive|dismissed|cold|biting|sarcastic|verdict|mean|punitive|punish(es|ing)?|shut(ting)?\s+down|shutdown|clos(e|ing|es)?\s+off|clos(es|ing)?\s+the\s+door|door[- ]?clos|last\s+word|finality|superior|condescend|condescending|derogat|belittl|scathing|hostile|demean|degrad|mock|mockery|sting|walling|stonewall|jab|dig|put[- ]?down|swipe|loaded|taking\s+a\s+shot)\b/i.test(
      lower
    );
  const hasSubstantiveInterpretiveRead =
    /\b(accumulated\s+frustration|built[- ]?up\s+frustration|established\s+behavior|not\s+an\s+isolated\s+incident|current\s+pattern|for\s+some\s+time|for\s+a\s+while|tolerated\s+for\s+some\s+time|response\s+to\s+established\s+behavior|prioritiz(?:e|es|ing)\s+(his|her|their)\s+family)\b/i.test(
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
    referencesEmmaClosingRhetoric,
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

function normalizeScenarioAQ1PromptMatchText(text: string): string {
  return text.replace(/\u2019/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
}

function isScenarioAQ1OpeningPromptText(text: string): boolean {
  return normalizeScenarioAQ1PromptMatchText(text).includes("what's going on between these two");
}

function isScenarioAVignetteOnlyAssistantText(text: string): boolean {
  const t = normalizeScenarioAQ1PromptMatchText(text);
  if (!t || isScenarioAQ1OpeningPromptText(text)) return false;
  return t.includes('emma and ryan') || t.includes('ryan takes a call from his mother');
}

function isResumeWelcomeBackAssistantText(text: string): boolean {
  const t = normalizeScenarioAQ1PromptMatchText(text);
  return t.includes('welcome back') && t.includes('pick up where we left off');
}

/** Brief Scenario A acknowledgment/reflection after Q1 — contempt probe not yet delivered. */
function isScenarioAPreContemptAssistantReflection(text: string): boolean {
  const t = normalizeScenarioAQ1PromptMatchText(text);
  if (!t) return false;
  if (isScenarioAQ1OpeningPromptText(text)) return false;
  if (isScenarioAVignetteOnlyAssistantText(text)) return false;
  if (isResumeWelcomeBackAssistantText(text)) return false;
  if (looksLikeScenarioAContemptProbeQuestion(text)) return false;
  if (
    t.includes('how would you repair this relationship if you were ryan') ||
    (/\b(if you were ryan|you were ryan)\b/.test(t) && /\brepair\b/.test(t))
  ) {
    return false;
  }
  return /\b(emma|ryan)\b/.test(t);
}

/**
 * True when the user's turn is a substantive Scenario A Q1 answer — including after resume when
 * the last stored assistant line is welcome-back or vignette-only (Q1 may have been spoken via TTS only).
 */
export function isReplyingToScenarioAQ1AfterDelivery(params: {
  currentMoment: number;
  contemptProbeAlreadyAsked: boolean;
  lastAssistantWasContemptProbe: boolean;
  lastAssistantWasRepair: boolean;
  assistantTexts: string[];
  userAnswerText: string;
}): boolean {
  if (params.currentMoment !== 1) return false;
  if (params.contemptProbeAlreadyAsked) return false;
  if (params.lastAssistantWasContemptProbe || params.lastAssistantWasRepair) return false;

  const texts = params.assistantTexts.map((t) => (t ?? '').trim()).filter(Boolean);
  if (texts.some(isScenarioAQ1OpeningPromptText)) return true;

  const resumeOrVignetteContext = texts.some(
    (t) => isScenarioAVignetteOnlyAssistantText(t) || isResumeWelcomeBackAssistantText(t),
  );
  const preContemptReflectionContext = texts.some(isScenarioAPreContemptAssistantReflection);
  return (
    (resumeOrVignetteContext || preContemptReflectionContext) &&
    hasScenarioAQ1VignetteEngagement(params.userAnswerText)
  );
}

/** Scenario A Q1 opening — "What's going on between these two?" */
export function isScenarioAQ1Prompt(text: string): boolean {
  const t = normalizeApostrophesForPromptMatch(text).toLowerCase();
  return t.includes("what's going on between these two");
}
