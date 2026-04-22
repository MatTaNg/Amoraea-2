/**
 * Elongating probe lines and client/model contract for the relationship interview.
 * Single source of truth for approved verbatim probes (see INTERVIEWER_SYSTEM_FRAMEWORK).
 */
export const APPROVED_ELONGATING_PROBE_LINES = [
  'Can you say more about that?',
  'What makes you see it that way?',
  'What do you mean by that?',
] as const;

export function normalizeElongatingProbeText(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

/** True iff displayed assistant text is exactly one approved elongating line (no extra words or punctuation beyond normalized whitespace). */
export function isApprovedElongatingProbeOnly(displayText: string): boolean {
  const n = normalizeElongatingProbeText(displayText);
  return (APPROVED_ELONGATING_PROBE_LINES as readonly string[]).some((line) => line === n);
}

/** Appended to the interviewer system prompt so the model cannot chain elongating probes after the client detected one. */
export function buildElongatingProbeStateSuffix(elongatingProbeFired: boolean): string {
  return `
─────────────────────────────────────────
ELONGATING PROBE STATE (CLIENT-ENFORCED)
─────────────────────────────────────────
**elongating_probe_fired:** ${elongatingProbeFired ? 'true' : 'false'}

When **elongating_probe_fired** is **true** for this user turn: you MUST **not** deliver any elongating probe — accept the user's last message and proceed with normal interview rules (including UNIVERSAL CHECK-BEFORE-ASKING and the scripted sequence). **Never** invent a substitute elongation line.

When **elongating_probe_fired** is **false**: the ELONGATING PROBE — WORD COUNT GATE above applies as written.

The approved elongating probe list is **exhaustive**. If you cannot choose **exactly one** verbatim line from that list, **do not** elongate; proceed without probing. **Never** output phrases such as "Would it help to hear the scenario again?" or any other novel elongation.
`;
}
