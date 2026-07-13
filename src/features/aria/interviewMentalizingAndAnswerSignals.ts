import { normalizeApostrophes, normalizeWhitespace } from './disengagementProbeNormalize';
import {
  isMisplacedScenarioCQ1Answer,
  isScenarioCRepairAssistantPrompt,
  isScenarioCQ1Prompt,
  looksLikeScenarioCCommitmentThresholdAssistantPrompt,
} from './probeAndScoringUtils';
import {
  looksLikeScenarioARepairQuestion,
} from './scenarioARepairQuestionHelpers';
import {
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
} from './scenarioBProbeLogic';

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

export function hasClearConciseDirectAnswer(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (/^(yes|no|yeah|yep|nope|nah|sure|okay|ok)\.?$/i.test(t)) return true;
  return false;
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
