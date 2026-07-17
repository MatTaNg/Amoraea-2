import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { isInterviewPreambleBriefingMoment } from '@features/aria/interviewLanguageGate';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { appendAssistantTurn, assistantTurnHasPersistableContent } from '@features/aria/interviewTranscriptTurns';
import { INTERVIEW_OPENING_GREETING } from '@features/aria/utils/interviewOpeningGreeting';

export function transcriptHasScenario1VignetteAssistant(
  msgs: Array<{ role: string; content?: string }> | undefined,
): boolean {
  return (msgs ?? []).some(
    (m) =>
      m.role === 'assistant' &&
      ((m.content ?? '').includes('Emma and Ryan') ||
        (m.content ?? '').includes("What's going on between these two")),
  );
}

export function buildFallbackIntroBriefingText(firstName: string): string {
  const name = firstName.trim() || 'there';
  return (
    `Good to meet you, ${name}. The way this works is I'll first give you three situations, ` +
    "and you just tell me what you'd do in each situation. Then I'll give you two short personal questions. " +
    'The whole thing usually takes about 20 to 30 minutes. Try to find a quiet, private space if you can. ' +
    "The more information you give me the better I will be able to get to know you, so try to make your answers as thorough and in depth as possible. Are you ready?"
  );
}

const INTRO_BRIEFING_READINESS_SUFFIX = 'Are you ready?';

export function isIntroBriefingReadinessOnlySentence(text: string): boolean {
  const stripped = stripControlTokens(text).trim();
  if (!stripped) return false;
  return /^are you ready\??\s*$/i.test(stripped);
}

export function introBriefingSpeechEndsWithReadinessQuestion(text: string): boolean {
  return /\bare you ready\??\s*$/i.test(stripControlTokens(text).trim());
}

export function extractFirstNameFromIntroBriefingLead(text: string): string | null {
  const m = text.match(/\bgood to meet you,?\s+([A-Za-z][A-Za-z'-]{0,31})\b/i);
  return m?.[1]?.trim() ?? null;
}

/** Opening name handshake + post-name briefing — never the mid-interview question to verbatim-repeat. */
export function looksLikeIntroBriefingSpeech(text: string): boolean {
  const t = stripControlTokens(text).trim();
  if (!t) return false;
  if (isInterviewPreambleBriefingMoment(t)) return true;
  const lower = t.toLowerCase();
  if (/\bhi,?\s+i'?m\s+amoraea\b/.test(lower) && /\bwhat can i call you\b/.test(lower)) {
    return true;
  }
  return (
    /good to meet you/i.test(lower) &&
    (/the way this works/i.test(lower) || /three situations/i.test(lower) || /five parts/i.test(lower))
  );
}

/** Streaming / buffered TTS may cut off before "I call you?" */
export function isIncompleteOpeningNamePrompt(text: string): boolean {
  const t = stripControlTokens(text).trim();
  if (!t || /\?\s*$/.test(t)) return false;
  const lower = t.toLowerCase();
  if (/\bwhat can i call you\b/.test(lower)) return false;
  return /\bhi,?\s+i'?m\s+amoraea\b/.test(lower) && /\bwhat can\b/.test(lower);
}

export function coerceOpeningNamePromptForTts(text: string): string {
  const t = stripControlTokens(text).trim();
  if (!t) return text;
  if (isIncompleteOpeningNamePrompt(t)) return INTERVIEW_OPENING_GREETING;
  return text;
}

/** TTS must deliver the full scripted briefing including the readiness question. */
export function ensureCanonicalIntroBriefingForTts(
  text: string,
  participantFirstName?: string | null,
): string {
  const stripped = stripControlTokens(text).trim();
  if (!stripped || !looksLikeIntroBriefingSpeech(stripped)) return text;
  if (/\bare you ready\??\s*$/i.test(stripped)) return text;
  /** Preamble body streamed after a separate greeting sentence — leave readiness to its own streamed sentence. */
  if (!/\bgood to meet you\b/i.test(stripped)) {
    return text;
  }
  const name =
    (participantFirstName ?? '').trim() ||
    extractFirstNameFromIntroBriefingLead(stripped) ||
    'there';
  const canonical = buildFallbackIntroBriefingText(name);
  return canonical;
}

export function insertPreambleBriefingIfMissing(
  msgs: MessageWithScenario[],
  briefingText: string,
): MessageWithScenario[] {
  if (msgs.some((m) => m.role === 'assistant' && isInterviewPreambleBriefingMoment(m.content ?? ''))) {
    return msgs;
  }
  const trimmed = stripControlTokens(briefingText).trim();
  if (!assistantTurnHasPersistableContent(trimmed)) return msgs;
  const briefingMsg: MessageWithScenario = {
    role: 'assistant',
    content: trimmed,
    scenarioNumber: 1,
    interviewMoment: 1,
  };
  const firstAsstIdx = msgs.findIndex((m) => m.role === 'assistant');
  if (firstAsstIdx < 0) return appendAssistantTurn(msgs, trimmed, { scenarioNumber: 1, interviewMoment: 1 });
  /** After opening greeting + first user turn (name), before readiness assents. */
  let insertAt = firstAsstIdx + 1;
  if (insertAt < msgs.length && msgs[insertAt]?.role === 'user') {
    insertAt += 1;
  }
  return [...msgs.slice(0, insertAt), briefingMsg, ...msgs.slice(insertAt)];
}
