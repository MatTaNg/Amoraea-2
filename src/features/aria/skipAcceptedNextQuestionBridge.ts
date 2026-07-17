/** Spoken bridge before the next scripted question after skip confirmation. */
export const SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE =
  "Okay, we've skipped this one. The next question is";

/** Spoken bridge when skip completes the last question in the scenario. */
export const SKIP_ACCEPTED_SCENARIO_COMPLETE_BRIDGE = "Okay, we've skipped this one";

/** Matches current + legacy skip-accept lead-ins (including "we can skip this one"). */
const SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE_PREFIX_RE =
  /^okay[,.]?\s+we(?:'ve| have| can) skip(?:ped)? this one[,.]?\s+the next question is\s+/i;

/** True when assistant TTS was the client skip-accept bridge (optionally followed by the next question). */
export function looksLikeSkipAcceptedNextQuestionBridgeLine(content: string): boolean {
  const t = (content ?? '').replace(/\s+/g, ' ').trim();
  return SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE_PREFIX_RE.test(t);
}

/**
 * Strip the skip-accept lead-in so "repeat what you said" re-reads only the scripted question,
 * not the skip acknowledgment.
 */
export function stripSkipAcceptedNextQuestionBridge(content: string): string {
  const raw = (content ?? '').trim();
  if (!raw) return raw;
  // Only collapse whitespace when matching the bridge — otherwise preserve original spacing
  // for verbatim scenario-prompt replay.
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  if (!SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE_PREFIX_RE.test(collapsed)) return raw;
  return collapsed.replace(SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE_PREFIX_RE, '').trim();
}

/**
 * Run a TTS coerce on the scripted question only, then re-attach the skip-accept acknowledgment.
 * Prevents James/Q1/repair coerces from wiping "Okay, we've skipped this one…".
 */
export function withSkipAcceptedNextQuestionBridgePreserved(
  text: string,
  mapInner: (inner: string) => string,
): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!looksLikeSkipAcceptedNextQuestionBridgeLine(t)) {
    return mapInner(t);
  }
  const inner = stripSkipAcceptedNextQuestionBridge(t);
  const mapped = mapInner(inner);
  if (!mapped.trim()) return mapped;
  if (looksLikeSkipAcceptedNextQuestionBridgeLine(mapped)) return mapped;
  return `${SKIP_ACCEPTED_NEXT_QUESTION_BRIDGE} ${mapped}`.replace(/\s+/g, ' ').trim();
}
