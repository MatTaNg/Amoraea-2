/**
 * Client-enforced interview probes for thin / disengaged answers (repair + mentalizing + generic short).
 * One probe per user answer — caller must skip when the user is already answering a probe turn.
 */

import { isApprovedElongatingProbeOnly } from './elongatingProbe';
import { APPROVED_ELONGATING_PROBE_LINES } from './elongatingProbe';
import {
  isScenarioCQ1Prompt,
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCCommitmentThresholdAssistantPrompt,
} from './probeAndScoringUtils';
import { looksLikeMoment4GrudgePrompt } from './moment4ProbeLogic';

export const CLIENT_REPAIR_REFUSAL_PROBE =
  "If you had to try anyway, what's one thing you might say or do?" as const;

export const CLIENT_MENTALIZING_SURFACE_PROBE =
  'What do you think is underneath that for each of them?' as const;

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
    n === normalizeWhitespace(CLIENT_SHORT_ELABORATION_PROBE)
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
  | { kind: 'short_elaboration'; probe: typeof CLIENT_SHORT_ELABORATION_PROBE };

export type RepairRefusalTriggerReason =
  | 'explicit_refusal_language'
  | 'response_too_short'
  | 'no_repair_content';

export type RepairRefusalDetectionDetail = {
  repair_refusal_detected: boolean;
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
    /\b(i|we|he|she|they|daniel|sophie|james|sarah|ryan|emma)\s+(would|could|should|need(?:s)? to|might|can)\s+(say|tell|ask|apologiz\w*|acknowledg\w*|own|admit|listen|validat\w*|explain|share|talk|communicat\w*|set|agree|commit|change|repair|fix|resolv\w*|revisit|come back|take|give|try)\b/i.test(
      t,
    ) ||
    /\b(both|each|together)\s+(of\s+them\s+)?(need|should|could|would|can)\s+(to\s+)?(talk|communicat|listen|agree|set|work|repair|resolve|try)\b/i.test(
      t,
    ) ||
    /\b(apologiz|listen|validate|acknowledge|own(?:ership)?|take responsibility|make amends|talk it through|communicat|counsel(?:ing|ling)|therapy|therapist|mediator|friend|support|boundary|agreement|next step|follow[- ]?up|check in)\b/i.test(
      t,
    )
  );
}

export function evaluateRepairRefusalDetection(userAnswer: string, wordCount = countWords(userAnswer)): RepairRefusalDetectionDetail {
  const t = normalizeApostrophes(userAnswer).toLowerCase();
  const hasConcreteRepairContent = repairAnswerHasConcreteSuggestionActionOrStep(userAnswer);
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

  let triggerReason: RepairRefusalTriggerReason | null = null;
  if (explicitRefusalLanguage) {
    triggerReason = 'explicit_refusal_language';
  } else if (wordCount < 15 && !hasConcreteRepairContent) {
    triggerReason = wordCount <= 5 ? 'response_too_short' : 'no_repair_content';
  }

  const repairRefusalDetected = triggerReason !== null;
  return {
    repair_refusal_detected: repairRefusalDetected,
    trigger_reason: triggerReason,
    response_word_count: wordCount,
    repair_refusal_anomaly: repairRefusalDetected && wordCount > 40,
    has_concrete_repair_content: hasConcreteRepairContent,
  };
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
  } = input;

  if (!lastAssistantContent.trim()) return null;
  if (answeringAfterProbe || exemptMetaTurn || isGreetingNameTurn || isAssistantRecoveryOrMetaLine) {
    return null;
  }

  const repairQ = looksLikeRepairInterviewQuestion(lastAssistantContent);
  if (repairQ) {
    if (isInterviewHardStopUserTurn(userAnswer)) return null;
    const repairRefusal = evaluateRepairRefusalDetection(userAnswer, wordCount);
    if (repairRefusal.repair_refusal_detected) {
      return { kind: 'repair_refusal', probe: CLIENT_REPAIR_REFUSAL_PROBE, repairRefusal };
    }
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
    hadSkipRequestInThisMoment !== true
  ) {
    return { kind: 'short_elaboration', probe: CLIENT_SHORT_ELABORATION_PROBE };
  }

  return null;
}
