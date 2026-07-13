import {
  isInterviewClosingReflectiveAckFragment,
  isInterviewClosingThanksFragment,
  looksLikeInterviewClosingAssistantMessage,
} from './elongatingProbe';
import { normalizeInterviewTypography } from './interviewTypography';
import { MOMENT_5_RESOLUTION_FOLLOWUP_TEXT } from '@features/aria/moment5ProbeCopy';

export function looksLikeMoment5ResolutionFollowUpPrompt(text: string | null | undefined): boolean {
  const n = (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!n) return false;
  if (n === MOMENT_5_RESOLUTION_FOLLOWUP_TEXT.toLowerCase()) return true;
  if (
    /\bhow\s+did\s+it\s+get\s+resolved\b/i.test(n) &&
    /\b(between\s+you\s+two|the\s+two\s+of\s+you|between\s+you)\b/i.test(n)
  ) {
    return true;
  }
  if (/\bwas naming it enough\b/i.test(n)) return true;
  if (
    /\b(come up with anything specific|anything specific to change|specific to change going forward)\b/i.test(
      n,
    ) &&
    /\?/.test(n)
  ) {
    return true;
  }
  if (
    /\b(when you stopped defending|once you stopped defending|after you stopped defending|actually owned it)\b/i.test(n) &&
    /\?/.test(n) &&
    /\b(come up with|change going forward|going forward|specific|naming it)\b/i.test(n)
  ) {
    return true;
  }
  if (
    /\b(once you stopped defending|when you stopped defending|after you stopped defending|actually owned it)\b/i.test(
      n,
    ) &&
    /\b(resolution feel complete|feel complete to you|something unresolved|still something unresolved)\b/i.test(
      n,
    ) &&
    /\?/.test(n)
  ) {
    return true;
  }
  if (
    /\b(feel|felt) (actually )?resolved\b/i.test(n) &&
    (/\b(between you two|between you|the two of you)\b/i.test(n) ||
      /\btension (died|die) down\b/i.test(n))
  ) {
    return true;
  }
  if (/\btension (died|die) down\b/i.test(n) && /\?/.test(n)) {
    return true;
  }
  if (
    /\bwhen (she|he|they) apologized\b/i.test(n) &&
    (/\b(feel|felt) (actually )?resolved\b/i.test(n) || /\btension (died|die) down\b/i.test(n)) &&
    /\?/.test(n)
  ) {
    return true;
  }
  return false;
}

/** True when the last resolution follow-up in the transcript has no user reply yet. */
export function transcriptAwaitingUserAnswerAfterMoment5ResolutionFollowUp(
  transcript: readonly { role?: string; content?: string | null; isWelcomeBack?: boolean }[],
): boolean {
  let lastResolutionIdx = -1;
  for (let i = transcript.length - 1; i >= 0; i--) {
    const m = transcript[i];
    if (
      m?.role === 'assistant' &&
      !m.isWelcomeBack &&
      looksLikeMoment5ResolutionFollowUpPrompt(m.content ?? '')
    ) {
      lastResolutionIdx = i;
      break;
    }
  }
  if (lastResolutionIdx < 0) return false;
  for (let j = lastResolutionIdx + 1; j < transcript.length; j++) {
    if (transcript[j]?.role === 'user' && !transcript[j]?.isWelcomeBack) return false;
  }
  return true;
}

/** Block M5 interview close while a resolution follow-up is being asked or awaiting a user reply. */
export function moment5AssistantTurnAwaitingResolutionFollowUpAnswer(args: {
  displayText?: string;
  strippedText?: string;
  streamFullText?: string;
  streamSpokenText?: string;
  messages?: readonly { role?: string; content?: string | null; isWelcomeBack?: boolean }[];
}): boolean {
  const candidates = [
    args.displayText,
    args.strippedText,
    args.streamFullText,
    args.streamSpokenText,
  ];
  if (candidates.some((t) => looksLikeMoment5ResolutionFollowUpPrompt(t ?? ''))) {
    return true;
  }
  return transcriptAwaitingUserAnswerAfterMoment5ResolutionFollowUp(args.messages ?? []);
}

function splitDraftSentences(draft: string): string[] {
  const t = (draft ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const parts: string[] = [];
  let start = 0;
  const re = /[.!?]['"]?(?=\s+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(t)) !== null) {
    const end = match.index + match[0].length;
    const segment = t.slice(start, end).trim();
    if (segment) parts.push(segment);
    start = end;
    while (start < t.length && /\s/.test(t[start]!)) start++;
  }
  const tail = t.slice(start).trim();
  if (tail) parts.push(tail);
  return parts;
}

function isInterviewClosingOnlyChunk(chunk: string): boolean {
  return (
    looksLikeInterviewClosingAssistantMessage(chunk) ||
    isInterviewClosingThanksFragment(chunk) ||
    isInterviewClosingReflectiveAckFragment(chunk)
  );
}

/**
 * Model sometimes bundles the final thank-you with a resolution follow-up in one assistant turn.
 * Keep the follow-up question and drop premature closing copy so completion gates stay open.
 */
export function stripInterviewClosingBundledWithMoment5ResolutionFollowUp(draft: string): string {
  const t0 = (draft ?? '').trim();
  if (!t0 || !looksLikeMoment5ResolutionFollowUpPrompt(t0)) return draft;
  const paragraphs = t0
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length > 1) {
    const resolutionParagraphs = paragraphs.filter((p) =>
      looksLikeMoment5ResolutionFollowUpPrompt(p),
    );
    if (resolutionParagraphs.length > 0) {
      return resolutionParagraphs.join('\n\n').trim();
    }
    const nonClosing = paragraphs.filter((p) => !isInterviewClosingOnlyChunk(p));
    return nonClosing.join('\n\n').trim() || draft;
  }
  const sentences = splitDraftSentences(t0);
  const resolutionSentences = sentences.filter((s) => looksLikeMoment5ResolutionFollowUpPrompt(s));
  if (resolutionSentences.length > 0) {
    return resolutionSentences.join(' ').trim();
  }
  const nonClosing = sentences.filter((s) => !isInterviewClosingOnlyChunk(s));
  return nonClosing.join(' ').trim() || draft;
}

