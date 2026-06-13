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

export type ElongatingProbePlaybackBlockReason =
  | 'user_turn_substantive'
  | 'already_fired_this_stretch'
  | null;

/**
 * Parallel streaming TTS must not speak an elongating probe when the client has already
 * fired one, the user's answer is substantive, or the model duplicated a probe line.
 */
export function elongatingProbePlaybackBlockReason(opts: {
  spokenSentence: string;
  suppressForUserTurn: boolean;
  elongatingProbeAlreadyFired: boolean;
}): ElongatingProbePlaybackBlockReason {
  if (!isApprovedElongatingProbeOnly(opts.spokenSentence)) return null;
  if (opts.suppressForUserTurn) return 'user_turn_substantive';
  if (opts.elongatingProbeAlreadyFired) return 'already_fired_this_stretch';
  return null;
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
/** Neutral ack when the model returned only a suppressed elongating line — personal moments (4–5) only. */
export function buildNeutralAckAfterSuppressedElongatingProbe(participantFirstName?: string): string {
  const name = (participantFirstName ?? '').trim();
  if (name) return `Thank you for sharing that, ${name}.`;
  return 'Thank you for sharing that.';
}

/**
 * Client closing when the model emitted only a suppressed elongating probe after a substantive Moment 5 answer.
 * Includes `[INTERVIEW_COMPLETE]` so the normal completion handler can run.
 */
export function buildMoment5ClosingFallbackAfterSuppressedElongating(
  participantFirstName: string,
): string {
  const name = participantFirstName.trim();
  const thanks = name
    ? `Thank you for being so open with me, ${name}.`
    : 'Thank you for being so open with me.';
  return `${thanks} [INTERVIEW_COMPLETE]`;
}

/**
 * Model closing lines (thanks + synthesis) without `[INTERVIEW_COMPLETE]` — used for client handoff failsafe.
 * Must not match mid-interview questions or scenario transitions.
 */
export function looksLikeInterviewClosingAssistantMessage(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || t.length < 24) return false;
  const lower = t.toLowerCase();
  if (/\[(interview_complete|scenario_complete|closing_question)/i.test(t)) return false;
  if (/\bhere'?s the (first|second|third|next) situation\b/i.test(lower)) return false;
  if (/\bon to the (second|third|next) situation\b/i.test(lower)) return false;
  if (/\bwhat if you were (ryan|james)\b/i.test(lower)) return false;
  if (/\bhow would you repair\b/i.test(lower)) return false;
  if (/\bwhat about when emma says\b/i.test(lower)) return false;
  const hasClosingThanks =
    /\bthank you for being so open with me\b/i.test(lower) ||
    /\bthanks for sticking with\b/i.test(lower) ||
    /\bgood work on sticking with\b/i.test(lower) ||
    /\bthanks for walking through\b/i.test(lower) ||
    /\bthank you for walking through\b/i.test(lower) ||
    (/\bgood work getting through\b/i.test(lower) && /\bthank you\b/i.test(lower)) ||
    (/\bit sounds like you\b/i.test(lower) &&
      /\bthank you for being so open with me\b/i.test(lower));
  if (!hasClosingThanks) return false;
  /** Closing should not introduce a new substantive question after the thanks line. */
  const afterThanksIdx = lower.search(
    /\bthank you for being so open|\bthanks for sticking|\bgood work on sticking|\bthank you for walking|\bgood work getting through\b/,
  );
  const tail = afterThanksIdx >= 0 ? lower.slice(afterThanksIdx) : lower;
  const questionMarksAfterThanks = (tail.match(/\?/g) ?? []).length;
  return questionMarksAfterThanks === 0;
}

export function transcriptHasInterviewClosingAssistantMessage(
  messages: ReadonlyArray<{
    role: string;
    content?: string;
    isWelcomeBack?: boolean;
    isScoreCard?: boolean;
  }>,
): boolean {
  return messages.some(
    (m) =>
      m.role === 'assistant' &&
      !m.isWelcomeBack &&
      !m.isScoreCard &&
      looksLikeInterviewClosingAssistantMessage(m.content ?? ''),
  );
}

/** Drop a duplicate closing paragraph when the transcript already contains a final thank-you. */
export function stripDuplicateInterviewClosingParagraphs(
  draft: string,
  messages: ReadonlyArray<{
    role: string;
    content?: string;
    isWelcomeBack?: boolean;
    isScoreCard?: boolean;
  }>,
): string {
  if (!draft.trim()) return draft;
  if (!transcriptHasInterviewClosingAssistantMessage(messages)) return draft;
  if (!looksLikeInterviewClosingAssistantMessage(draft)) return draft;
  return '';
}

/** Reflective closing ack before the final thank-you (streaming often splits on `.` before the tail). */
export function isInterviewClosingReflectiveAckFragment(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || t.length < 32) return false;
  const lower = t.toLowerCase();
  if (/\bthank you for being so open with me\b/i.test(lower)) return false;
  return (
    (/\bthanks for being open\b/i.test(lower) && t.length >= 32) ||
    (/\bthanks for working through\b/i.test(lower) && t.length >= 32) ||
    /\bgood work on sticking with\b/i.test(lower) ||
    /\bgood work getting through\b/i.test(lower) ||
    /\bthanks for sticking with\b/i.test(lower) ||
    /\bthanks for walking through\b/i.test(lower) ||
    (/\bwhat stands out\b/i.test(lower) &&
      /\b(stuck with|ownership|really|clearly|open with me)\b/i.test(lower)) ||
    (/\bit sounds like you\b/i.test(lower) &&
      /\b(recognized|ownership|responsibility|accountability|built up|frustration|snapping|sharper than intended)\b/i.test(
        lower,
      ))
  );
}

/** Any interview-closing thank-you fragment — broader than full-message match (streaming TTS). */
export function isInterviewClosingThanksFragment(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || t.length < 12) return false;
  const lower = t.toLowerCase();
  return (
    /\bthank you for being so open with me\b/i.test(lower) ||
    /\bthanks for sticking with\b/i.test(lower) ||
    /\bgood work on sticking with\b/i.test(lower) ||
    /\bthanks for walking through\b/i.test(lower) ||
    /\bthank you for walking through\b/i.test(lower) ||
    (/\bgood work getting through\b/i.test(lower) && /\bthank you\b/i.test(lower))
  );
}

