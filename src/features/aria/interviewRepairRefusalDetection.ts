import { countWords, normalizeApostrophes } from './disengagementProbeNormalize';
import { isRepairRefusalProbeAssistantLine } from './interviewRepairQuestionDetection';
import { scenarioALastAssistantIsRepairProbeOrFollowUp } from './interviewDisengagementTranscriptHelpers';
import {
  isIncompleteScenarioAContemptProbeLeadSentence,
  isScenarioABoundaryReflectionWithoutNextVignette,
  isScenarioAHandoffWithoutNextVignette,
  isTruncatedScenarioAHandoffFragment,
  looksLikeScenarioAContemptProbeQuestion,
  scenarioAEmmaVeryClearContemptReask,
} from './scenarioAContemptProbeTextMatch';
import { isScenarioModalFollowUpProbe } from './interviewScenarioModalPrompt';
import { isScenarioANonScriptedModalParaphrase } from './situation1ExactModalPrompt';
import {
  looksLikeScenarioARepairQuestion,
  looksLikeScenarioARepairReAskQuestion,
  looksLikeScenarioARepairStreamFragment,
} from './scenarioARepairQuestionHelpers';
import { hasScenarioBoundaryWrapPhrase } from './emotionModalTransitionOrchestration';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from './probeAndScoringUtils';
import {
  textContainsScenarioBVignetteBody,
  textContainsScenarioCVignetteBody,
} from './emotionScenarioTransitionInference';
import {
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
  isIncompleteScenarioBBoundaryClosureLeadSentence,
  isIncompleteScenarioBPrematureRepairRedirectLeadSentence,
  isScenarioBBoundaryReflectionWithoutNextVignette,
  isIncompleteScenarioBQ1LeadSentence,
  isScenarioBQ1Prompt,
  lastAssistantPromptIsScenarioBQ1OrPrematureRedirect,
  looksLikeScenarioBQ1Question,
  scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent,
} from './scenarioBProbeLogic';
import { looksLikeInterviewClosingAssistantMessage } from './elongatingProbe';
import { isShortAckOnlySentence } from './interviewerFrameworkPrompt';

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

