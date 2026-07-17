import {
  SHOW_SCENARIO_1_VIGNETTE_EXACT,
  SHOW_SCENARIO_2_VIGNETTE_EXACT,
  SHOW_SCENARIO_3_VIGNETTE_EXACT,
} from '@features/aria/interviewShowScenarioExactCopy';

export type InterviewRepeatRequestTarget = 'question' | 'scenario';

/** Brief acknowledgment before replaying a question or scenario on user request. */
export const REPEAT_REQUEST_ACK = 'Sure.';

/**
 * Explicit ask to re-hear the situation vignette (story), not only the current probe question.
 * "Repeat the question" stays question-only; "repeat what you/she said" re-reads the scenario.
 */
export function looksLikeScenarioRepeatRequest(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return false;

  // Question-only phrasing wins when the user names the question without naming the scenario.
  if (
    /\brepeat (the |this |that )?questions?\b/.test(t) &&
    !/\b(scenario|situation|story|vignette)\b/.test(t)
  ) {
    return false;
  }
  if (
    /\bwhat (was|is) (the |this |that )?questions?\b/.test(t) &&
    !/\b(scenario|situation|story|vignette)\b/.test(t)
  ) {
    return false;
  }

  // Generic "repeat what you/she said" → full situation (vignette + question) on Moments 1–3.
  if (
    /\brepeat what (you|she|the interviewer)\b/.test(t) ||
    /\bwhat did (you|she) say\b/.test(t) ||
    /\b(can you |could you |please )?(repeat|say) what (you|she) (said|just said)\b/.test(t)
  ) {
    return true;
  }

  return (
    /\brepeat (the |this |that )?(scenario|situation|story|vignette)\b/.test(t) ||
    /\b(can you |could you |please )?(repeat|replay|reread|re-read) (the |this |that )?(scenario|situation|story|vignette)\b/.test(
      t,
    ) ||
    /\b(say|read|tell|play|go over|run through) (the |this |that )?(scenario|situation|story) again\b/.test(
      t,
    ) ||
    /\bhear (the |this |that )?(scenario|situation|story) again\b/.test(t) ||
    /\brun through (it|the scenario|the situation) again\b/.test(t) ||
    /\bwhat (was|is) (the |this |that )?(scenario|situation)\b/.test(t) ||
    /\b(scenario|situation) again\b/.test(t)
  );
}

export function resolveInterviewRepeatRequestTarget(text: string): InterviewRepeatRequestTarget {
  return looksLikeScenarioRepeatRequest(text) ? 'scenario' : 'question';
}

export function getScenarioVignetteBodyForRepeat(scenario: 1 | 2 | 3): string {
  if (scenario === 1) return SHOW_SCENARIO_1_VIGNETTE_EXACT;
  if (scenario === 2) return SHOW_SCENARIO_2_VIGNETTE_EXACT;
  return SHOW_SCENARIO_3_VIGNETTE_EXACT;
}

function questionAlreadyIncludesVignette(question: string, vignette: string): boolean {
  const q = question.trim();
  const v = vignette.trim();
  if (!q || !v) return false;
  const vignetteLead = v.slice(0, Math.min(48, v.length));
  if (vignetteLead && q.includes(vignetteLead)) return true;
  if (q.length < 120) return false;
  return (
    /emma and ryan/i.test(q) ||
    /sarah has been job hunting/i.test(q) ||
    /sophie and daniel/i.test(q)
  );
}

/**
 * Speak the full situation vignette, then the current scripted question.
 * If the question text already embeds the vignette, return it as-is.
 */
export function buildScenarioPlusQuestionRepeatTts(
  vignette: string,
  question: string,
): string {
  const v = (vignette ?? '').trim();
  const q = (question ?? '').trim();
  if (!v) return q;
  if (!q) return v;
  if (questionAlreadyIncludesVignette(q, v)) return q;
  return `${v}\n\n${q}`;
}

/** True when scenario-repeat should attach the vignette (Situations 1–3 only). */
export function shouldAttachScenarioVignetteForRepeat(args: {
  target: InterviewRepeatRequestTarget;
  interviewMoment: number;
  scenarioNumber: number;
}): boolean {
  if (args.target !== 'scenario') return false;
  if (args.interviewMoment < 1 || args.interviewMoment > 3) return false;
  return args.scenarioNumber === 1 || args.scenarioNumber === 2 || args.scenarioNumber === 3;
}

/**
 * Prefixed spoken acknowledgment for explicit repeat requests.
 * Does not alter transcript question pointers — use only for TTS.
 */
export function withRepeatRequestAcknowledgment(spokenBody: string): string {
  const body = (spokenBody ?? '').trim();
  if (!body) return REPEAT_REQUEST_ACK;
  if (/^sure[.!]?\b/i.test(body)) return body;
  if (body.includes('\n')) return `${REPEAT_REQUEST_ACK}\n\n${body}`;
  return `${REPEAT_REQUEST_ACK} ${body}`;
}

/**
 * Peel a leading "Sure." / "Sure!" repeat ack so TTS coercions can rewrite the body,
 * then restore via {@link withRepeatRequestAcknowledgment}.
 */
export function peelRepeatRequestAcknowledgmentPrefix(text: string): {
  prefix: string | null;
  body: string;
} {
  const raw = (text ?? '').trim();
  if (!raw) return { prefix: null, body: raw };
  // Only the brief standalone ack ("Sure." / "Sure!") — not "Sure, Emma was…" reflections.
  const m = raw.match(/^sure[.!]\s*(?:\n\n+|\s+)/i);
  if (!m) return { prefix: null, body: raw };
  const body = raw.slice(m[0].length).trim();
  if (!body) return { prefix: null, body: raw };
  return { prefix: REPEAT_REQUEST_ACK, body };
}

/**
 * Drop leading brief acknowledgments ("Got it.", "Makes sense.", "Thanks for sharing that.", …)
 * so repeat TTS re-asks only the scenario/interview question.
 */
const REPEAT_LEADING_BRIEF_ACK_RE =
  /^(?:sure|got it|makes sense|that makes a lot of sense|i'?m with you|well done|okay|ok|alright|fair|noted|mm|yeah|i hear you|i see what you mean|yeah,?\s+i can see that|that'?s a real read(?: on it)?|good read|great read|nice work|that makes sense|you(?:'re| are) seeing that|thanks for sharing that|thank you for sharing(?: that)?)\b(?:\s*[—–\-:,.!…]+\s*|\s+)/i;

export function stripBriefInterviewAcknowledgmentPrefixForRepeat(text: string): string {
  const raw = (text ?? '').trim();
  if (!raw) return raw;
  let t = raw.replace(/\s+/g, ' ').trim();
  let guard = 0;
  while (guard++ < 6) {
    const next = t.replace(REPEAT_LEADING_BRIEF_ACK_RE, '').trim();
    if (next === t) break;
    // Keep the original when stripping would leave nothing substantive.
    if (!next || next.length < 12) break;
    t = next;
  }
  return t;
}