/**
 * Streaming often flushes the reflective ack before the final "Thank you for being so open with me."
 * Hold the lead clause until the tail arrives so the closing is spoken once.
 */
export function isIncompleteInterviewClosingLeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  if (/\bthank you for being so open with me\b/i.test(lower)) return false;
  if (
    !isInterviewClosingThanksFragment(t) &&
    !isInterviewClosingReflectiveAckFragment(t) &&
    !looksLikeInterviewClosingAssistantMessage(t)
  ) {
    return false;
  }
  return (
    /\b(thanks for sticking|good work on sticking|thanks for walking through|thank you for walking through|good work getting through)\b/i.test(
      lower,
    ) ||
    isInterviewClosingReflectiveAckFragment(t) ||
    (looksLikeInterviewClosingAssistantMessage(t) && t.length >= 48)
  );
}

/** Any per-sentence closing fragment eligible for stream buffering / dedupe. */
export function isInterviewClosingStreamFragment(text: string): boolean {
  return (
    isInterviewClosingThanksFragment(text) ||
    isInterviewClosingReflectiveAckFragment(text) ||
    isIncompleteInterviewClosingLeadSentence(text) ||
    looksLikeInterviewClosingAssistantMessage(text)
  );
}

/** Collapse multiple closing thank-you sentences in one assistant turn (model duplicate thanks). */
export function stripDuplicateInterviewClosingSentencesWithinDraft(draft: string): string {
  const t = (draft ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return draft;
  const parts =
    t.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [t];
  if (parts.length <= 1) return draft;
  const closingIdx: number[] = [];
  parts.forEach((p, i) => {
    if (
      isInterviewClosingThanksFragment(p) ||
      isInterviewClosingReflectiveAckFragment(p) ||
      looksLikeInterviewClosingAssistantMessage(p)
    ) {
      closingIdx.push(i);
    }
  });
  if (closingIdx.length <= 1) return draft;
  const finalThanksIdx = parts.findIndex((p) =>
    /\bthank you for being so open with me\b/i.test(p),
  );
  const keep = new Set<number>();
  if (finalThanksIdx >= 0) {
    keep.add(finalThanksIdx);
    const leadIdx = closingIdx.find((i) => i !== finalThanksIdx && parts[i].length >= 32);
    if (leadIdx != null) keep.add(leadIdx);
  } else {
    keep.add(closingIdx[closingIdx.length - 1]!);
  }
  /** Model sometimes repeats the same reflective opener twice before the final thank-you. */
  const goodWorkGettingThroughIdx = parts
    .map((p, i) => (/\bgood work getting through\b/i.test(p) ? i : -1))
    .filter((i) => i >= 0);
  if (goodWorkGettingThroughIdx.length > 1) {
    const keepGoodWorkIdx =
      finalThanksIdx >= 0
        ? goodWorkGettingThroughIdx.filter((i) => i < finalThanksIdx).pop() ??
          goodWorkGettingThroughIdx[goodWorkGettingThroughIdx.length - 1]!
        : goodWorkGettingThroughIdx[goodWorkGettingThroughIdx.length - 1]!;
    for (const i of goodWorkGettingThroughIdx) {
      if (i !== keepGoodWorkIdx) keep.delete(i);
    }
    keep.add(keepGoodWorkIdx);
  }
  return parts
    .filter((_, i) => !closingIdx.includes(i) || keep.has(i))
    .join(' ')
    .trim();
}

/** Suppress streaming TTS echo when a closing line was already spoken in this stream or transcript. */
export function stripInterviewClosingStreamingEcho(
  spoken: string,
  closingAlreadySpoken: boolean,
): string | null {
  const t0 = (spoken ?? '').replace(/\s+/g, ' ').trim();
  if (!t0) return t0;
  if (!closingAlreadySpoken) return t0;
  if (looksLikeInterviewClosingAssistantMessage(t0)) return null;
  if (isInterviewClosingThanksFragment(t0)) return null;
  if (isInterviewClosingReflectiveAckFragment(t0)) return null;
  return t0;
}

/** True when any prior assistant turn already spoke a closing thank-you or reflective ack. */
export function transcriptHasInterviewClosingSpokenFragment(
  messages: ReadonlyArray<{
    role: string;
    content?: string;
    isWelcomeBack?: boolean;
    isScoreCard?: boolean;
  }>,
): boolean {
  return messages.some((m) => {
    if (m.role !== 'assistant' || m.isWelcomeBack || m.isScoreCard) return false;
    const c = m.content ?? '';
    return (
      isInterviewClosingThanksFragment(c) ||
      isInterviewClosingReflectiveAckFragment(c) ||
      looksLikeInterviewClosingAssistantMessage(c)
    );
  });
}

/** When strict M5 close gate fails but the model already delivered a final thank-you after M5, still hand off. */
export function isLenientInterviewCloseAfterClosingSpeech(params: {
  closingText: string;
  hasMoment5PrimaryAnchorInTranscript: boolean;
  postM5UserTurns: number;
  personalHandoffInjected: boolean;
  currentInterviewMoment: number;
  /** When false, do not bypass the Moment 5 sequence gate (resolution follow-up / accountability). */
  moment5CloseAllowed?: boolean;
}): boolean {
  if (!looksLikeInterviewClosingAssistantMessage(params.closingText)) return false;
  if (!params.hasMoment5PrimaryAnchorInTranscript) return false;
  if (params.postM5UserTurns < 1) return false;
  if (params.moment5CloseAllowed === false) return false;
  return params.personalHandoffInjected || params.currentInterviewMoment >= 4;
}

/** True when the user's Moment 5 answer addresses how the conflict was resolved (not only what happened). */
export function moment5AnswerIncludesResolutionOutcome(text: string): boolean {
  const lower = text.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!lower) return false;
  if (
    /\b(resolved|resolution|worked (it )?out|talked (it )?through|made up|reconciled|sorted (it )?out|moved past|got past|forgave|apologized|made peace|mended (things|fences)|patch(ed)? things up|we'?re (okay|ok|fine|good|cool|better) now|we (are|were) (okay|ok|fine|good|cool|better)|things (got|are) better|made amends|cleared the air|talked it through|brought it up|without interruption|facilitated|mediated|mediator|sat down (and )?(talk|listen)|heard each other out)\b/i.test(
      lower,
    )
  ) {
    return true;
  }
  /** Mutual listening / repair process — both sides engaged without only narrating the blow-up. */
  if (/\b(i|we)\s+listened\b/.test(lower) && /\b(he|she|they|we)\s+(listened|heard)\b/.test(lower)) {
    return true;
  }
  return false;
}

