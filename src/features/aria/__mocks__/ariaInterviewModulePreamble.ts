/** Jest stub — avoids loading the full screen preamble bundle (duplicate export under Babel). */
export const MOMENT_4_PERSONAL_CARD =
  'Have you ever held a grudge against someone, or had someone in your life you really did not like?';
export const SCENARIO_2_TEXT = 'Scenario two vignette body.\n\nScenario two opening.';
export const SCENARIO_3_TEXT =
  'James and Emma had been together for two years when things started to fray.\n\nScenario three opening.';
export { S1_CONTEMPT_FIX_VERSION } from '@features/aria/interviewAdminConfig';
export const SCENARIO_C_MISPLACED_Q1_REDIRECT =
  "I was asking specifically about what you make of Daniel saying 'I didn't know what to say', what does that line tell you about where he's at?";
export const SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE =
  'We can skip this question but it may affect your score, do you still want to skip it?';
export const INABILITY_INVITATION_ROTATING_LINES = [
  "No pressure — just say whatever comes to mind, even if it's just a few words.",
  "There's no right answer here — just whatever feels true to you.",
] as const;

export function detectConstructs(): number[] {
  return [];
}

export function hasCommitmentThresholdSignal(text: string): boolean {
  const t = text.toLowerCase();
  const hasIrrecoverableCriteria =
    /\b(irrecover|unworkable|incompatib|deal[- ]?breaker|not working|can't work|cannot work|too far gone|no longer safe)\b/.test(t);
  const hasLeaveDecisionProcess =
    /\b(at what point|point i would leave|point i'd leave|when i would leave|when i'd leave|before leaving|before i leave|after trying|after we try|after repeated|repeated pattern|if it keeps happening)\b/.test(t);
  const hasBoundaryAndOutcome =
    /\b(boundar(?:y|ies).*(leave|end|walk away)|walk away|leave|end it|end the relationship|call it)\b/.test(t);
  const repairOnlyLanguage =
    /\b(communicat(e|ion) better|set boundaries|check in|come back and talk|listen better|both need to change|shared system|repair)\b/.test(t);
  return (
    (hasIrrecoverableCriteria || hasLeaveDecisionProcess || hasBoundaryAndOutcome) &&
    !(repairOnlyLanguage && !hasIrrecoverableCriteria && !hasLeaveDecisionProcess)
  );
}

export function isFirstUserTurnAfterMoment5ConflictValidityClarification(
  _messages: Array<{ role: string; content?: string }>,
): boolean {
  return false;
}
