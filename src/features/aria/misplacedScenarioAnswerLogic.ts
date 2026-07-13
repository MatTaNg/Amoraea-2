import { SHOW_SCENARIO_1_OPENING_EXACT } from '@features/aria/interviewShowScenarioExactCopy';
import { normalizeContentForScenarioDetection } from '@features/aria/scenarioNumberDetection';
import { isScenarioAQ1Prompt } from '@features/aria/scenarioAContemptProbeCoverage';

/** Canonical redirect when the user answers Situation 2 (Sarah/James) while still in Situation 1. */
export const SCENARIO_A_MISPLACED_S2_ANSWER_REDIRECT =
  `Makes sense. That's Situation 2 — we haven't quite gotten there yet. We're still with Emma and Ryan. ${SHOW_SCENARIO_1_OPENING_EXACT}` as const;

/** Meta redirect copy — names a situation without introducing the next vignette. */
export function isMisplacedScenarioMetaRedirectText(text: string | null | undefined): boolean {
  const lower = normalizeContentForScenarioDetection(text ?? '').toLowerCase();
  if (!lower) return false;
  const namesSituation =
    /\bthat'?s situation [123]\b/.test(lower) ||
    /\bwe'?re (?:still )?(?:in|on) situation [123]\b/.test(lower) ||
    /\bstill (?:in|on) situation [123]\b/.test(lower);
  const redirectCue =
    /\b(haven'?t|not yet|not quite|haven't gotten|we'?re still|still with)\b/.test(lower);
  return namesSituation && redirectCue;
}

/** User turn references Scenario B characters (Sarah/James) without Scenario A/C names. */
export function userAnswerReferencesScenarioBCharacters(text: string | null | undefined): boolean {
  const lower = (text ?? '').trim().toLowerCase();
  if (!lower) return false;
  if (/\b(emma|ryan|sophie|daniel)\b/.test(lower)) return false;
  return /\bjames\b/.test(lower) || /\bsarah\b/.test(lower);
}

/** User turn references Sarah/James without Emma/Ryan/Sophie/Daniel — likely answering the wrong vignette. */
export function userAnswerLooksLikeMisplacedScenarioBInScenarioA(text: string | null | undefined): boolean {
  return userAnswerReferencesScenarioBCharacters(text);
}

/** Streaming/model cutoff before the re-ask (e.g. ends with "We" after "haven't quite gotten there yet."). */
export function isIncompleteMisplacedScenarioRedirectLeadSentence(text: string | null | undefined): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  const hasMisplacedCue =
    isMisplacedScenarioMetaRedirectText(t) ||
    /\bthat'?s situation [123]\b/.test(lower) ||
    /\bhaven'?t quite gotten there\b/.test(lower);
  if (!hasMisplacedCue) return false;
  if (isScenarioAQ1Prompt(t)) return false;
  if (/\?\s*$/.test(t) && t.length >= 48) return false;
  if (!/[.!?]\s*$/.test(t)) return true;
  if (/\bwe\s*$/i.test(t)) return true;
  return false;
}

export function coerceMisplacedScenarioRedirectForActiveScenario(
  text: string,
  activeScenario: 1 | 2 | 3,
): string {
  if (activeScenario === 1 && isIncompleteMisplacedScenarioRedirectLeadSentence(text)) {
    return SCENARIO_A_MISPLACED_S2_ANSWER_REDIRECT;
  }
  return text;
}
