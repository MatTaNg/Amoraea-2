function wordCount(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/** Mirrors AriaScreen `stripControlTokens` for frustration re-ask shortening only. */
function stripControlTokensMini(text: string): string {
  if (!text) return text;
  return text
    .replace(/\[INTERVIEW_COMPLETE\]/gi, '')
    .replace(/\[SCENARIO_COMPLETE:\s*\d+\]/gi, '')
    .replace(/\[CLOSING_QUESTION:\d+\]/gi, '')
    .replace(/\[STAGE_[123]_COMPLETE\]/g, '')
    .replace(/\[PROBE_TRIGGERED\]/gi, '')
    .replace(/\[SKEPTICISM_CHECK\]/gi, '')
    .trim();
}

/**
 * Rhetorical sufficiency pushback — frustration re-ask + skip path.
 * Reflection-on-prior-turn must be omitted for these (mirroring reads as repeating them).
 */
export const SUFFICIENCY_CHALLENGE_FRUSTRATION_RES: RegExp[] = [
  /\bwasn'?t that enough\b/i,
  /\b(isn'?t|ain'?t) that enough\b/i,
];

export function isSufficiencyChallengeFrustrationUtterance(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return SUFFICIENCY_CHALLENGE_FRUSTRATION_RES.some((re) => re.test(t));
}

/** Canonical skip confirmation line — client-only TTS for skip_request / inability escalation (keep in sync with AriaScreen copy). */
export const SKIP_REQUEST_CONFIRMATION_PROMPT_LINE =
  'Are you sure you want to skip this one? We can, but it may affect your score.';

export function looksLikeSkipConfirmationAssistantPrompt(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  return /may affect your score/i.test(t) && /\bskip\b/i.test(t);
}

/**
 * Softer skip confirmation after inability / "I don't know" (not an explicit skip ask).
 * Keep distinct from {@link SKIP_REQUEST_CONFIRMATION_PROMPT_LINE}.
 */
export const INABILITY_SKIP_CONFIRMATION_PROMPT_LINE =
  "We can skip this question if you'd like, but it may affect your score, do you want to skip it?";

/** Client TTS when the user declines a skip offer — not a scenario question for repeat-request replay. */
export const FRUSTRATION_SKIP_DECLINE_ENCOURAGEMENT_LINE =
  "Great, let's stay on this one then. Just try your best. You've got this.";

/**
 * One short extract from prior user words only — for skip-request reflection and already-answered ownership.
 */
export function extractSalientReflectionClause(excerpt: string): string | null {
  const t = excerpt.trim().replace(/\s+/g, ' ');
  if (!t || wordCount(t) < 8) return null;
  const sentenceCut = t.match(/^[\s\S]{1,240}?[.!?](?:\s|$)/);
  let clause = sentenceCut ? sentenceCut[0].trim() : t.split(/\s+/).slice(0, 14).join(' ');
  clause = clause.replace(/\s+/g, ' ').trim();
  if (clause.length > 110) clause = `${clause.slice(0, 107).trim()}…`;
  return clause.length >= 12 ? clause : null;
}

export function buildSkipRequestConfirmationSpeech(args: {
  priorSubstantiveNonMetaExcerpt: string | null | undefined;
}): string {
  const clause = extractSalientReflectionClause(args.priorSubstantiveNonMetaExcerpt ?? '');
  if (!clause) return SKIP_REQUEST_CONFIRMATION_PROMPT_LINE;
  return `${clause} ${SKIP_REQUEST_CONFIRMATION_PROMPT_LINE}`;
}

/** True when an earlier user message in this scenario had substantive length (same scenario before current utterance). */
export function hadPriorSubstantiveAnswerInScenarioForFrustration(
  messages: Array<{
    role: string;
    content?: string;
    scenarioNumber?: number;
    isWelcomeBack?: boolean;
  }>,
  scenarioNumber: 1 | 2 | 3,
  minWords = 10
): boolean {
  const users = messages.filter(
    (m) =>
      m.role === 'user' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      (m as { scenarioNumber?: number }).scenarioNumber === scenarioNumber
  );
  if (users.length < 2) return false;
  const priorOnly = users.slice(0, -1);
  return priorOnly.some((m) => wordCount(m.content ?? '') >= minWords);
}

/** Latest substantive user message in this scenario before the current user turn (for frustration reflection). */
export function lastSubstantivePriorUserExcerptInScenario(
  messages: Array<{
    role: string;
    content?: string;
    scenarioNumber?: number;
    isWelcomeBack?: boolean;
  }>,
  scenarioNumber: 1 | 2 | 3,
  minWords = 10
): string | null {
  const users = messages.filter(
    (m) =>
      m.role === 'user' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      (m as { scenarioNumber?: number }).scenarioNumber === scenarioNumber
  );
  if (users.length < 2) return null;
  const priorOnly = users.slice(0, -1);
  for (let i = priorOnly.length - 1; i >= 0; i--) {
    const c = (priorOnly[i].content ?? '').trim();
    if (wordCount(c) >= minWords) return c;
  }
  return null;
}

/**
 * Derive a short re-ask stem from the last interviewer prompt (client fallback when the model emits an elongating probe).
 */
export function shortenLastInterviewerQuestionForFrustrationReask(lastQuestionText: string | null | undefined): string {
  const raw = stripControlTokensMini(lastQuestionText ?? '').trim();
  if (!raw || raw.length < 6) return "what you're seeing here";
  const flat = raw.replace(/\s+/g, ' ');
  const qIdx = flat.lastIndexOf('?');
  if (qIdx !== -1) {
    const cutStart = Math.max(
      flat.lastIndexOf('.', qIdx - 1),
      flat.lastIndexOf('!', qIdx - 1),
      flat.lastIndexOf('\n', qIdx)
    );
    const slice = flat.slice(cutStart < 0 ? 0 : cutStart + 1, qIdx + 1).trim().replace(/^[.!?\s]+/, '');
    if (slice.length >= 8) return slice.length > 280 ? `${slice.slice(0, 277)}…?` : slice;
  }
  const tail = flat.slice(-220).trim();
  return tail.endsWith('?') ? tail : `${tail}?`;
}

/** Deterministic assistant line when the model violates frustration-meta rules and returns only an elongating probe. */
export function buildClientFrustrationMetaFallbackAssistantText(args: {
  lastQuestionText: string | null | undefined;
  userTranscript: string;
  hadPriorSubstantiveAnswerInMoment: boolean | undefined;
  priorSubstantiveUserExcerpt: string | null | undefined;
}): string {
  const tail =
    ' We can skip this question but it may affect your score, do you still want to skip it?';
  const sufficiency = isSufficiencyChallengeFrustrationUtterance(args.userTranscript);
  const essential = shortenLastInterviewerQuestionForFrustrationReask(args.lastQuestionText);
  const core = essential.endsWith('?') ? essential.slice(0, -1).trim() : essential.trim();

  if (sufficiency || !args.hadPriorSubstantiveAnswerInMoment) {
    return `I need to know ${core}.${tail}`;
  }
  const ex = (args.priorSubstantiveUserExcerpt ?? '').trim();
  let reflect = '';
  if (ex) {
    const clip = ex.length > 110 ? `${ex.slice(0, 107).trim()}…` : ex;
    reflect = clip.endsWith('.') ? `${clip} ` : `${clip}. `;
  }
  return `${reflect}I need to know ${core}.${tail}`;
}

/** User accepted skipping after a first frustration skip offer (short utterances only). */
export function looksLikeFrustrationSkipAcceptance(text: string): boolean {
  const raw = text.trim();
  if (!raw || raw.length > 160) return false;
  const t = raw.toLowerCase();
  /** Casual "no skip" / "no, skip" means declining to skip — not "skip". */
  if (/^no\s*(,\s*)?skip\s*$/i.test(raw) && !/\blet'?s\b/i.test(t)) return false;
  if (/\b(don'?t|do not)\s+skip\b/.test(t)) return false;
  return (
    /^skip\.?$/i.test(raw) ||
    /\bskip\b/.test(t) ||
    /\blet'?s\s+skip\b/.test(t) ||
    /\bskip\s+it\b/.test(t) ||
    /\bwe\s+can\s+skip\b/.test(t) ||
    /\bi'?ll\s+skip\b/.test(t) ||
    /\bjust\s+skip\b/.test(t) ||
    /\byeah,?\s+skip\b/.test(t) ||
    /\bgo\s+ahead\s+and\s+skip\b/.test(t) ||
    /\bskip\s+please\b/.test(t)
  );
}

/**
 * User asks to skip the active scenario beat without going through frustration-meta classification
 * (e.g. exempt resume/name prompts wipe `effective` meta — client still routes explicit skip phrases).
 */
export function looksLikeProactiveScenarioSkipRequest(text: string): boolean {
  return looksLikeFrustrationSkipAcceptance(text);
}

/** Affirmative reply after the assistant asked whether to skip (yes / skip / let's skip, etc.). */
export function looksLikeFrustrationSkipConfirmationAffirmative(text: string): boolean {
  if (looksLikeFrustrationSkipAcceptance(text)) return true;
  const raw = text.trim();
  if (!raw || raw.length > 120) return false;
  const t = raw.toLowerCase();
  if (/\b(don'?t|do not)\s+(want\s+to\s+)?skip\b/.test(t)) return false;
  return (
    /^(yes|yeah|yep|yup|sure|ok|okay|please)\.?$/i.test(raw) ||
    /^(do\s+it|go\s+ahead)\.?$/i.test(raw) ||
    /^yes[,.]?\s+(please\s+)?skip\b/i.test(t)
  );
}

/** Negative reply when we're waiting for skip confirmation — stay on the question. */
export function looksLikeSkipConfirmationDecline(text: string): boolean {
  const raw = text.trim();
  if (!raw || raw.length > 200) return false;
  if (looksLikeFrustrationSkipConfirmationAffirmative(raw)) return false;
  const t = raw.toLowerCase();
  if (/^(no|nope|nah)\.?$/i.test(raw)) return true;
  if (/^no[,.]?\s*(thanks|thank you)\.?$/i.test(t)) return true;
  if (/\b(don'?t|do not)\s+(want\s+to\s+)?skip\b/.test(t)) return true;
  if (/^no\s*(,\s*)?skip\s*$/i.test(raw) && !/\blet'?s\b/i.test(t)) return true;
  if (/\blet'?s\s+not\s+skip\b/.test(t)) return true;
  if (/\b(let'?s\s+)?stay\s+(on|with)\s+(this|it|that)\b/.test(t)) return true;
  if (/\bkeep\s+(going|trying)\b/.test(t)) return true;
  if (/^i'?d\s+rather\s+not\b/i.test(t)) return true;
  if (/^i'?ll\s+(answer|try)\b/i.test(t)) return true;
  if (/^no[,.]?\s*(i'?ll|let\s+me|i\s+want\s+to\s+answer)\b/i.test(t)) return true;
  return false;
}

const SKIP_CONFIRM_GREETING_TOKENS = new Set(['hello', 'hi', 'hey', 'hiya', 'yo', 'there']);

/**
 * After the skip-confirmation prompt, a bare greeting checks whether the app is still listening — not a thin answer.
 */
export function looksLikeSkipConfirmationConnectivityGreeting(text: string): boolean {
  const raw = text.trim().replace(/\s+/g, ' ');
  if (!raw || wordCount(raw) > 3) return false;
  const words = raw.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  return words.every((w) => {
    const core = w.replace(/^[^a-z]+|[^a-z]+$/gi, '');
    return SKIP_CONFIRM_GREETING_TOKENS.has(core);
  });
}

/** Client-only line when user sends a connectivity greeting after skip confirmation (no elaboration probe). */
export const SKIP_CONFIRMATION_GREETING_REOPEN_LINE =
  'Still here — just say whatever comes to mind, or we can move on.';
