import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { extractScenarioModalQuestionFromAssistantText } from '@features/aria/interviewLanguageGate';
import { SCENARIO_3_OPENING, SCENARIO_3_VIGNETTE } from '@features/aria/interviewScenarioVignetteCopy';
import {
  SHOW_SCENARIO_1_OPENING_EXACT,
  SHOW_SCENARIO_2_OPENING_EXACT,
} from '@features/aria/interviewShowScenarioExactCopy';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/probeAndScoringUtils';
import { SCENARIO_B_VIGNETTE as SCENARIO_2_VIGNETTE } from '@/constants/scenarioBVignette';

export type InterviewDetectedScenario = { label: string; text: string };

const SCENARIO_1_LABEL = 'Situation 1';
import { SHOW_SCENARIO_1_VIGNETTE_EXACT } from '@features/aria/interviewShowScenarioExactCopy';

const SCENARIO_1_VIGNETTE = SHOW_SCENARIO_1_VIGNETTE_EXACT;
export const SCENARIO_1_OPENING = SHOW_SCENARIO_1_OPENING_EXACT;
const SCENARIO_2_LABEL = 'Situation 2';
export const SCENARIO_2_OPENING = SHOW_SCENARIO_2_OPENING_EXACT;
const SCENARIO_3_LABEL = 'Situation 3';
export { SCENARIO_3_OPENING } from '@features/aria/interviewScenarioVignetteCopy';

const MOMENT_4_PERSONAL_LABEL = 'Personal reflection';
const MOMENT_4_PERSONAL_CARD = MOMENT_4_GRUDGE_QUESTION_TEXT;

export function detectActiveScenarioFromMessage(content: string): InterviewDetectedScenario | null {
  const c = content.trim();
  if (!c) return null;
  if (
    c.includes('held a grudge') ||
    (c.includes("really didn't like") && c.includes('personal')) ||
    (c.includes('three situations') && c.includes('grudge'))
  ) {
    return { label: MOMENT_4_PERSONAL_LABEL, text: MOMENT_4_PERSONAL_CARD };
  }
  if (c.includes('celebrated someone') || c.includes('really celebrated')) {
    return {
      label: 'Personal reflection',
      text: 'Think of a time you really celebrated someone in your life — what did you do to show them that?',
    };
  }
  if (c.includes('Emma and Ryan') || c.includes('Ryan takes a call from his mother')) {
    return { label: SCENARIO_1_LABEL, text: SCENARIO_1_VIGNETTE };
  }
  if (
    c.includes('Sarah has been job hunting') ||
    c.includes('Sarah has been looking for work') ||
    c.includes('Sarah was looking for work') ||
    /\bSarah has just got(?:ten)? a promotion\b/i.test(c) ||
    /\bSarah has been planning a birthday\b/i.test(c) ||
    /\bSarah has been working late\b/i.test(c) ||
    /\bSarah has been feeling underappreciated\b/i.test(c) ||
    /\bSarah (?:and James|has been|has just)\b/i.test(c)
  ) {
    return { label: SCENARIO_2_LABEL, text: SCENARIO_2_VIGNETTE };
  }
  if (
    c.includes('Sophie and Daniel') ||
    c.includes('same argument') ||
    (c.includes('Daniel') && c.includes('I need ten minutes')) ||
    (c.includes('Sophie') && (c.includes("didn't know what to say") || c.includes("didn't know how")))
  ) {
    return { label: SCENARIO_3_LABEL, text: SCENARIO_3_VIGNETTE };
  }
  if (
    c.includes('Sarah') &&
    c.includes('James') &&
    /job hunting|looking for work|gets an offer|fight starts|blindsided|together for two years|mentions in passing|never feels appreciated|salary|deadline|commute|promotion|comes home excited|working late|birthday dinner|must be nice to finally/.test(
      c,
    )
  ) {
    return { label: SCENARIO_2_LABEL, text: SCENARIO_2_VIGNETTE };
  }
  return null;
}

/** Opening line for the three fictional situations; personal segments use null until the first follow-up assistant turn. */
export function getSituationOpeningQuestion(scenario: InterviewDetectedScenario): string | null {
  switch (scenario.label) {
    case SCENARIO_1_LABEL:
      return SCENARIO_1_OPENING;
    case SCENARIO_2_LABEL:
      return SCENARIO_2_OPENING;
    case SCENARIO_3_LABEL:
      return SCENARIO_3_OPENING;
    default:
      return null;
  }
}

export function normalizeScenarioOpeningForCompare(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[‘'’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\?+$/, '')
    .toLowerCase();
}

export function looksLikeCanonicalScenarioOpeningQuestion(sentence: string): boolean {
  const normalized = normalizeScenarioOpeningForCompare(sentence);
  for (const opening of [SCENARIO_1_OPENING, SCENARIO_2_OPENING, SCENARIO_3_OPENING]) {
    if (normalizeScenarioOpeningForCompare(opening) === normalized) return true;
  }
  return false;
}

function streamTextAlreadyContainsScenarioOpeningQuestion(fullText: string): boolean {
  const extracted = extractScenarioModalQuestionFromAssistantText(stripControlTokens(fullText));
  if (!extracted) return false;
  return looksLikeCanonicalScenarioOpeningQuestion(extracted);
}

/** Hold the vignette tail when a paragraph break precedes the canonical opening question (streaming TTS). */
export function shouldDeferScenarioVignetteTailForOpeningMerge(
  spoken: string,
  bufferAfterSentence: string,
  fullStreamText: string,
): boolean {
  if (looksLikeCanonicalScenarioOpeningQuestion(spoken)) return false;
  if (streamTextAlreadyContainsScenarioOpeningQuestion(fullStreamText)) return false;
  const remainder = bufferAfterSentence;
  const remainderTrim = remainder.trim();
  if (
    remainderTrim.length > 0 &&
    !looksLikeCanonicalScenarioOpeningQuestion(remainderTrim) &&
    !/^\s*\n+\s*$/.test(remainder)
  ) {
    return false;
  }
  const t = stripControlTokens(spoken).trim();
  if (!t) return false;
  return (
    detectActiveScenarioFromMessage(t) != null ||
    /\b(emma and ryan|sarah has been|sophie and daniel)\b/i.test(t)
  );
}
