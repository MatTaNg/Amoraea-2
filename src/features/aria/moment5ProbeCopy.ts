/** Scripted Moment 5 client-injected copy and test fixtures. */

export const MOMENT5_SPECIFIC_MOMENT_NEGATIVE_EXAMPLES = [
  "I try to acknowledge when people I care about do something significant, I'll send a message or take them out for a meal.",
  'I usually get people gifts for big occasions — birthdays, promotions, graduations',
  "I think it's important to let people know you're proud of them",
] as const;

/** Named fixtures — must count as a specific occasion / anchored narrative. */
export const MOMENT5_SPECIFIC_MOMENT_POSITIVE_EXAMPLES = [
  'I threw my friend a birthday party when she turned 30',
  'I flew in as a surprise when she defended her dissertation',
  'I wrote my partner a letter after they got the promotion',
] as const;

export const MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT =
  'Think of a time when you had a conflict with someone important to you. What happened, and how did things get resolved between you two?';

export const MOMENT_5_ACCOUNTABILITY_PROBE_TEXT =
  'What do you think you did or said that contributed to the conflict?';

/** Client-only — when the example may not contain a genuine conflict before accountability scoring. */
export const MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT =
  'Was there a point where it actually got tense between you two, or did it resolve pretty smoothly?';

/**
 * Moment 5 scripted accountability follow-up with a brief warmth beat before the question.
 * Used whenever the client injects this probe (not only bereavement): first-person conflict narratives
 * are inherently vulnerable; leading with appreciation avoids sounding cold before accountability.
 */
export const MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT =
  'I appreciate you getting vulnerable with me. What do you think you did or said that contributed to the conflict?';

export const MOMENT_5_SPECIFICITY_REDIRECT_TEXT =
  'Can you think of a specific time — maybe with a partner, friend, or family member — and walk me through what happened?';

/** Alternate client-only redirect (detection only). */
export const MOMENT_5_SPECIFICITY_REDIRECT_ALT_TEXT =
  'Is there a specific person or situation that comes to mind when you think about conflict?';

/** After redirect, user still abstract — offer to move on (no accountability probe). */
export const MOMENT_5_PERSISTENT_ABSTRACT_MOVE_ON_TEXT =
  "That's okay — we don't need to force a specific story. Whenever you're ready, we can wrap up.";

/** Client-injected when the first Moment 5 answer describes the conflict but not how it resolved. */
export const MOMENT_5_RESOLUTION_FOLLOWUP_TEXT = 'How did it get resolved between you two?';

export const MOMENT_5_INEXPERIENCE_FALLBACK_QUESTION =
  "What would meaningful celebration look like to you — either something you'd want to do for someone, or something that would feel meaningful to receive?";
