/**
 * Client-enforced interview probes for thin / disengaged answers (repair + mentalizing + generic short).
 * One probe per user answer — caller must skip when the user is already answering a probe turn.
 */

import { isApprovedElongatingProbeOnly } from './elongatingProbe';
import { APPROVED_ELONGATING_PROBE_LINES } from './elongatingProbe';
import {
  isMisplacedScenarioCQ1Answer,
  isScenarioCQ1Prompt,
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCCommitmentThresholdAssistantPrompt,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from './probeAndScoringUtils';
import { looksLikeMoment4GrudgePrompt } from './moment4ProbeLogic';

export const CLIENT_REPAIR_REFUSAL_PROBE =
  "If you had to try anyway, what's one thing you might say or do?" as const;

export const CLIENT_MENTALIZING_SURFACE_PROBE =
  'What do you think is underneath that for each of them?' as const;

export const SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE =
  'What do you think this pattern of leaving has been like for Sophie over time?' as const;

/** Same verbatim line as approved elongating probes — keeps `elongating_probe_fired` accurate after client inject. */
export const CLIENT_SHORT_ELABORATION_PROBE = APPROVED_ELONGATING_PROBE_LINES[0];

function normalizeWhitespace(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

function normalizeApostrophes(text: string): string {
  return text.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
}

/** Scenario A repair-as-Ryan (canonical + paraphrases aligned with interviewerFrameworkPrompt). */
export function looksLikeScenarioARepairQuestion(text: string): boolean {
  const t = normalizeApostrophes(text).toLowerCase();
  const ryanRepair =
    /\b(if you were ryan|you were ryan)\b/.test(t) &&
    /\brepair\b/.test(t) &&
    /\b(situation|relationship|this)\b/.test(t);
  return (
    t.includes('how would you repair this relationship if you were ryan') ||
    (t.includes('if you were ryan') && t.includes('repair this relationship')) ||
    ryanRepair
  );
}

/** Scenario A second repair ask after the canonical Ryan repair question (model paraphrase). */
export function looksLikeScenarioARepairReAskQuestion(text: string): boolean {
  const t = normalizeApostrophes(text).toLowerCase();
  if (/\bhow would you make that repair actually happen\b/.test(t)) return true;
  if (/\bwhat would that repair look like\b/.test(t) && /\bryan\b/.test(t)) return true;
  if (/\bmake that repair actually happen\b/.test(t) && /\bryan\b/.test(t)) return true;
  if (/\bwhat would you (actually )?do\b/.test(t) && /\bryan\b/.test(t) && /\brepair\b/.test(t)) {
    return true;
  }
  return false;
}

/** Strip Scenario A repair-as-Ryan blocks so a forced contempt probe is the only substantive assistant line. */
export function stripScenarioARepairQuestion(text: string): string {
  let cleaned = text
    .replace(/(?:^|\n)\s*How would you repair this relationship if you were Ryan\?\s*/gi, '\n')
    .replace(
      /(?:^|\n)\s*What if you were Ryan\?[^\n]*How would you repair this (?:situation|relationship)\??\s*/gi,
      '\n',
    )
    .replace(/(?:^|\n)\s*If you were Ryan[^?.!\n]*repair[^?.!\n]*[?.!]?\s*/gi, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  cleaned = stripEmbeddedScenarioARepairQuestionAsk(cleaned);
  return cleaned.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Streaming TTS often splits on the `?` after "What if you were Ryan?" before the repair tail arrives.
 * Hold the Ryan lead clause until the next flushed sentence can complete the repair ask.
 */
export function isIncompleteScenarioARepairLeadSentence(text: string): boolean {
  const t = normalizeApostrophes(text).trim().toLowerCase();
  if (!t || looksLikeScenarioARepairQuestion(text)) return false;
  return /\b(what if you were ryan|if you were ryan|and if you were ryan)\b/.test(t) && !/\brepair\b/.test(t);
}

/** Expand truncated Ryan repair lead-ins so repeat TTS delivers the full canonical ask. */
export function resolveInterviewQuestionRepeatTtsText(storedText: string): string {
  const t = (storedText ?? '').trim();
  if (!t) return t;
  if (isIncompleteScenarioARepairLeadSentence(t)) {
    return SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
  }
  return t;
}

/** Remove a glued Scenario A repair ask from a longer paragraph (model echo / stacked asks). */
export function stripEmbeddedScenarioARepairQuestionAsk(draft: string): string {
  const t0 = (draft ?? '').trim();
  if (!t0) return draft;
  let t = t0;
  const patterns: RegExp[] = [
    /\bHow would you repair this relationship if you were Ryan\??\s*/gi,
    /\bWhat if you were Ryan\??\s*How would you repair this (?:situation|relationship)\??\s*/gi,
    /\bIf you were Ryan[^?.!\n]{0,120}?repair[^?.!\n]{0,120}?[?.!]?\s*/gi,
    /\bHow would you repair this (?:situation|relationship)\??\s*/gi,
  ];
  let prev = '';
  while (prev !== t) {
    prev = t;
    for (const re of patterns) {
      t = t.replace(re, '').replace(/\s{2,}/g, ' ').trim();
    }
  }
  return t
    .replace(/^\s*[.,;—–\-–]\s*/g, '')
    .replace(/\s+[.,;—–\-–]\s*$/g, '')
    .trim();
}

/**
 * Parallel streaming TTS flushes by sentence before duplicate stripping on the full assistant turn.
 * When the Scenario A repair ask was already spoken, suppress model echoes in a flushed chunk.
 */
export function stripScenarioARepairQuestionStreamingEcho(
  spoken: string,
  repairAlreadyAsked: boolean,
): string | null {
  const t0 = (spoken ?? '').trim();
  if (!repairAlreadyAsked || !t0) {
    return t0;
  }
  if (looksLikeScenarioARepairQuestion(t0)) {
    return null;
  }
  const stripped = stripEmbeddedScenarioARepairQuestionAsk(t0).trim();
  if (!stripped) {
    return null;
  }
  if (stripped !== t0) {
    return stripped;
  }
  const low = t0.toLowerCase();
  if (/\b(if you were ryan|what if you were ryan)\b/.test(low) && /\brepair\b/.test(low)) {
    return null;
  }
  if (/\bhow would you repair\b/.test(low) && /\b(situation|relationship|this)\b/.test(low)) {
    return null;
  }
  return t0;
}

/** Scenario B Q2 — James differently / appreciation probe wording (not repair-as-James). */
export function looksLikeScenarioBJamesDifferentlyQuestion(text: string): boolean {
  const t = text.toLowerCase();
  if (t.includes("what do you think james could've done differently so sarah feels better")) return true;
  const jamesCtx = /\bjames\b/.test(t);
  const differently =
    /\b(could'?ve done differently|could have done differently|done differently|anything james could|what james could)\b/.test(
      t,
    );
  const beforeFight =
    jamesCtx &&
    /\b(before (the )?(fight|blow|blow-?up)|might have helped|so sarah feels|feel appreciated|helped sarah)\b/.test(t);
  const leanJamesProbe =
    /\bis there anything james could have done\b/.test(t) && /\bhelp(ed)?\b/.test(t);
  return (jamesCtx && differently) || beforeFight || leanJamesProbe;
}

/** Scenario B Q3 — repair in James's shoes. */
export function looksLikeScenarioBRepairAsJamesQuestion(text: string): boolean {
  const t = text.toLowerCase();
  const asJames =
    /\bif you were james\b/.test(t) &&
    /\b(repair|fix|make it right|apologize|patch things|make up|mend|handle|approach|smooth|sort (this|it) out|navigate|move forward)\b/.test(
      t,
    );
  // Avoid matching characterization prompts like "How would you describe James's approach …"
  // (those tripped `how would you` + `james` + `approach` and incorrectly set s2RepairProbeDeliveredRef).
  const howRepairJames =
    /\bhow would you\b/.test(t) &&
    /\bjames\b/.test(t) &&
    /\b(repair|fix|make things right|make it right|patch things|apologize|mend|make up)\b/.test(t);
  const compact =
    t.length < 200 &&
    /\bjames\b/.test(t) &&
    /\b(you were|as james|if you were)\b/.test(t) &&
    /\b(repair|fix|make things right|make it right|patch things|apologize|mend|make up|sort (this|it) out|navigate|move forward)\b/.test(
      t,
    );
  return asJames || howRepairJames || compact;
}

export function looksLikeRepairInterviewQuestion(text: string): boolean {
  return (
    looksLikeScenarioARepairQuestion(text) ||
    looksLikeScenarioBRepairAsJamesQuestion(text) ||
    isScenarioCRepairAssistantPrompt(text)
  );
}

/**
 * Pessimism / refusal about whether the situation can be repaired — Scenario C repair ask only.
 * Used to fire the repair refusal probe when repair pessimism appears after the Scenario C repair prompt.
 */
export function isScenarioCRepairPessimismRefusalSignal(text: string): boolean {
  const t = normalizeApostrophes(text).toLowerCase();
  if (!t.trim()) return false;
  const patterns: RegExp[] = [
    /\bnot\s+sure\s+(this|it|things?)\s+can\s+be\s+fixed\b/,
    /\b(can'?t|cannot)\s+be\s+fixed\b/,
    /\b(can'?t|cannot)\s+really\s+be\s+fixed\b/,
    /\bno\s+way\s+to\s+fix\b/,
    /\b(he|she|they)'?s\s+just\s+not\s+able\s+to\b/,
    /\bdoesn'?t\s+know\s+how\s+to\b/,
    /\bdon'?t\s+know\s+how\s+to\b/,
    /\bprobably\s+won'?t\s+work\b/,
    /\b(it\s+)?probably\s+won'?t\b/,
    /\btoo\s+far\s+gone\b/,
    /\bbeyond\s+repair\b/,
    /\b(irreparable|unfixable)\b/,
    /\b(point\s+of\s+)?no\s+return\b/,
    /\bnothing\s+(left\s+)?to\s+salvage\b/,
    /\bcan'?t\s+see\s+(this|it)\s+(working|being\s+fixed)\b/,
    /\bwon'?t\s+(ever\s+)?work\b/,
    /\bnot\s+worth\s+(fixing|trying)\b/,
    /\bit'?s\s+(too\s+)?late\s+to\s+fix\b/,
  ];
  return patterns.some((re) => re.test(t));
}

export function isRepairRefusalProbeAssistantLine(content: string): boolean {
  const n = normalizeWhitespace(content);
  return n === normalizeWhitespace(CLIENT_REPAIR_REFUSAL_PROBE);
}

function looksLikeScenarioAContemptProbeQuestion(text: string): boolean {
  const t = text.toLowerCase().replace(/\u2019/g, "'");
  const mentionsEmmaLine = t.includes("you've made that very clear");
  const canonicalFrameworkProbe =
    mentionsEmmaLine &&
    /what about when emma says/.test(t) &&
    /\bwhat do you make of (that|it)\b/.test(t);
  const alternateInjectProbe =
    mentionsEmmaLine && t.includes("what do you make of emma's statement");
  return canonicalFrameworkProbe || alternateInjectProbe;
}

function looksLikeMoment5AppreciationAssistantPrompt(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('conflict or disagreement with someone important') ||
    (t.includes('think of a time when you had a conflict with someone important') &&
      t.includes('how did things get resolved')) ||
    (t.includes('tell me about a time you had a conflict') && t.includes('how did it get resolved')) ||
    t.includes('think of a time you really celebrated someone') ||
    (t.includes('really celebrated') && t.includes('your life'))
  );
}

function looksLikeMoment4ThresholdAssistantPrompt(text: string): boolean {
  const t = (text ?? '').toLowerCase();
  return (
    t.includes(
      '"at what point do you decide when a relationship is something to work through versus something you need to walk away from?"',
    ) ||
    (t.includes('work through') && t.includes('walk away') && t.includes('point'))
  );
}

/**
 * Mentalizing-style primary prompts (interpretation / meaning), not repair logistics or thresholds.
 */
export function looksLikeMentalizingThinInterviewQuestion(text: string): boolean {
  const raw = normalizeApostrophes(text);
  const t = raw.toLowerCase();
  if (looksLikeMoment5AppreciationAssistantPrompt(raw)) return false;
  if (isScenarioCRepairAssistantPrompt(raw)) return false;
  if (looksLikeScenarioCCommitmentThresholdAssistantPrompt(raw)) return false;
  if (looksLikeMoment4ThresholdAssistantPrompt(raw)) return false;
  if (looksLikeScenarioBJamesDifferentlyQuestion(raw)) return false;
  if (looksLikeScenarioARepairQuestion(raw)) return false;
  if (looksLikeScenarioBRepairAsJamesQuestion(raw)) return false;

  if (t.includes("what's going on between these two")) return true;
  if (t.includes('what do you think is going on here')) return true;
  if (isScenarioCQ1Prompt(raw)) return true;
  if (looksLikeScenarioAContemptProbeQuestion(raw)) return true;
  if (/\bwhat'?s going on here\b/.test(t)) return true;
  if (
    /\bwhat do you make of (that|it)\b/.test(t) &&
    !looksLikeScenarioCCommitmentThresholdAssistantPrompt(raw)
  ) {
    return true;
  }
  return false;
}

export function repairAnswerShowsRefusalOrCharacterDeflection(text: string): boolean {
  const t = text.toLowerCase();
  const inability =
    /\b(not sure i could|not sure how i could|don'?t know|do not know|i couldn'?t|couldn'?t|hard to say|no idea|not sure what)\b/.test(
      t,
    );
  const genericDeflect = /\bjust\s+communicate\s+better\b/.test(t);
  const deflectToCharacterFlaw =
    /\b(he|she|they)'?s\s+not\s+a\s+good\b/.test(t) ||
    /\b(he|she) never listens\b/.test(t) ||
    /\bshe'?s\s+too\s+emotional\b/.test(t) ||
    /\bhe'?s\s+too\s+(stubborn|defensive)\b/.test(t) ||
    /\b(not a good communicator|bad communicator|doesn'?t communicate well|poor communicator)\b/.test(t) ||
    /\b(he|she)'?s\s+(immature|unreasonable|impossible)\b/.test(t);
  return inability || genericDeflect || deflectToCharacterFlaw;
}

/** Surface emotion words — labels without inherent causal reasoning. */
const SURFACE_EMOTION_LABEL_RE =
  /\b(angry|upset|mad|frustrated|hurt|sad|annoyed|tense|clueless|confused|arguing|fighting)\b/i;

/**
 * True when the answer is thin affect labeling only: emotion words and/or simple he/she/they affect,
 * under 15 words, with no causal / explanatory reasoning about why or what's underneath.
 */
export function looksLikeSurfaceOnlyEmotionalLabelAnswer(text: string): boolean {
  const w = text.trim().split(/\s+/).filter(Boolean).length;
  if (w >= 15) return false;
  const t = text.toLowerCase();
  const emotionalAdj = '(angry|upset|mad|frustrated|hurt|sad|annoyed|tense|clueless|confused)';
  const hasPronounSurfaceLabel =
    new RegExp(`\\b(she|he)'s\\s+${emotionalAdj}\\b`).test(t) ||
    new RegExp(`\\b(she|he)\\s+is\\s+${emotionalAdj}\\b`).test(t) ||
    /\bthey'?re\s+(angry|upset|mad|frustrated|hurt|sad|annoyed|tense|clueless|confused|arguing|fighting)\b/.test(t) ||
    /\bthey\s+are\s+(angry|upset|mad|frustrated|hurt|sad|annoyed|tense|clueless|confused|arguing|fighting)\b/.test(t);
  const hasStandaloneLabel = SURFACE_EMOTION_LABEL_RE.test(t);
  if (!hasPronounSurfaceLabel && !hasStandaloneLabel) return false;
  return !hasCausalOrExplanatoryReasoning(t);
}

/** Causal / mentalizing depth — disqualifies targeted surface-label probe. */
function hasCausalOrExplanatoryReasoning(t: string): boolean {
  if (/\bbecause\b/.test(t)) return true;
  if (/\bfeels?\s+like\b/.test(t)) return true;
  if (/\bfeel\s+like\b/.test(t)) return true;
  if (/\b(she|he|they)\s+feels\b/.test(t)) return true;
  if (
    /\b(although|since|given that|that's why|so that)\b/.test(t) ||
    /\b(i think|i guess|i feel that|maybe|perhaps|probably)\b/.test(t) ||
    /\b(seems like|sounds like|looks like)\b/.test(t)
  ) {
    return true;
  }
  if (
    /\b(between them|each other|misunderstand|disconnect|dynamic|pattern)\b/.test(t) ||
    /\b(needs to|needed to|wanted to|trying to|tried to)\b/.test(t) ||
    /\b(heard|listening|talking|communicat)\b/.test(t)
  ) {
    return true;
  }
  if (/\b(when|after|before)\s+(he|she|they|it)\b/.test(t)) return true;
  if (/\b(underneath|what's really|what is really|root)\b/.test(t)) return true;
  return false;
}

export function hasClearConciseDirectAnswer(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (/^(yes|no|yeah|yep|nope|nah|sure|okay|ok)\.?$/i.test(t)) return true;
  return false;
}

export function isClientOrElongatingInterviewProbeAssistant(content: string): boolean {
  if (isApprovedElongatingProbeOnly(content)) return true;
  const n = normalizeWhitespace(content);
  return (
    n === normalizeWhitespace(CLIENT_REPAIR_REFUSAL_PROBE) ||
    n === normalizeWhitespace(CLIENT_MENTALIZING_SURFACE_PROBE) ||
    n === normalizeWhitespace(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE) ||
    n === normalizeWhitespace(CLIENT_SHORT_ELABORATION_PROBE)
  );
}

/** Meta-comment / thin follow-up lines — not the substantive scenario question to verbatim-repeat. */
const NON_REPEATABLE_ASSISTANT_LINE_PATTERNS = [
  'can you say more about that',
  'just say whatever comes to mind',
  'say whatever comes to mind',
  'could you say more',
  'can you tell me more',
  "i didn't quite catch that",
  'could you say it again',
  'would you mind repeating that',
  'seems like an interruption happened',
  "sorry, i didn't catch",
  'can you elaborate',
  'go on',
  'tell me more',
  'what else',
  'take your time',
  'still here',
] as const;

export function isNonRepeatableAssistantLineForVerbatimReplay(content: string): boolean {
  if (isClientOrElongatingInterviewProbeAssistant(content)) return true;
  const lower = content.trim().toLowerCase();
  if (!lower) return false;
  return NON_REPEATABLE_ASSISTANT_LINE_PATTERNS.some((pattern) => lower.includes(pattern));
}

export function transcriptContainsMentalizingSurfaceProbe(
  messages: Array<{ role: string; content?: string | null }>,
): boolean {
  return messages.some(
    (m) =>
      m.role === 'assistant' &&
      normalizeWhitespace(m.content ?? '') === normalizeWhitespace(CLIENT_MENTALIZING_SURFACE_PROBE),
  );
}

export function transcriptContainsScenarioCSophiePerspectiveProbe(
  messages: Array<{ role: string; content?: string | null }>,
): boolean {
  return messages.some(
    (m) =>
      m.role === 'assistant' &&
      normalizeWhitespace(m.content ?? '') === normalizeWhitespace(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE),
  );
}

/** True when the user volunteered inference about Sophie's emotional experience or the impact on her. */
export function userAnswerHasSophiePerspectiveLanguage(text: string): boolean {
  const t = normalizeApostrophes(text).toLowerCase();
  if (!t.trim()) return false;

  const mentionsSophie = /\bsophie\b/.test(t);
  const mentionsHerInScenarioContext =
    /\b(she|her)\b/.test(t) &&
    (/\b(sophie|daniel|leaving|left|walk(ed)? away|pattern)\b/.test(t) ||
      /\bwhat (this|it) (is|was|has been|might be) like for (her|sophie)\b/.test(t));

  if (!mentionsSophie && !mentionsHerInScenarioContext) {
    if (!/\b(for (her|sophie)|impact on (her|sophie))\b/.test(t)) {
      return false;
    }
  }

  const sophieExperiencePatterns: RegExp[] = [
    /\bsophie\b.{0,100}\b(feel|felt|feeling|feels|upset|hurt|frustrated|angry|waiting|unheard|dismissed|abandoned|lonely|painful|hard|difficult|invalidated|exhausted|tired|scared|anxious|resigned|disappointed)\b/,
    /\b(she|her)\b.{0,80}\b(feel|felt|feeling|feels|upset|hurt|frustrated|waiting|unheard|dismissed|left alone|abandoned|invalidated|lonely|painful|hard|difficult)\b/,
    /\bwhat (this|it|the pattern|leaving|him leaving|him walking away) (is|was|has been|must be|might be) like for (her|sophie)\b/,
    /\b(for sophie|for her)\b.{0,80}\b(hard|difficult|painful|lonely|invalidating|exhausting|draining|frustrating|hurtful|damaging)\b/,
    /\bimpact on (her|sophie)\b/,
    /\b(sophie|she)\b.{0,100}\b(going through|experiencing|dealing with|living with|put up with|endured|suffered|carries|carrying)\b/,
    /\b(recurring|repeated|pattern of leaving|pattern of walking away|again and again|over time|each time he)\b.{0,100}\b(sophie|she|her)\b/,
    /\b(sophie|she)\b.{0,100}\b(over time|each time|again|pattern|recurring|repeatedly)\b/,
  ];
  return sophieExperiencePatterns.some((re) => re.test(t));
}

/** User answered Scenario C Q1 with Daniel-focused inference (not a misplaced repair/logistics answer). */
export function userAnswerAddressesDanielStateForScenarioCQ1(text: string): boolean {
  if (isMisplacedScenarioCQ1Answer(text)) return false;
  const t = normalizeApostrophes(text).toLowerCase();
  if (!t.trim()) return false;
  return (
    /\bdaniel\b/.test(t) ||
    (/\b(he|him)\b/.test(t) &&
      /\b(feel|felt|feeling|overwhelm|avoid|shut|withdraw|didn'?t know|know what to say|put on the spot|buying time|processing|ready|come back|apolog|regret|shame|anxiety|flooded|stuck|internal|state|emotion|experience|going through|struggle|vulnerable|defensive|avoidant|figure out|time to)\b/.test(
        t,
      ))
  );
}

/**
 * True when the user is refusing to elaborate (hard stop). Used to end repair/probe loops and advance
 * the interview instead of chaining another probe or re-asking repair.
 */
export function isInterviewHardStopUserTurn(text: string): boolean {
  const raw = normalizeWhitespace(normalizeApostrophes(text));
  const t = raw.toLowerCase().trim();
  if (!t) return true;
  if (/^(no|nope|nah|pass|skip|idk|dunno)\.?$/i.test(raw.trim())) return true;
  if (
    /^(i\s+don'?t\s+know|i\s+do\s+not\s+know|no\s+idea|not\s+sure)\.?$/i.test(t) ||
    /^nothing\s+to\s+add/i.test(t) ||
    /^i\s+have\s+nothing(\s+to\s+add)?/i.test(t) ||
    /^i\s+already\s+said/i.test(t) ||
    /^(i\s+can'?t|i\s+cannot)\.?$/i.test(t) ||
    /^can'?t\s+say/i.test(t) ||
    /^no\s+thanks?\.?$/i.test(t) ||
    /^not\s+really\.?$/i.test(t)
  ) {
    return true;
  }
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 1 && words.length <= 5) {
    const hasSubstanceMarker =
      /\b(because|when|after|before|since|explain|apolog|repair|try|would|could|should|feel|mean|example|happened|said|did|went|need|want|tell|listen|talk|understand|understood|help|work|fix)\b/i.test(
        t,
      );
    if (!hasSubstanceMarker && /\b(no|not|nothing|never|nah|pass|skip|dunno|idk|unsure|confused|done|stop)\b/i.test(t)) {
      return true;
    }
  }
  return false;
}

/**
 * Scenario A only: last assistant line is a repair ask/re-ask, repair-refusal probe, or thin "repeat scenario" offer.
 * **Does not** include word-count elongating probes alone ("Can you say more about that?") — a hard "no" there must
 * still run the scripted Situation 1 follow-ups; client must not auto-advance the scenario.
 * Excludes mentalizing surface probe (hard-stop there must not skip the scenario).
 */
export function scenarioALastAssistantIsRepairProbeOrFollowUp(content: string): boolean {
  const c = content ?? '';
  if (isRepairRefusalProbeAssistantLine(c)) return true;
  if (looksLikeScenarioARepairQuestion(c)) return true;
  const t = normalizeApostrophes(c).toLowerCase();
  if (
    /\b(hear the scenario again|run through it again|anything about the situation that'?s unclear|want me to run through)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (/\bryan\b/.test(t) && /\b(repair|apolog|fix|make (that |it )?repair|make it happen|work it out|patch things|resolve)\b/.test(t)) {
    return true;
  }
  if (/\b(if you were ryan|you were ryan|as ryan)\b/.test(t) && /\b(how would|how could|what would)\b/.test(t)) {
    return true;
  }
  return false;
}

export type ClientDisengagementProbePick =
  | {
      kind: 'repair_refusal';
      probe: typeof CLIENT_REPAIR_REFUSAL_PROBE;
      repairRefusal: RepairRefusalDetectionDetail;
    }
  | { kind: 'mentalizing_surface'; probe: typeof CLIENT_MENTALIZING_SURFACE_PROBE }
  | {
      kind: 'scenario_c_sophie_perspective';
      probe: typeof SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
    }
  | { kind: 'short_elaboration'; probe: typeof CLIENT_SHORT_ELABORATION_PROBE };

export type RepairRefusalTriggerReason =
  | 'explicit_refusal'
  | 'response_too_short'
  | 'redirect_to_other_party_only';

export type RepairRefusalDetectionDetail = {
  repair_refusal_detected: boolean;
  trigger_condition: RepairRefusalTriggerReason | null;
  /** @deprecated Prefer trigger_condition. Kept for existing logs / payload readers. */
  trigger_reason: RepairRefusalTriggerReason | null;
  response_word_count: number;
  repair_refusal_anomaly: boolean;
  has_concrete_repair_content: boolean;
};

function countWords(text: string): number {
  return normalizeWhitespace(text).split(/\s+/).filter(Boolean).length;
}

export function repairAnswerHasConcreteSuggestionActionOrStep(text: string): boolean {
  const t = normalizeApostrophes(text).toLowerCase();
  if (!t.trim()) return false;
  return (
    /\b(i|we)\s+(commit|promise|pledge)\b/i.test(t) ||
    /\b(i|we)\s+shouldn'?t have\b/i.test(t) ||
    /\b(i|we)\s+(would|will)\s+(apologiz\w*|say sorry|listen|acknowledg\w*|own)\b/i.test(t) ||
    /\b(i|we|he|she|they|daniel|sophie|james|sarah|ryan|emma)\s+(would|could|should|need(?:s)? to|might|can)\s+(say|tell|ask|apologiz\w*|acknowledg\w*|own|admit|listen|validat\w*|explain|share|talk|communicat\w*|set|agree|commit|change|repair|fix|resolv\w*|revisit|come back|take|give|try)\b/i.test(
      t,
    ) ||
    /\b(both|each|together)\s+(of\s+them\s+)?(need|should|could|would|can)\s+(to\s+)?(talk|communicat|listen|agree|set|work|repair|resolve|try)\b/i.test(
      t,
    ) ||
    /\b(apologiz|listen|validate|acknowledge|own(?:ership)?|take responsibility|make amends|talk it through|communicat|counsel(?:ing|ling)|therapy|therapist|mediator|friend|support|boundary|agreement|next step|follow[- ]?up|check in)\b/i.test(
      t,
    ) ||
    /\b(talk|discuss|listen|explain|share|ask|apologiz\w*|acknowledg\w*|validat\w*)\b/i.test(t) ||
    /\b(talk\s+about\s+what'?s\s+going\s+on|have\s+the\s+conversation|discuss\s+it\s+together|make\s+(him|her|them)\s+feel\s+heard)\b/i.test(
      t,
    )
  );
}

function repairAnswerHasCommunicationVerb(text: string): boolean {
  return /\b(talk|discuss|listen|explain|share)\b/i.test(normalizeApostrophes(text).toLowerCase());
}

function repairFocalAndOtherFromPrompt(lastAssistantContent?: string): { focal: string; other: string } | null {
  const t = normalizeApostrophes(lastAssistantContent ?? '').toLowerCase();
  if (/\b(if you were ryan|you were ryan|as ryan)\b/.test(t)) return { focal: 'ryan', other: 'emma' };
  if (/\b(if you were james|you were james|as james)\b/.test(t)) return { focal: 'james', other: 'sarah' };
  if (/\b(if you were daniel|you were daniel|as daniel|daniel\b.*\brepair|repair\b.*\bdaniel)\b/.test(t)) {
    return { focal: 'daniel', other: 'sophie' };
  }
  return null;
}

function repairAnswerRedirectsOnlyToOtherParty(userAnswer: string, lastAssistantContent?: string): boolean {
  const parties = repairFocalAndOtherFromPrompt(lastAssistantContent);
  if (!parties) return false;
  const t = normalizeApostrophes(userAnswer).toLowerCase();
  const focalAction = new RegExp(
    `\\b(${parties.focal}|he)\\b.{0,60}\\b(should|could|would|needs?\\s+to|can|might)\\b.{0,60}\\b(say|tell|ask|apologiz|acknowledg|listen|validat|explain|share|talk|communicat|repair|fix|resolve)\\b`,
    'i',
  ).test(t);
  const namesOther = new RegExp(`\\b${parties.other}\\b|\\bshe\\b|\\bher\\b`, 'i').test(t);
  if (!namesOther || focalAction) return false;
  if (/\b(both|each|together|each other|they)\b/i.test(t)) return false;
  if (repairAnswerHasConcreteSuggestionActionOrStep(userAnswer)) return false;
  return /\b(needs?\s+to|should|has\s+to|must|just)\b.{0,80}\b(calm\s+down|accept|stop|let\s+it\s+go|get\s+over\s+it|deal\s+with\s+it)\b/i.test(
    t,
  );
}

/**
 * User answered a Scenario A repair-as-Ryan prompt with a concrete plan (not line-analysis only).
 */
export function userAnswerSatisfiesScenarioARepairPrompt(
  answer: string,
  lastAssistantContent?: string,
): boolean {
  if (!repairAnswerHasConcreteSuggestionActionOrStep(answer)) return false;
  const t = normalizeApostrophes(answer).toLowerCase().trim();
  if (!t) return false;

  const firstPersonRepair =
    /\bif i were ryan\b/.test(t) ||
    /\b(as ryan|being ryan)\b/.test(t) ||
    /\b(i would|i'd|i will|i commit|i shouldn't have|i should have|i apologize|i apologise)\b/.test(t);

  const ryanOwnership =
    /\b(ryan|he)\b/.test(t) &&
    /\b(apolog|sorry|shouldn't have|should not have|commit|won't|will not|listen|acknowledg|own|responsib|priorit|call|date|emergency)\b/.test(
      t,
    );

  if (firstPersonRepair || ryanOwnership) return true;

  const parties = repairFocalAndOtherFromPrompt(lastAssistantContent);
  if (parties?.focal === 'ryan' && repairAnswerHasConcreteSuggestionActionOrStep(answer)) {
    return /\b(both|together|each|talk|listen|apolog|commit|boundary|agreement)\b/i.test(t);
  }
  return false;
}

export function findLastUserWithPriorAssistantContent(
  messages: Array<{ role: string; content?: string | null }>,
): { lastUserContent: string | null; priorAssistantContent: string | null } {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role !== 'user') continue;
    const lastUserContent = (messages[i].content ?? '').trim();
    let priorAssistantContent: string | null = null;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (messages[j].role === 'assistant') {
        priorAssistantContent = messages[j].content ?? '';
        break;
      }
    }
    return { lastUserContent, priorAssistantContent };
  }
  return { lastUserContent: null, priorAssistantContent: null };
}

/**
 * After a concrete repair-as-Ryan answer, suppress duplicate repair asks (including re-asks) and advance.
 */
export function shouldAdvanceScenarioAAfterSatisfiedRepair(
  messages: Array<{ role: string; content?: string | null }>,
  strippedAssistantDraft: string,
  interviewMoment: number,
): boolean {
  if (interviewMoment !== 1) return false;
  if (!strippedAssistantDraft.trim()) return false;

  const draftIsRepairFollowUp =
    looksLikeScenarioARepairReAskQuestion(strippedAssistantDraft) ||
    looksLikeScenarioARepairQuestion(strippedAssistantDraft);
  if (!draftIsRepairFollowUp) return false;

  const { lastUserContent, priorAssistantContent } = findLastUserWithPriorAssistantContent(messages);
  if (!lastUserContent || !priorAssistantContent) return false;

  const priorIsRepairContext =
    looksLikeScenarioARepairQuestion(priorAssistantContent) ||
    looksLikeScenarioARepairReAskQuestion(priorAssistantContent) ||
    isRepairRefusalProbeAssistantLine(priorAssistantContent) ||
    scenarioALastAssistantIsRepairProbeOrFollowUp(priorAssistantContent);

  if (!priorIsRepairContext) return false;

  return userAnswerSatisfiesScenarioARepairPrompt(lastUserContent, priorAssistantContent);
}

export function evaluateRepairRefusalDetection(
  userAnswer: string,
  wordCount = countWords(userAnswer),
  lastAssistantContent?: string,
): RepairRefusalDetectionDetail {
  const t = normalizeApostrophes(userAnswer).toLowerCase();
  const hasConcreteRepairContent = repairAnswerHasConcreteSuggestionActionOrStep(userAnswer);
  const hasCommunicationVerb = repairAnswerHasCommunicationVerb(userAnswer);
  const explicitRefusalLanguage =
    /\bthere'?s\s+nothing\s+to\s+(repair|fix)\b/i.test(t) ||
    /\bnothing\s+(to\s+)?(repair|fix)\b/i.test(t) ||
    /\b(i\s+wouldn'?t|i\s+would\s+not)\s+(repair|fix|apologiz|try)\b/i.test(t) ||
    /\b(he|she|they|james|sarah|daniel|sophie|ryan|emma)\s+(doesn'?t|does\s+not|don'?t|do\s+not)\s+need\s+to\s+apologiz/i.test(
      t,
    ) ||
    /\b(he|she|they|james|sarah|daniel|sophie|ryan|emma)\s+(did|does|has)\s+nothing\s+wrong\b.*\bnothing\s+to\s+(fix|repair)\b/i.test(
      t,
    ) ||
    /\b(that|this|it)\s+(isn'?t|is\s+not|wasn'?t|was\s+not)\s+(his|her|their|james'?s|sarah'?s|daniel'?s|sophie'?s|ryan'?s|emma'?s)\s+(fault|problem|responsibilit(?:y|ies))\b/i.test(
      t,
    ) ||
    /\bnot\s+(his|her|their|james'?s|sarah'?s|daniel'?s|sophie'?s|ryan'?s|emma'?s)\s+(fault|problem|responsibilit(?:y|ies))\b/i.test(
      t,
    );

  let triggerCondition: RepairRefusalTriggerReason | null = null;
  if (explicitRefusalLanguage) {
    triggerCondition = 'explicit_refusal';
  } else if (wordCount < 8 && !hasConcreteRepairContent) {
    triggerCondition = 'response_too_short';
  } else if (repairAnswerRedirectsOnlyToOtherParty(userAnswer, lastAssistantContent)) {
    triggerCondition = 'redirect_to_other_party_only';
  }

  const repairRefusalDetected = triggerCondition !== null;
  return {
    repair_refusal_detected: repairRefusalDetected,
    trigger_condition: triggerCondition,
    trigger_reason: triggerCondition,
    response_word_count: wordCount,
    repair_refusal_anomaly: repairRefusalDetected && (wordCount > 40 || hasCommunicationVerb),
    has_concrete_repair_content: hasConcreteRepairContent,
  };
}

function userTurnIsRepeatRequest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return (
    /\bcan you repeat\b/i.test(t) ||
    /\brepeat\w* what you said\b/i.test(t) ||
    /\brepeat what you said\b/i.test(t) ||
    /\brepeat the questions?\b/i.test(t) ||
    /\bsay (that|it) again\b/i.test(t) ||
    /\bwhat was the question\b/i.test(t) ||
    /\bwhat did you (say|ask)\b/i.test(t) ||
    /\bcome again\b/i.test(t) ||
    /\b(yes|yeah|yep|sure),?\s+repeat\b/i.test(t)
  );
}

/** Last real scenario/interview question to re-read on repeat-request — skips client elongating probes. */
export function findLastRepeatableInterviewQuestionText(
  messages: Array<{
    role: string;
    content?: string | null;
    isScoreCard?: boolean;
    isWelcomeBack?: boolean;
  }>,
  fallbackLastQuestionText?: string | null,
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    if (m.isScoreCard) continue;
    if (m.isWelcomeBack) continue;
    const raw = (m.content ?? '').trim();
    if (!raw) continue;
    if (isNonRepeatableAssistantLineForVerbatimReplay(raw)) continue;
    if (/^i only caught part of that\b/i.test(raw)) continue;
    if (/^welcome back\b/i.test(raw)) continue;
    return raw;
  }
  const fb = (fallbackLastQuestionText ?? '').trim();
  if (fb && !isNonRepeatableAssistantLineForVerbatimReplay(fb)) return fb;
  return fb;
}

export function pickClientDisengagementProbe(input: {
  userAnswer: string;
  lastAssistantContent: string;
  wordCount: number;
  /** Already answering any client or approved elongating probe — do not chain. */
  answeringAfterProbe: boolean;
  /** Name / ready / re-entry / etc. */
  exemptMetaTurn: boolean;
  /** Opening name capture turn */
  isGreetingNameTurn: boolean;
  /** Explicit decline / pass — skip generic short probe only */
  isExplicitDecline: boolean;
  /** Infra / ratio recovery assistant lines */
  isAssistantRecoveryOrMetaLine: boolean;
  /**
   * True iff this user message is the first user turn in the current scenario vignette (not a follow-up).
   * Required for the mentalizing surface-label probe — never fires on 2nd+ scenario replies.
   */
  isFirstUserTurnInScenario: boolean;
  /** Prior `skip_request` meta in this moment — suppress generic short elaboration only. */
  hadSkipRequestInThisMoment?: boolean;
  /** Scenario C Sophie-perspective probe already fired this interview — at most once. */
  scenarioCSophiePerspectiveProbeAlreadyFired?: boolean;
  /** Generic mentalizing surface probe already delivered earlier in the interview. */
  mentalizingSurfaceProbeAlreadyFired?: boolean;
}): ClientDisengagementProbePick | null {
  const {
    userAnswer,
    lastAssistantContent,
    wordCount,
    answeringAfterProbe,
    exemptMetaTurn,
    isGreetingNameTurn,
    isExplicitDecline,
    isAssistantRecoveryOrMetaLine,
    isFirstUserTurnInScenario,
    hadSkipRequestInThisMoment,
    scenarioCSophiePerspectiveProbeAlreadyFired,
    mentalizingSurfaceProbeAlreadyFired,
  } = input;

  if (!lastAssistantContent.trim()) return null;
  if (answeringAfterProbe || exemptMetaTurn || isGreetingNameTurn || isAssistantRecoveryOrMetaLine) {
    return null;
  }

  const repairQ = looksLikeRepairInterviewQuestion(lastAssistantContent);
  if (repairQ) {
    if (isInterviewHardStopUserTurn(userAnswer)) return null;
    const repairRefusal = evaluateRepairRefusalDetection(userAnswer, wordCount, lastAssistantContent);
    if (repairRefusal.repair_refusal_detected) {
      return { kind: 'repair_refusal', probe: CLIENT_REPAIR_REFUSAL_PROBE, repairRefusal };
    }
  }

  if (
    !scenarioCSophiePerspectiveProbeAlreadyFired &&
    !mentalizingSurfaceProbeAlreadyFired &&
    isFirstUserTurnInScenario &&
    isScenarioCQ1Prompt(lastAssistantContent) &&
    !isMisplacedScenarioCQ1Answer(userAnswer) &&
    userAnswerAddressesDanielStateForScenarioCQ1(userAnswer) &&
    !userAnswerHasSophiePerspectiveLanguage(userAnswer) &&
    wordCount >= 15 &&
    wordCount <= 60
  ) {
    return { kind: 'scenario_c_sophie_perspective', probe: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE };
  }

  if (
    isFirstUserTurnInScenario &&
    looksLikeMentalizingThinInterviewQuestion(lastAssistantContent) &&
    wordCount < 15 &&
    looksLikeSurfaceOnlyEmotionalLabelAnswer(userAnswer)
  ) {
    return { kind: 'mentalizing_surface', probe: CLIENT_MENTALIZING_SURFACE_PROBE };
  }

  if (
    !isExplicitDecline &&
    !isInterviewHardStopUserTurn(userAnswer) &&
    wordCount < 8 &&
    !hasClearConciseDirectAnswer(userAnswer) &&
    !looksLikeMoment4GrudgePrompt(lastAssistantContent) &&
    hadSkipRequestInThisMoment !== true &&
    !userTurnIsRepeatRequest(userAnswer)
  ) {
    return { kind: 'short_elaboration', probe: CLIENT_SHORT_ELABORATION_PROBE };
  }

  return null;
}
