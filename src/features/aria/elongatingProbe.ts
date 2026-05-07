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

function wordCountSpoken(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/**
 * Heuristic: user already offered several readings, examples, or enumerated options —
 * elongating probes must not fire in that case even if word count is borderline.
 */
export function userTurnHasMultipleDistinctIdeasOrHypotheses(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  let signal = 0;
  const bump = (re: RegExp) => {
    if (re.test(lower)) signal += 1;
  };
  bump(/\bfirst (option|hypothesis|possibility|reading|scenario|thing)\b/);
  bump(/\bsecond (option|hypothesis|possibility|reading|scenario|thing)\b/);
  bump(/\bthird (option|hypothesis|possibility|reading|scenario|thing)\b/);
  bump(/\bone (possibility|hypothesis|reading|scenario) is\b/);
  bump(/\bthe other (is|would|could|might)\b/);
  bump(/\bthose are the (two|three|several|main)\b/);
  bump(/\b(two|three|several) (different|distinct|separate) (things|ways|readings|hypotheses|possibilities|options)\b/);
  bump(/\b(on the one hand|on the other hand)\b/);
  const numberedRuns = (t.match(/\b[1-3][\).:]\s+/g) ?? []).length;
  if (numberedRuns >= 2) signal += 2;
  return signal >= 2;
}

/**
 * Single surface-level label with essentially no elaboration (thin vignette read).
 * Keep conservative: short clause + emotional/relational label, no "because"/"if"/second clause.
 */
export function userTurnLooksLikeSingleSurfaceLabelOnly(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  const wc = wordCountSpoken(t);
  if (wc > 18) return false;
  if (/\b(because|if |when |although|however|but | and then|i think|i feel|my sense)\b/i.test(t)) return false;
  if (/[.!?][^.!?]+[.!?]/.test(t)) return false;
  return /\b(they'?re|she'?s|he'?s|it'?s|fighting|upset|angry|tension|conflict|disconnect|distance)\b/i.test(t);
}

/**
 * When true, append `buildElongatingProbeStateSuffix(true)` for this API turn so the model must not
 * emit an elongating probe — the user's answer is already substantive (see session logs: 127-word
 * hypotheses still received "Can you say more about that?" when this was always false).
 */
export function userTurnSuppressesElongatingProbe(userText: string): boolean {
  const t = userText.trim();
  if (!t) return false;
  const wc = wordCountSpoken(t);
  if (wc >= 25) return true;
  if (userTurnHasMultipleDistinctIdeasOrHypotheses(t)) return true;
  if (wc >= 15) return true;
  if (wc < 15 && userTurnLooksLikeSingleSurfaceLabelOnly(t)) return false;
  return false;
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