export function transcriptHasMoment5ResolutionFollowUpAsked(
  transcript: readonly { role?: string; content?: string | null; isWelcomeBack?: boolean }[] | null | undefined,
): boolean {
  if (!Array.isArray(transcript)) return false;
  return transcript.some(
    (m) =>
      m.role === 'assistant' &&
      !m.isWelcomeBack &&
      looksLikeMoment5ResolutionFollowUpPrompt(m.content ?? ''),
  );
}

/** Named person-like token (not sentence-initial function words); conservative — mirrors M4 grudge anchor. */
export const MOMENT5_LIKELY_PROPER_NAME_RE =
  /\b(?!I\b|A\b|The\b|We\b|It\b|So\b|If\b|My\b|In\b|At\b|On\b|He\b|She\b|They\b|That\b|This\b|And\b|But\b)[A-Z][a-z]{2,}\b/;

/** True when assistant turn is the scripted Moment 5 specificity redirect (before accountability probe). */
export function looksLikeMoment5SpecificityRedirectPrompt(text: string | null | undefined): boolean {
  const n = normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!n) return false;
  /** Canonical client inject + common model paraphrases */
  const canonical =
    (n.includes('can you think of a specific time') || n.includes('could you think of a specific time')) &&
    (n.includes('walk me through') || n.includes('walk me thru'));
  const relaxed =
    (n.includes('specific time') && (n.includes('walk me through') || n.includes('walk me thru'))) ||
    (n.includes('specific person') && n.includes('comes to mind') && n.includes('conflict'));
  /** Philosophy-style accountability probe that embeds a specificity ask — treat as redirect phase for gating. */
  const philosophySpecificityAsk =
    (n.includes('general approach') || n.includes('makes sense as a general')) &&
    (n.includes('specific time') || n.includes('specific person')) &&
    n.includes('conflict');
  return canonical || relaxed || philosophySpecificityAsk;
}

/**
 * When the client already delivered {@link MOMENT_5_SPECIFICITY_REDIRECT_TEXT}, remove a duplicate ask that the
 * model glued into the same paragraph (post-processing only sees one `\\n\\n` block).
 */
export function stripEmbeddedMoment5SpecificityRedirectAsk(draft: string): string {
  const t0 = (draft ?? '').trim();
  if (!t0) return draft;
  /** Do not use {@link looksLikeMoment5SpecificityRedirectPrompt} on the full draft — it matches any paragraph that merely *contains* the scripted ask. */
  const normalized = normalizeInterviewTypography(t0);
  let t = normalized;
  const re = /\b(?:can|could)\s+you\s+think\s+of\s+a\s+specific\s+time\b[\s\S]{0,420}?\?/gi;
  let prev = '';
  while (prev !== t) {
    prev = t;
    t = t.replace(re, '').replace(/\s{2,}/g, ' ').trim();
  }
  return t
    .replace(/^\s*[.,;—–\-–]\s*/g, '')
    .replace(/\s+[.,;—–\-–]\s*$/g, '')
    .trim();
}

/**
 * Parallel streaming TTS flushes by sentence before {@link stripDuplicateMoment5SpecificityRedirectParagraphs}
 * runs on the full assistant turn. When the client already spoke {@link MOMENT_5_SPECIFICITY_REDIRECT_TEXT},
 * suppress model echoes of that line in a flushed chunk.
 *
 * @returns `null` when the whole flushed sentence should be skipped for TTS; otherwise the text to speak
 * (may be a suffix after stripping a glued-in redirect that shared a sentence with an accountability ask).
 */
export function stripMoment5SpecificityRedirectStreamingEcho(
  spoken: string,
  redirectAlreadyInjected: boolean,
): string | null {
  const t0 = normalizeInterviewTypography((spoken ?? '').trim());
  if (!redirectAlreadyInjected || !t0) {
    return t0;
  }
  if (!looksLikeMoment5SpecificityRedirectPrompt(t0)) {
    return t0;
  }
  const low = t0.toLowerCase();
  const accountabilityTail =
    /\bwhat do you think you did or said that contributed\b/.test(low) ||
    /\bwhat was your part\b/.test(low) ||
    /\bwhat part did you play\b/.test(low) ||
    /\byour part in how\b/.test(low) ||
    /\bcontributed to the conflict\b/.test(low);
  if (accountabilityTail) {
    const wmiThrough = low.indexOf('walk me through');
    const wmiThru = low.indexOf('walk me thru');
    const wmi = wmiThrough >= 0 ? wmiThrough : wmiThru;
    if (wmi < 0) {
      return t0;
    }
    const cut = t0.indexOf('?', wmi);
    if (cut < 0) {
      return t0;
    }
    const remainder = t0.slice(cut + 1).trim().replace(/^[.\s—–-]+/, '');
    return remainder.length > 0 ? remainder : null;
  }
  return null;
}

