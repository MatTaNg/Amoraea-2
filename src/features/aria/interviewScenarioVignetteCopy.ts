import {
  SHOW_SCENARIO_1_FULL_EXACT,
  SHOW_SCENARIO_1_VIGNETTE_EXACT,
  SHOW_SCENARIO_2_OPENING_EXACT,
  SHOW_SCENARIO_2_VIGNETTE_EXACT,
  SHOW_SCENARIO_3_OPENING_EXACT,
  SHOW_SCENARIO_3_VIGNETTE_EXACT,
  SHOW_SCENARIO_1_OPENING_EXACT,
} from '@features/aria/interviewShowScenarioExactCopy';
import { SCENARIO_B_VIGNETTE as SCENARIO_2_VIGNETTE } from '@/constants/scenarioBVignette';

// Scenario display text for regular-user immersive layout (matches Show Scenario modal).
export const SCENARIO_1_OPENING = SHOW_SCENARIO_1_OPENING_EXACT;
export const SCENARIO_1_LABEL = 'Situation 1';
/** Vignette only — opening question lives in reference-card “current question” state, not duplicated here. */
export const SCENARIO_1_VIGNETTE = SHOW_SCENARIO_1_VIGNETTE_EXACT;
export const SCENARIO_2_LABEL = 'Situation 2';
export const SCENARIO_2_OPENING = SHOW_SCENARIO_2_OPENING_EXACT;
export const SCENARIO_2_TEXT = `${SCENARIO_2_VIGNETTE}\n\n${SCENARIO_2_OPENING}`;

export const SCENARIO_3_LABEL = 'Situation 3';
export const SCENARIO_3_VIGNETTE = SHOW_SCENARIO_3_VIGNETTE_EXACT;
export const SCENARIO_3_OPENING = SHOW_SCENARIO_3_OPENING_EXACT;
export const SCENARIO_3_TEXT = `${SCENARIO_3_VIGNETTE}\n\n${SCENARIO_3_OPENING}`;

/** Spoken lead-in before replaying a scenario vignette + question after mid-delivery resume. */
export const SCENARIO_RESUME_REPLAY_TRANSITION = "Here's what I said." as const;

/** Opening question only — for resume when vignette was already heard. */
export function getScenarioOpeningQuestionOnlyForResume(scenario: 1 | 2 | 3): string {
  if (scenario === 1) return SCENARIO_1_OPENING;
  if (scenario === 2) return SCENARIO_2_OPENING;
  return SCENARIO_3_OPENING;
}

/** Full scripted first assistant block for a scenario (vignette + opening question). */
export function getScenarioResumeIntroAssistantBody(scenario: 1 | 2 | 3): string {
  if (scenario === 1) return SHOW_SCENARIO_1_FULL_EXACT;
  if (scenario === 2) return SCENARIO_2_TEXT;
  return SCENARIO_3_TEXT;
}

/** Welcome-back replay after app close mid-delivery: transition + full scenario script. */
export function buildScenarioResumeReplaySpokenBody(scenario: 1 | 2 | 3): string {
  return `${SCENARIO_RESUME_REPLAY_TRANSITION}\n\n${getScenarioResumeIntroAssistantBody(scenario)}`;
}
