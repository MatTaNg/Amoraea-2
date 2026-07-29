import { looksLikeQuestionContentConfusion } from '@features/aria/confusionRepeatOfferState';

/** @deprecated Resume welcome no longer offers scenario repeat — kept for legacy transcript detection only. */
export const RESUME_WELCOME_BACK_REPEAT_SCENARIO_OFFER_TAIL = '';

export type ResumeWelcomeBackRepeatIntent =
  | 'repeat_scenario'
  | 'repeat_question'
  | 'continue'
  | 'ambiguous';

/** True when the user explicitly wants the current question only (welcome-back response). */
export function looksLikeResumeWelcomeQuestionOnlyRepeatRequest(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return false;
  if (
    /\brepeat (the |this |that )?questions?\b/.test(t) &&
    !/\b(scenario|situation|story|vignette)\b/.test(t)
  ) {
    return true;
  }
  if (
    /\bwhat (was|is) (the |this |that )?questions?\b/.test(t) &&
    !/\b(scenario|situation|story|vignette)\b/.test(t)
  ) {
    return true;
  }
  if (/\b(just|only) (the |repeat )?questions?\b/.test(t)) return true;
  if (/\brepeat what you asked\b/.test(t)) return true;
  if (/\b(say|read) (the |that )?questions? again\b/.test(t)) return true;
  return false;
}

/**
 * Classify the user's first turn after resume welcome-back.
 * Default affirmative / vague repeat cues → full scenario + question; explicit question phrasing → question only.
 */
export function classifyResumeWelcomeBackRepeatIntent(text: string): ResumeWelcomeBackRepeatIntent {
  const t = (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return 'ambiguous';

  if (looksLikeResumeWelcomeQuestionOnlyRepeatRequest(text)) {
    return 'repeat_question';
  }

  const continueHints =
    /\b(no|nope|nah|continue|skip|i'?m good|(i am|we'?re) good|ready to continue|go on|let'?s (go|continue)|keep going|don'?t\s+need|don'?t\s+want|don'?t\s+repeat|no thanks|i remember|we can continue|move on|next)\b/;
  const bareContinue = /^(no|nope|nah|continue|ready|i'?m ready|let'?s continue)[\s.,!?]*$/;
  if (bareContinue.test(t) || continueHints.test(t)) {
    return 'continue';
  }

  const repeatScenarioHints =
    /^(yes|yeah|yep|sure|ok|okay)[\s.,!?]*$/.test(t) ||
    /\b(repeat|again|say it again|repeat it|one more time|tell me again|recap|repeat that|what was the scenario|run through it again|replay|hear it again|hear that again)\b/.test(
      t,
    ) ||
    /\b(repeat|replay) (the |this |that )?(scenario|situation|story)\b/.test(t);
  if (repeatScenarioHints || looksLikeQuestionContentConfusion(text)) {
    return 'repeat_scenario';
  }

  return 'ambiguous';
}
