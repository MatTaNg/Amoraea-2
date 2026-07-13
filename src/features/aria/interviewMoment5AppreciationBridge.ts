export function isAppreciationPromptText(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes('think of a time you really celebrated someone') || (t.includes('really celebrated') && t.includes('your life'));
}

/** Start index of the scripted appreciation prompt body (for bridge detection / stripping). */
export function appreciationPromptBodyStartIndex(text: string): number {
  const lower = text.toLowerCase();
  const primary = lower.indexOf('think of a time you really celebrated someone');
  if (primary >= 0) return primary;
  const rel = lower.indexOf('really celebrated');
  if (rel >= 0 && lower.includes('your life')) return rel;
  return -1;
}

/** Remove recurring meta tails ("different side of you…", "I want to ask about…") while keeping a good threshold echo. */
export function stripTrailingMoment5ProceduralBridgeClauses(head: string): string {
  let h = head.trimEnd();
  const tailPatterns: RegExp[] = [
    /\s*[—–-]\s*and\s+something a little different on a warmer note\.?\s*$/i,
    /\s*[—–-]\s*something a little different on a warmer note\.?\s*$/i,
    /\s*,\s*and\s+something a little different on a warmer note\.?\s*$/i,
    /\s+something a little different on a warmer note\.?\s*$/i,
    /\s*[—–-]\s*i want to ask about a different side of you with people you care about\.?\s*$/i,
    /\s*[—–-]\s*i'?d like to ask about a different side of you[^.?!]*[.?!]?\s*$/i,
    /\s*i want to ask about a different side of you[^.?!]*[.?!]?\s*$/i,
    /\s*i want to ask about how you show up for someone you care about[^.?!]*[.?!]?\s*$/i,
    /\s*let me take this in a slightly different direction[^.?!]*[.?!]?\s*$/i,
    /\s*i'?d like to shift to something a bit warmer[^.?!]*[.?!]?\s*$/i,
  ];
  let prev = '';
  while (prev !== h) {
    prev = h;
    for (const re of tailPatterns) {
      h = h.replace(re, '').trimEnd();
    }
  }
  return h.replace(/\s[—–-]\s*$/u, '').trim();
}

/** When the model uses a banned procedural bridge, drop it so we can prepend a natural default. */
export function stripProceduralMoment5BridgeFromAppreciationTurn(text: string): string {
  if (!isAppreciationPromptText(text)) return text;
  const idx = appreciationPromptBodyStartIndex(text);
  if (idx <= 0) return text;
  let head = text.slice(0, idx).trim();
  head = stripTrailingMoment5ProceduralBridgeClauses(head);
  const tail = text.slice(idx).trimStart();
  let merged = head ? `${head}\n\n${tail}` : tail;
  if (!isAppreciationPromptText(merged)) merged = tail;

  const idx2 = appreciationPromptBodyStartIndex(merged);
  if (idx2 <= 0) return merged;
  const head2 = merged.slice(0, idx2).trim();
  const headLower = head2.toLowerCase();
  const seemsProcedural =
    /there'?s one more i(?:'?d| would) like to ask/.test(headLower) ||
    /\bwe only have one more\b/.test(headLower) ||
    /^\s*last one\b/.test(headLower) ||
    (head2.length < 140 && /\bstill personal\b/.test(headLower) && /\b(one more|last)\b/.test(headLower)) ||
    (head2.length < 220 &&
      /\bi want to ask about\b/.test(headLower) &&
      /\b(different side|another question|one more)\b/.test(headLower)) ||
    /\bdifferent side of you with people you care about\b/.test(headLower);
  if (!seemsProcedural) return merged;
  return merged.slice(idx2).trimStart();
}

export function looksLikeMoment5Probe(text: string): boolean {
  const t = text.toLowerCase().trim();
  return (
    t.includes('particular moment that comes to mind') ||
    t.includes('what made you decide on that specifically') ||
    (/\bwhat made you decide to\b/.test(t) && t.endsWith('?')) ||
    t.includes('what do you remember about how they responded')
  );
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
  return (hasIrrecoverableCriteria || hasLeaveDecisionProcess || hasBoundaryAndOutcome) && !(repairOnlyLanguage && !hasIrrecoverableCriteria && !hasLeaveDecisionProcess);
}

/**
 * Model sometimes repeats the Scenario A contempt probe (or a close paraphrase) after it is already in the transcript.
 * Drop matching paragraphs only when prior transcript already contained that probe (welcome-back excluded upstream).
 */


/** Max chars to keep as M4→M5 pivot before the scripted appreciation body (1–2 sentence boundary reflection + transition). */
export const MOMENT5_ALLOWED_BRIDGE_MAX_CHARS = 420;

/** True when the appreciation scripted body begins the assistant text (no leading bridge yet). */
export function appreciationBodyStartsAssistantTurn(text: string): boolean {
  return isAppreciationPromptText(text) && appreciationPromptBodyStartIndex(text) === 0;
}

/** Drop mirror or overlong lead-ins; keep one short approved-style bridge before the appreciation ask. */
export function stripReflectiveLeadBeforeMoment5AppreciationPrompt(text: string): string {
  if (!isAppreciationPromptText(text)) return text;
  const idx = appreciationPromptBodyStartIndex(text);
  if (idx <= 0) return text;
  const head = text.slice(0, idx).trim();
  const tail = text.slice(idx).trimStart();
  if (!head) return tail;
  if (head.length > MOMENT5_ALLOWED_BRIDGE_MAX_CHARS) return tail;
  const headLower = head.toLowerCase();
  const mirrorOrProcessBanned =
    /\bi hear you\b/.test(headLower) ||
    /\bholding two things\b/.test(headLower) ||
    /\bhelp me (see|understand|square)\b/.test(headLower) ||
    /\bwhat stays with me\b/.test(headLower) ||
    /\btaking that in\b/.test(headLower) ||
    /\bon a lighter note\b/.test(headLower);
  if (mirrorOrProcessBanned) return tail;
  return `${head}\n\n${tail}`;
}
