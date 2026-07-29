import { looksLikeMoment4ThresholdQuestion } from './moment4ProbeLogic';
import {
  MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
  MOMENT_5_INEXPERIENCE_FALLBACK_QUESTION,
} from '@features/aria/moment5ProbeCopy';
import { looksLikeMoment5AccountabilityProbeAssistantPrompt } from '@features/aria/moment5AccountabilityProbe';
import { moment5PersonalNarrativeHasConcreteAnchor } from '@features/aria/moment5ConcreteAnchor';
import { looksLikeMoment5ConflictValidityClarificationPrompt } from '@features/aria/moment5ConflictValidity';
import { looksLikeMoment5SpecificityRedirectPrompt } from '@features/aria/moment5SpecificityRedirect';
import { normalizeInterviewTypography } from './interviewTypography';

export type Moment5TranscriptTurn = {
  role?: string;
  content?: string | null;
  interviewMoment?: number;
  interview_moment?: number;
  moment?: number;
};

/** Read Moment index from transcript rows stored as camelCase or snake_case. */
export function readTranscriptTurnInterviewMoment(
  turn: Moment5TranscriptTurn | null | undefined,
): number | undefined {
  if (!turn || typeof turn !== 'object') return undefined;
  const raw = turn.interviewMoment ?? turn.interview_moment ?? turn.moment;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function isMoment5TaggedUserTurn(
  turn: Moment5TranscriptTurn | null | undefined,
): boolean {
  return (
    turn?.role === 'user' &&
    readTranscriptTurnInterviewMoment(turn) === 5 &&
    (turn.content ?? '').trim().length > 0
  );
}

export function collectMoment5TaggedUserTurns(
  transcript: readonly Moment5TranscriptTurn[] | null | undefined,
): Moment5TranscriptTurn[] {
  if (!Array.isArray(transcript)) return [];
  return transcript.filter((t) => isMoment5TaggedUserTurn(t));
}

export function logMoment5ScoringDiagnostics(
  attemptId: string | null | undefined,
  transcript: readonly Moment5TranscriptTurn[] | null | undefined,
  scoringSlice: readonly { role?: string; content?: string | null }[] | null | undefined,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const m5Turns = collectMoment5TaggedUserTurns(transcript);
  const combinedTagged = m5Turns
    .map((t) => (t.content ?? '').trim())
    .filter(Boolean)
    .join(' ');
  const totalWords = combinedTagged.split(/\s+/).filter(Boolean).length;
  const payload = {
    attemptId: attemptId ?? 'unknown',
    taggedM5UserTurns: m5Turns.length,
    taggedM5Previews: m5Turns.map((t) => (t.content ?? '').trim().slice(0, 50)),
    combinedTaggedWordCount: totalWords,
    sliceUserTurns: (scoringSlice ?? []).filter((m) => m.role === 'user').length,
    ...extra,
  };
  console.log(`[M5] Diagnostics for attempt ${attemptId ?? 'unknown'}`);
  console.log(`[M5] interviewMoment=5 turns found: ${m5Turns.length}`);
  console.log(`[M5] Turn previews:`, payload.taggedM5Previews);
  console.log(`[M5] Combined tagged text word count: ${totalWords}`);
  console.log(`[M5] Scoring slice user turns: ${payload.sliceUserTurns}`);
  if (extra) {
    console.log('[M5] Extra:', extra);
  }
  return payload;
}

const M5_CLOSING_META_ONLY =
  /^(yeah|yes|no|okay|ok|sure|right|exactly|totally|basically)[,.!]?\s*(it felt complete|that makes sense|i think so|sounds good|got it)?[.!?]*$/i;

/** Prefer the longest substantive M5 narrative — not thin resolution/meta replies — for closing reflection. */
export function extractMoment5AnswerForClosingReflection(
  transcript: readonly Moment5TranscriptTurn[] | null | undefined,
): string {
  const substantive: string[] = [];
  if (!Array.isArray(transcript)) return '';
  for (const t of transcript) {
    if (t.role !== 'user' || readTranscriptTurnInterviewMoment(t) !== 5) continue;
    const c = (t.content ?? '').replace(/\s+/g, ' ').trim();
    if (!c) continue;
    const words = c.split(/\s+/).filter(Boolean).length;
    if (words < 5) continue;
    if (words <= 12 && M5_CLOSING_META_ONLY.test(c)) continue;
    if (words <= 8 && /\b(felt complete|sounds good|that'?s right|pretty much)\b/i.test(c)) continue;
    substantive.push(c);
  }
  if (substantive.length === 0) return combineMoment5UserTurnText(transcript);
  if (substantive.length === 1) {
    return substantive.reduce((longest, cur) => (cur.length > longest.length ? cur : longest), '');
  }
  return substantive.join(' ');
}

/** All user turns tagged `interviewMoment: 5` in order — used for anchor/probe gates across follow-ups. */
export function combineMoment5UserTurnText(
  transcript: readonly Moment5TranscriptTurn[] | null | undefined,
): string {
  const parts: string[] = [];
  if (!Array.isArray(transcript)) return '';
  for (const t of transcript) {
    if (t.role !== 'user' || readTranscriptTurnInterviewMoment(t) !== 5) continue;
    const c = (t.content ?? '').trim();
    if (c) parts.push(c);
  }
  return parts.join(' ');
}

/** Prior M5 user turns plus the in-flight reply — for cross-turn accountability/resolution gates. */
export function combineMoment5UserTextIncludingCurrent(
  transcript: readonly Moment5TranscriptTurn[] | null | undefined,
  currentUserText: string,
): string {
  const prior = combineMoment5UserTurnText(transcript);
  const current = currentUserText.replace(/\s+/g, ' ').trim();
  if (!prior) return current;
  if (!current) return prior;
  return `${prior} ${current}`;
}

/** M5 user narrative before the conflict-validity clarification answer (excludes clarification response). */
export function extractPriorM5TranscriptBeforeClarification(
  transcript: readonly Moment5TranscriptTurn[] | null | undefined,
): string {
  return combineMoment5UserTurnText(transcript);
}

/** True when any Moment 5 user turn (combined) already names a person/episode — not only the latest reply. */
export function moment5TranscriptHasConcreteAnchor(
  transcript: readonly Moment5TranscriptTurn[] | null | undefined,
): boolean {
  const combined = combineMoment5UserTurnText(transcript);
  if (!combined) return false;
  return moment5PersonalNarrativeHasConcreteAnchor(combined);
}

/** Pushback after a friend/partner redirect when the user already gave a concrete story earlier in M5. */
export function moment5UserDeclinesConcreteReask(userText: string): boolean {
  const t = userText.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return false;
  return (
    /\bi\s+just\s+told\s+you\b/.test(t) ||
    /\bi\s+already\s+told\s+you\b/.test(t) ||
    /\bi\s+just\s+said\s+(that|so)\b/.test(t) ||
    /\bi\s+already\s+(said|answered)\s+(that|this)\b/.test(t) ||
    /\bdidn'?t\s+i\s+already\s+answer\b/.test(t) ||
    /\bi\s+think\s+i\s+covered\s+that\b/.test(t) ||
    /\b(not a general|wasn'?t a general|that was not a general|not\s+general\s+approach)\b/.test(t) ||
    /\b(named a specific|gave a specific|already named|specific person|specific example)\b/.test(t) ||
    /\bi\s+already\s+(named|gave|shared|described)\b/.test(t) ||
    /\bi\s+already\s+been\s+through\b/.test(t)
  );
}

/**
 * Short replay when the user asks to hear the question again in Moment 5 but already answered substantively.
 * Replays the immediate last interviewer question — not the full M4→5 bundle.
 * No leading "Got it" — repeat TTS adds its own brief ack ("Sure.") separately.
 */
export function buildMoment5ConfusionRepeatReplayAfterPriorAnswer(args: {
  lastInterviewerText: string;
}): string {
  const last = (args.lastInterviewerText ?? '').trim();
  if (last) {
    const questions = last.match(/[^.!?]*\?/g);
    const lastQuestion = questions?.[questions.length - 1]?.trim();
    if (lastQuestion && lastQuestion.length >= 12) {
      return lastQuestion.replace(/^(?:got it|i hear you|makes sense)\b\s*[—–\-:,.!…]?\s*/i, '').trim() || lastQuestion;
    }
  }
  return MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT;
}

export function isMoment5InexperienceFallbackPrompt(text: string): boolean {
  const lower = text.replace(/\s+/g, ' ').trim().toLowerCase();
  return (
    lower.includes('what would meaningful celebration') &&
    lower.includes('look like to you') &&
    lower.includes('want to do for someone') &&
    lower.includes('meaningful to receive')
  );
}

/**
 * True when assistant content embeds the **scripted Moment 5 conflict question** (possibly inside a
 * longer client bundle with reflection + pivot). Use for closing gates and post-M5 user-turn counting
 * when {@link isMoment5AssistantAnchor} is too strict for sanitized typography.
 */
export function transcriptAssistantContainsMoment5PrimaryConflictQuestion(content: string | null | undefined): boolean {
  if (content == null || typeof content !== 'string') return false;
  if (looksLikeMoment5AccountabilityProbeAssistantPrompt(content)) return false;
  if (isMoment5AssistantAnchor(content)) return true;
  const lower = content.replace(/\s+/g, ' ').trim().toLowerCase();
  const hasConflictIntro = looksLikeMoment5ConflictQuestionIntro(lower);
  const hasResolutionAsk =
    lower.includes('how did things get resolved') ||
    lower.includes('how did it get resolved') ||
    (lower.includes('what happened') && lower.includes('resolved')) ||
    lower.includes('hard to take back');
  return hasConflictIntro && hasResolutionAsk;
}

/** Shared intro matcher for canonical + common model paraphrases of the M5 conflict ask. */
export function looksLikeMoment5ConflictQuestionIntro(lowerNormalized: string): boolean {
  const lower = lowerNormalized.toLowerCase();
  return (
    lower.includes('think of a time when you had a conflict with someone important') ||
    lower.includes('think of a time when you had a real conflict with someone') ||
    lower.includes('think of a time when you had a conflict with someone close') ||
    lower.includes('think of a time you had a conflict with someone close') ||
    (/\bthink of a time (?:when )?you had a (?:real )?conflict\b/.test(lower) &&
      /\b(?:someone (?:important|close)|important to you|close to you)\b/.test(lower))
  );
}

/**
 * True when TTS has reached the scripted M5 conflict intro (including the first streaming sentence).
 * Used to refresh Show scenario as soon as the conflict question begins, not after the full bundle ends.
 */
export function spokenTextStartsMoment5PrimaryConflictQuestion(content: string | null | undefined): boolean {
  if (content == null || typeof content !== 'string') return false;
  if (looksLikeMoment5AccountabilityProbeAssistantPrompt(content)) return false;
  const lower = content.replace(/\s+/g, ' ').trim().toLowerCase();
  return looksLikeMoment5ConflictQuestionIntro(lower);
}

/**
 * True when an assistant turn is (or contains) the Moment 5 primary prompt, legacy appreciation prompts,
 * or related pivots. Used to slice the transcript for post-interview Moment 5 scoring.
 */
export function isMoment5AssistantAnchor(content: string | null | undefined): boolean {
  if (!content) return false;
  if (looksLikeMoment4ThresholdQuestion(content)) return false;
  const c = content.replace(/\s+/g, ' ').trim();
  const lower = c.toLowerCase();
  if (lower.includes('conflict or disagreement with someone important')) return true;
  if (
    looksLikeMoment5ConflictQuestionIntro(lower) &&
    (lower.includes('how did things get resolved') ||
      lower.includes('how did it get resolved') ||
      (lower.includes('what happened') && lower.includes('resolved')) ||
      lower.includes('hard to take back'))
  ) {
    return true;
  }
  /** Common Sonnet paraphrase of the scripted conflict prompt (not matched by canonical strings). */
  if (
    /\btell me about a specific conflict\b/i.test(c) &&
    /\b(someone important|important in your life|important to you|someone close)\b/i.test(lower) &&
    /\b(resolved|resolution|didn'?t|hard to take back)\b/i.test(lower)
  ) {
    return true;
  }
  if (lower.includes('tell me about a time you had a conflict') && lower.includes('how did it get resolved')) {
    return true;
  }
  if (isMoment5InexperienceFallbackPrompt(c)) return true;
  if (lower.includes('think of a time you really celebrated someone')) return true;
  if (lower.includes('really celebrated') && /\b(your life|in your life|them that|show them)\b/.test(lower)) {
    return true;
  }
  if (lower.includes('really got to show someone close to you') && lower.includes('mattered')) return true;
  if (
    /\b(moment you celebrated someone|celebrated someone who mattered)\b/.test(lower) ||
    (/\bcelebrated someone\b/.test(lower) &&
      /\b(mattered|meaningful|close to you|in your life|your life)\b/.test(lower))
  ) {
    return true;
  }
  if (
    /\bshow(?:ed)? up for someone\b/.test(lower) &&
    /\b(what comes to mind|time|moment|talk about|can we|love to hear|curious|tell me)\b/.test(lower)
  ) {
    return true;
  }
  if (lower.includes('what did you do to show them that')) return true;
  if (
    /\bwarmer beat from your own life\b/.test(lower) &&
    /\b(celebrat|appreciat|generous|show up)\b/.test(lower)
  ) {
    return true;
  }
  if (
    /\bhearing where that line is for you\b/.test(lower) &&
    /\bgenerous instead of careful\b/.test(lower)
  ) {
    return true;
  }
  if (
    /\bhow you name that threshold\b/.test(lower) &&
    /\b(show them|celebrat|warmer|generous)\b/.test(lower)
  ) {
    return true;
  }
  if (
    /\btaking that in\b/.test(lower) &&
    /\b(celebrat|appreciat|warmer)\b/.test(lower) &&
    /\b(side|moment|beat|life)\b/.test(lower)
  ) {
    return true;
  }
  return false;
}

/** @deprecated Use {@link isMoment5AssistantAnchor} — name retained for legacy imports. */
export const isMoment5AppreciationAssistantAnchor = isMoment5AssistantAnchor;

