import type { ActiveScenario } from '@app/screens/UserInterviewLayout';
import {
  assistantTextLooksLikeMoment4HandoffLead,
  buildMoment4HandoffForInterview,
} from '@features/aria/interviewTransitionBundles';
import { textContainsScenarioCVignetteBody } from '@features/aria/emotionScenarioTransitionInference';
import { normalizeInterviewTypography } from '@features/aria/interviewTypography';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/moment5ProbeLogic';
import { looksLikeMoment5ConflictValidityClarificationPrompt } from '@features/aria/probeAndScoringUtils';

export const MOMENT_4_PERSONAL_LABEL = 'Personal reflection';
export const MOMENT_4_PERSONAL_CARD = MOMENT_4_GRUDGE_QUESTION_TEXT;
/** Show scenario modal: single main block (no Moment 4 grudge vignette); bottom prompt is null so the question is not duplicated. */
export const MOMENT_5_REFERENCE_SCENARIO: ActiveScenario = {
  label: MOMENT_4_PERSONAL_LABEL,
  text: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT.trim(),
};
/** After scenario 3 closing, the app injects this handoff so the model continues Moment 4 in the same thread. */
export const MOMENT_4_HANDOFF = buildMoment4HandoffForInterview('', MOMENT_4_PERSONAL_CARD);

/**
 * True when the model skipped to the grudge / Moment-4 opening while Scenario C (or S2→S3) is still in progress.
 * Showing that text fires applyInterviewProgressFromAssistantText → moment 4 + personal handoff flags prematurely.
 */
export function assistantTextIsPrematureMoment4HandoffDuringScenarioC(text: string): boolean {
  if (textContainsScenarioCVignetteBody(text)) return false;
  const t = normalizeInterviewTypography(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  /** Valid S3→M4 boundary closure — Scenario C is complete, not a premature skip. */
  if (t.includes('end of the three described situations')) return false;
  if (t.includes('end of the three situations') && t.includes('two questions left')) return false;
  const grudgeOrDislike =
    t.includes('held a grudge') ||
    t.includes('really hard time with') ||
    (t.includes("really didn't like") && (t.includes('someone') || t.includes('your life')));
  const scenarioWrapOrPivot =
    t.includes('three situations') ||
    t.includes("we've finished") ||
    t.includes('finished the three');
  const personalPivot =
    t.includes('more personal') ||
    t.includes('last two questions') ||
    t.includes('two questions are more personal') ||
    t.includes('questions are more about you') ||
    t.includes('two questions left');
  if (grudgeOrDislike && (scenarioWrapOrPivot || personalPivot)) return true;
  if (
    assistantTextLooksLikeMoment4HandoffLead(text) &&
    (scenarioWrapOrPivot || personalPivot) &&
    !/\b(?:here'?s the third situation|on to the third situation)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

export const RESUME_WELCOME_BACK_MESSAGE =
  "Welcome back! Lets continue where we left off. If you'd like me to repeat what I said, let me know.";

/** True when the next user turn is the first user reply after a Moment 5 conflict-validity clarification (handles resume welcome inserted after clarification). */
export function isFirstUserTurnAfterMoment5ConflictValidityClarification(
  messages: Array<{ role: string; content?: string; isScoreCard?: boolean; isWelcomeBack?: boolean }>,
): boolean {
  let lastClarificationIdx = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    if ((m as { isWelcomeBack?: boolean }).isWelcomeBack) continue;
    if ((m as { isScoreCard?: boolean }).isScoreCard) continue;
    if (looksLikeMoment5ConflictValidityClarificationPrompt((m.content ?? '').trim())) {
      lastClarificationIdx = i;
      break;
    }
  }
  if (lastClarificationIdx < 0) return false;
  const after = messages.slice(lastClarificationIdx + 1);
  const usersAfter = after.filter((m) => m.role === 'user' && !(m as { isWelcomeBack?: boolean }).isWelcomeBack);
  return usersAfter.length === 0;
}