export function isMoment5ReadyForInterviewClose(params: {
  currentInterviewMoment: number;
  moment5QuestionDelivered: boolean;
  postM5UserTurns: number;
  accountabilityProbeFired: boolean;
  hasMoment5PrimaryAnchorInTranscript?: boolean;
  /** Combined user text after the M5 anchor — used for single-turn close when resolution is already covered. */
  moment5CombinedUserText?: string;
  /** When true, client still owes the scripted accountability probe before closing. */
  accountabilityProbeStillRequired?: boolean;
  /** When true, client still owes the resolution follow-up before closing. */
  resolutionFollowUpStillRequired?: boolean;
}): boolean {
  if (params.accountabilityProbeStillRequired) return false;
  if (params.resolutionFollowUpStillRequired) return false;
  const hasAnchor =
    params.hasMoment5PrimaryAnchorInTranscript === true || params.moment5QuestionDelivered;
  const momentOk =
    params.currentInterviewMoment >= 5 || params.hasMoment5PrimaryAnchorInTranscript === true;
  if (!momentOk || !hasAnchor) return false;

  const combined = (params.moment5CombinedUserText ?? '').trim();
  if (
    params.postM5UserTurns >= 1 &&
    moment5AnswerIncludesResolutionOutcome(combined) &&
    !params.accountabilityProbeStillRequired
  ) {
    if (params.accountabilityProbeFired) {
      return params.postM5UserTurns >= 2;
    }
    return true;
  }

  /** Require at least one follow-up exchange (resolution detail and/or accountability probe answer). */
  const minTurns = 2;
  return params.postM5UserTurns >= minTurns;
}

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
