/**
 * Client-injected scenario → scenario and Moment 4 handoff copy for the live interview.
 * Transition leads omit the participant's first name; the model uses it in boundary **reflection** only.
 */

export const SCENARIO_1_TO_2_TRANSITION_FALLBACK =
  "Great work — that's the end of that scenario. Here's the next situation.";

export const SCENARIO_2_TO_3_TRANSITION_FALLBACK =
  "Great work — that's the end of this one, too. Here's the third situation — after this we'll move to something more personal.";

export const MOMENT_4_HANDOFF_NO_NAME_LEAD =
  'Good work — you just finished the three situations. There are only two questions left. These questions are more about you. Here\'s the first one.';

export function buildScenario1To2BundleForInterview(_firstName: string, scenario2Text: string): string {
  return `${SCENARIO_1_TO_2_TRANSITION_FALLBACK}\n\n${scenario2Text}`.trim();
}

/**
 * Situation 1 → 2: model sometimes emits only Scenario B Q1 (vignette stripped). Repair with the canonical bundle.
 */
export function ensureScenario2BundleWhenOpeningWithoutVignette(
  text: string,
  interviewMoment: number,
  firstName: string,
  scenario2Text: string
): string {
  if (interviewMoment !== 1) return text;
  const raw = text.trim();
  if (!raw || /sarah has been job hunting/i.test(raw)) return text;
  if (!/what do you think is going on here\??\s*$/i.test(raw)) return text;
  return buildScenario1To2BundleForInterview(firstName, scenario2Text).trim();
}

export function buildScenario2To3TransitionBody(_firstName: string, scenario3Text: string): string {
  return `${SCENARIO_2_TO_3_TRANSITION_FALLBACK}\n\n${scenario3Text}`.trim();
}

export function buildMoment4HandoffForInterview(_firstName: string, moment4PersonalCard: string): string {
  return `${MOMENT_4_HANDOFF_NO_NAME_LEAD}\n\n${moment4PersonalCard}`;
}
