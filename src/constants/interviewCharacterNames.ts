/**
 * Canonical first names for the three fictional vignettes (Situations 1–3).
 * The interviewer model must use only these names; do not add alternate spellings or substitutes.
 */
export const SCENARIO_A_CHARACTERS = { partnerA: 'Emma', partnerB: 'Ryan' } as const;
export const SCENARIO_B_CHARACTERS = { partnerA: 'Sarah', partnerB: 'James' } as const;
export const SCENARIO_C_CHARACTERS = { partnerA: 'Sophie', partnerB: 'Daniel' } as const;

/** Common wrong names / hallucinations to forbid in interviewer copy (not used in vignettes). */
export const INTERVIEW_DISALLOWED_NAME_SUBSTITUTES = [
  'Reese',
  'Rhys',
  'Riley',
  'Morgan',
  'Casey',
  'Jamie',
] as const;

/** True if assistant-visible copy still contains a forbidden substitute name (whole-word). */
export function interviewAssistantTextHasDisallowedNameMarker(text: string): boolean {
  if (!text) return false;
  return INTERVIEW_DISALLOWED_NAME_SUBSTITUTES.some((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  });
}

/**
 * Last-mile fix: map common hallucinated substitutes to the canonical Scenario B male name (James).
 * Prompts alone cannot guarantee compliance; this runs on all assistant text before UI + TTS.
 */
export function sanitizeAssistantInterviewerCharacterNames(text: string): string {
  if (!text) return text;
  let out = text;
  // Possessive forms first so we do not leave a stray apostrophe-s after bare-name replacement.
  const pairs: Array<[RegExp, string]> = [
    [/\bReese's\b/gi, "James's"],
    [/\bReese\b/gi, 'James'],
    [/\bRhys's\b/gi, "James's"],
    [/\bRhys\b/gi, 'James'],
    [/\bRiley's\b/gi, "James's"],
    [/\bRiley\b/gi, 'James'],
  ];
  for (const [re, rep] of pairs) {
    out = out.replace(re, rep);
  }
  return out;
}

/**
 * Injected into INTERVIEWER_SYSTEM_FRAMEWORK so the model never drifts to legacy or invented names.
 */
export const INTERVIEW_CHARACTER_NAME_LOCK_PARAGRAPH = `
─────────────────────────────────────────
CANONICAL CHARACTER NAMES (LOCKED — NON-NEGOTIABLE)
─────────────────────────────────────────

The three vignettes use **only** these six first names, exactly as spelled in the scripted text:

• **Situation 1 (Scenario A):** ${SCENARIO_A_CHARACTERS.partnerA} and ${SCENARIO_A_CHARACTERS.partnerB} — no other names for these two roles.
• **Situation 2 (Scenario B):** ${SCENARIO_B_CHARACTERS.partnerA} and ${SCENARIO_B_CHARACTERS.partnerB} — no other names for these two roles.
• **Situation 3 (Scenario C):** ${SCENARIO_C_CHARACTERS.partnerA} and ${SCENARIO_C_CHARACTERS.partnerB} — no other names for these two roles.

In **your** spoken lines, when you refer to anyone in these situations, use **only** these names. Do **not** invent, substitute, merge, or “correct” names (e.g. do not use “Reese,” “Rhys,” “Riley,” or any name not listed above). Do not reuse names across scenarios (e.g. never call Scenario B characters by Scenario A names). **Never** replace Emma, Ryan, Sarah, James, Sophie, or Daniel with the participant’s first name (or any other name) when narrating or asking about the fictional situations — those six names are **only** the characters in the vignettes, not the participant. If the participant uses a wrong name, you may gently echo their wording in the **reflection** of their turn only when quoting them — do not introduce wrong names yourself.
`;