export function repairAnswerHasConcreteSuggestionActionOrStep(text: string): boolean {
  const t = normalizeApostrophes(text).toLowerCase();
  if (!t.trim()) return false;
  return (
    /\b(i|we)\s+(commit|promise|pledge)\b/i.test(t) ||
    /\b(?:i|we)\b[^.]{0,180}\bcommit\b/i.test(t) ||
    /\b(i|we)\s+(would|will)\s+make\b/i.test(t) ||
    /\bvoicemail\b/i.test(t) ||
    /\b(i|we)\s+shouldn'?t have\b/i.test(t) ||
    /\b(i|we)\s+(would|will)\s+(apologiz\w*|say sorry|listen|acknowledg\w*|own)\b/i.test(t) ||
    /\b(i|we|he|she|they|daniel|sophie|james|sarah|ryan|emma)\s+(would|could|should|need(?:s)? to|might|can)\s+(say|tell|ask|apologiz\w*|acknowledg\w*|own|admit|listen|validat\w*|explain|share|talk|communicat\w*|set|agree|commit|change|repair|fix|resolv\w*|revisit|come back|take|give|try)\b/i.test(
      t,
    ) ||
    /\b(both|each|together)\s+(of\s+them\s+)?(need|should|could|would|can)\s+(to\s+)?(talk|communicat|listen|agree|set|work|repair|resolve|try)\b/i.test(
      t,
    ) ||
    /\b(apologiz|listen|validate|acknowledge|own(?:ership)?|take responsibility|make amends|talk it through|communicat|counsel(?:ing|ling)|therapy|therapist|mediator|friend|support|boundary|agreement|next step|follow[- ]?up|follow through|check in|assure)\b/i.test(
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
    /\b(i would|i'd|i will|i commit|i shouldn't have|i should have|i should|i apologize|i apologise)\b/.test(t);

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

/**
 * User answered a Scenario B repair-as-James prompt with a concrete plan (not line-analysis only).
 */
export function userAnswerSatisfiesScenarioBJamesRepairPrompt(
  answer: string,
  lastAssistantContent?: string,
): boolean {
  if (!repairAnswerHasConcreteSuggestionActionOrStep(answer)) return false;
  const t = normalizeApostrophes(answer).toLowerCase().trim();
  if (!t) return false;

  if (scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(answer)) return true;

  const firstPersonJamesRepair =
    /\bif i were james\b/.test(t) ||
    /\b(as james|being james)\b/.test(t) ||
    /\b(i would|i'd|i will|i apologize|i apologise|i should|i shouldn't have|i should have)\b/.test(t);

  const jamesOwnership =
    /\b(james|he)\b/.test(t) &&
    /\b(apolog|sorry|shouldn't have|commit|listen|acknowledg|own|assure|reflect|repair|fix|better)\b/.test(
      t,
    );

  if (firstPersonJamesRepair || jamesOwnership) return true;

  const parties = repairFocalAndOtherFromPrompt(lastAssistantContent);
  if (parties?.focal === 'james' && repairAnswerHasConcreteSuggestionActionOrStep(answer)) {
    return /\b(both|together|each|talk|listen|apolog|commit|assure|sarah|her)\b/i.test(t);
  }
  return false;
}

function isTransientScenarioBAssistantInterstitial(content: string): boolean {
  const c = (content ?? '').trim();
  if (!c) return true;
  if (isScenarioModalFollowUpProbe(c)) return true;
  if (isShortAckOnlySentence(c)) return true;
  return false;
}

function priorAssistantIsScenarioBQ1OrRedirect(content: string): boolean {
  const t = (content ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  return (
    isScenarioBQ1Prompt(t) ||
    looksLikeScenarioBQ1Question(t) ||
    isIncompleteScenarioBQ1LeadSentence(t) ||
    isIncompleteScenarioBPrematureRepairRedirectLeadSentence(t) ||
    (textContainsScenarioBVignetteBody(t) && looksLikeScenarioBQ1Question(t)) ||
    /\bthat'?s actually what i'?ll ask you about\b/i.test(t)
  );
}

/**
 * Walk back past brief interstitials to the last Scenario B James-repair prompt before the user's turn.
 */
export function findLastUserWithPriorScenarioBJamesRepairContext(
  messages: Array<{ role: string; content?: string | null }>,
): { lastUserContent: string | null; priorJamesRepairAssistantContent: string | null } {
  let lastUserContent: string | null = null;
  let userIdx = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role !== 'user') continue;
    lastUserContent = (messages[i].content ?? '').trim();
    userIdx = i;
    break;
  }
  if (!lastUserContent || userIdx < 0) {
    return { lastUserContent: null, priorJamesRepairAssistantContent: null };
  }
  for (let j = userIdx - 1; j >= 0; j -= 1) {
    if (messages[j].role !== 'assistant') continue;
    const content = messages[j].content ?? '';
    if (looksLikeScenarioBRepairAsJamesQuestion(content)) {
      return { lastUserContent, priorJamesRepairAssistantContent: content };
    }
    if (!isTransientScenarioBAssistantInterstitial(content)) {
      break;
    }
  }
  return { lastUserContent, priorJamesRepairAssistantContent: null };
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

function isTransientScenarioAAssistantInterstitial(content: string): boolean {
  const c = (content ?? '').trim();
  if (!c) return true;
  if (isShortAckOnlySentence(c)) return true;
  if (isScenarioModalFollowUpProbe(c)) return true;
  if (looksLikeScenarioAContemptProbeQuestion(c)) return true;
  if (scenarioAEmmaVeryClearContemptReask(c)) return true;
  if (isIncompleteScenarioAContemptProbeLeadSentence(c)) return true;
  /** Premature interview closing during Scenario A — keep walking back to the repair prompt. */
  if (looksLikeInterviewClosingAssistantMessage(c)) return true;
  return false;
}

/**
 * Walk back past modal/contempt interstitials to the last Scenario A repair prompt before the user's turn.
 */
export function findLastUserWithPriorScenarioARepairContext(
  messages: Array<{ role: string; content?: string | null }>,
): { lastUserContent: string | null; priorRepairAssistantContent: string | null } {
  let lastUserContent: string | null = null;
  let userIdx = -1;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role !== 'user') continue;
    lastUserContent = (messages[i].content ?? '').trim();
    userIdx = i;
    break;
  }
  if (!lastUserContent || userIdx < 0) {
    return { lastUserContent: null, priorRepairAssistantContent: null };
  }

  for (let j = userIdx - 1; j >= 0; j -= 1) {
    if (messages[j].role !== 'assistant') continue;
    const content = messages[j].content ?? '';
    if (
      scenarioALastAssistantIsRepairProbeOrFollowUp(content) ||
      looksLikeScenarioARepairQuestion(content) ||
      looksLikeScenarioARepairReAskQuestion(content) ||
      looksLikeScenarioARepairStreamFragment(content) ||
      isRepairRefusalProbeAssistantLine(content)
    ) {
      return { lastUserContent, priorRepairAssistantContent: content };
    }
    if (!isTransientScenarioAAssistantInterstitial(content)) {
      break;
    }
  }
  return { lastUserContent, priorRepairAssistantContent: null };
}

/** True when parallel stream spoke only a brief ack but post-claude coerced the S1→S2 handoff bundle. */
export function streamMissedScenarioARepairSatisfiedHandoffDelivery(
  streamSpokeText: string,
  coercedText: string,
  messages: Array<{ role: string; content?: string | null }>,
  interviewMoment: number,
): boolean {
  if (interviewMoment !== 1) return false;
  const coerced = coercedText.trim();
  if (!coerced || !textContainsScenarioBVignetteBody(coerced)) return false;
  const repairCtx = findLastUserWithPriorScenarioARepairContext(messages);
  const priorRepairAssistantContent =
    repairCtx.priorRepairAssistantContent ??
    findLastUserWithPriorAssistantContent(messages).priorAssistantContent;
  if (
    !repairCtx.lastUserContent ||
    !priorRepairAssistantContent ||
    !userAnswerSatisfiesScenarioARepairPrompt(
      repairCtx.lastUserContent,
      priorRepairAssistantContent,
    )
  ) {
    return false;
  }
  const spoken = streamSpokeText.trim();
  if (textContainsScenarioBVignetteBody(spoken)) return false;
  if (!spoken) return true;
  if (isShortAckOnlySentence(spoken)) return true;
  const spokenNorm = spoken.toLowerCase().replace(/\s+/g, ' ');
  const coercedNorm = coerced.toLowerCase().replace(/\s+/g, ' ');
  return coercedNorm.length > spokenNorm.length * 1.35 && !coercedNorm.startsWith(spokenNorm);
}

/**
 * After a concrete repair-as-Ryan answer, suppress duplicate repair/contempt asks and advance to S1 wrap.
 */
export function shouldAdvanceScenarioAAfterSatisfiedRepair(
  messages: Array<{ role: string; content?: string | null }>,
  strippedAssistantDraft: string,
  interviewMoment: number,
): boolean {
  if (interviewMoment !== 1) return false;

  const repairContext = findLastUserWithPriorScenarioARepairContext(messages);
  let lastUserContent = repairContext.lastUserContent;
  let priorRepairAssistantContent = repairContext.priorRepairAssistantContent;
  if (!priorRepairAssistantContent) {
    const direct = findLastUserWithPriorAssistantContent(messages);
    lastUserContent = direct.lastUserContent;
    priorRepairAssistantContent = direct.priorAssistantContent;
  }
  if (!lastUserContent || !priorRepairAssistantContent) return false;

  const contemptAnswerIncludesRepairSubstance =
    looksLikeScenarioAContemptProbeQuestion(priorRepairAssistantContent) &&
    userAnswerSatisfiesScenarioARepairPrompt(
      lastUserContent,
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );

  const priorIsRepairContext =
    looksLikeScenarioARepairQuestion(priorRepairAssistantContent) ||
    looksLikeScenarioARepairReAskQuestion(priorRepairAssistantContent) ||
    looksLikeScenarioARepairStreamFragment(priorRepairAssistantContent) ||
    isRepairRefusalProbeAssistantLine(priorRepairAssistantContent) ||
    scenarioALastAssistantIsRepairProbeOrFollowUp(priorRepairAssistantContent);

  if (!priorIsRepairContext && !contemptAnswerIncludesRepairSubstance) return false;
  if (
    !contemptAnswerIncludesRepairSubstance &&
    !userAnswerSatisfiesScenarioARepairPrompt(lastUserContent, priorRepairAssistantContent)
  ) {
    const draftPreview = strippedAssistantDraft.trim();
    if (
      draftPreview &&
      isScenarioABoundaryReflectionWithoutNextVignette(draftPreview)
    ) {
    }
    return false;
  }

  const draft = strippedAssistantDraft.trim();
  if (!draft) return true;

  /** Model paraphrased S1 wrap without Scenario B vignette — inject canonical bundle. */
  if (hasScenarioBoundaryWrapPhrase(draft) && !textContainsScenarioBVignetteBody(draft)) {
    return true;
  }

  if (isScenarioABoundaryReflectionWithoutNextVignette(draft)) {
    return true;
  }

  /** Model emitted only a brief ack or premature interview closing instead of S1→S2 handoff. */
  if (isShortAckOnlySentence(draft)) {
    return true;
  }

  if (looksLikeInterviewClosingAssistantMessage(draft)) {
    return true;
  }

  if (isScenarioAHandoffWithoutNextVignette(draft)) {
    return true;
  }

  if (isTruncatedScenarioAHandoffFragment(draft)) {
    return true;
  }

  return (
    looksLikeScenarioARepairReAskQuestion(draft) ||
    looksLikeScenarioARepairQuestion(draft) ||
    looksLikeScenarioAContemptProbeQuestion(draft) ||
    scenarioAEmmaVeryClearContemptReask(draft) ||
    isIncompleteScenarioAContemptProbeLeadSentence(draft) ||
    isScenarioANonScriptedModalParaphrase(draft)
  );
}

/**
 * After a concrete answer to Scenario B **Q3** (repair-as-James), inject canonical S2→S3 when the
 * model paraphrases a boundary wrap without the Scenario C vignette, re-asks Q3, or wrongly
 * returns to Q1.
 *
 * Do **not** advance when the user jumped ahead with a James-style plan on **Q1** (vignette).
 * Q2 (what James could have done differently) is still mandatory — coerce that prompt instead.
 */
export function shouldAdvanceScenarioBAfterSatisfiedRepair(
  messages: Array<{ role: string; content?: string | null }>,
  strippedAssistantDraft: string,
  currentScenario: number,
): boolean {
  if (currentScenario !== 2) return false;

  const jamesRepairContext = findLastUserWithPriorScenarioBJamesRepairContext(messages);
  let lastUserContent = jamesRepairContext.lastUserContent;
  let priorAssistantContent = jamesRepairContext.priorJamesRepairAssistantContent;
  if (!priorAssistantContent) {
    const direct = findLastUserWithPriorAssistantContent(messages);
    lastUserContent = direct.lastUserContent;
    priorAssistantContent = direct.priorAssistantContent;
  }
  if (!lastUserContent || !priorAssistantContent) return false;

  const repairSatisfiedAgainstPrior =
    (looksLikeScenarioBRepairAsJamesQuestion(priorAssistantContent) ||
      (looksLikeScenarioBJamesDifferentlyQuestion(priorAssistantContent) &&
        !looksLikeScenarioBRepairAsJamesQuestion(priorAssistantContent))) &&
    userAnswerSatisfiesScenarioBJamesRepairPrompt(lastUserContent, priorAssistantContent);

  if (!repairSatisfiedAgainstPrior) {
    return false;
  }

  const draft = strippedAssistantDraft.trim();
  if (!draft) return true;

  if (hasScenarioBoundaryWrapPhrase(draft) && !textContainsScenarioCVignetteBody(draft)) {
    return true;
  }

  if (isScenarioBBoundaryReflectionWithoutNextVignette(draft)) {
    return true;
  }

  if (isShortAckOnlySentence(draft)) {
    return true;
  }

  if (looksLikeInterviewClosingAssistantMessage(draft)) {
    return true;
  }

  return (
    looksLikeScenarioBRepairAsJamesQuestion(draft) ||
    looksLikeScenarioBJamesDifferentlyQuestion(draft) ||
    isIncompleteScenarioBBoundaryClosureLeadSentence(draft) ||
    priorAssistantIsScenarioBQ1OrRedirect(draft) ||
    looksLikeScenarioBQ1Question(draft) ||
    isIncompleteScenarioBQ1LeadSentence(draft) ||
    isIncompleteScenarioBPrematureRepairRedirectLeadSentence(draft) ||
    isScenarioBQ1Prompt(draft) ||
    /\bi'?ll get to that\b/i.test(draft)
  );
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
