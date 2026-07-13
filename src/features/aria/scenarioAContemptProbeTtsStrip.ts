import { normalizeInterviewTypography } from './interviewTypography';
import {
  isIncompleteScenarioAContemptProbeLeadSentence,
  looksLikeScenarioAContemptProbeQuestion,
  scenarioAEmmaVeryClearClosingLineMentioned,
  scenarioAEmmaVeryClearContemptReask,
} from './scenarioAContemptProbeTextMatch';

/** Canonical Scenario A contempt probe — client-forced and orphan-stream fallback. */
export const SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY =
  "What about when Emma says 'you've made that very clear' — what do you make of that?";

/** TTS matches show-modal / delivered copy (including Emma's quoted line). */
export const SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY = SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;

/** @deprecated Alias — use {@link SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY}. */
export const SCENARIO_A_CONTEMPT_PROBE_RESUME_REPEAT_TTS_COPY = SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY;

/** Any contempt-probe-shaped assistant line → exact framework copy (no model paraphrase / wrong Emma quotes). */
export function coerceScenarioAContemptProbeToDeliveredCopy(text: string): string {
  const stored = (text ?? '').trim();
  if (!stored) return text;
  if (looksLikeScenarioAContemptProbeQuestion(stored)) {
    return SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
  }
  return text;
}

/** Map assistant speech (transcript/canonical) to contempt-probe TTS — always speak the full delivered line. */
export function scenarioAContemptProbeTtsSpokenText(assistantSpeechText: string): string {
  return coerceScenarioAContemptProbeForTts(assistantSpeechText);
}

function extractBriefAckBeforeIncompleteEmmaContemptProbe(text: string): string | null {
  const m = text.match(
    /^([\s\S]{0,320}?)(?:\.\s+|\n\n)(?:what (?:about when|do you (?:think|make of)) emma\b|that line emma (?:said|says)\b|(?:got it|makes sense|well done)[.,]?\s+(?:that line emma|what about when emma))/i,
  );
  const beforeProbe = m?.[1]?.trim();
  if (!beforeProbe || beforeProbe.length < 12) return null;
  if (/\bwhat (?:about when|do you )?think emma\b/i.test(beforeProbe)) return null;
  return beforeProbe.replace(/\.$/, '');
}

/** Expand truncated Emma contempt probe fragments (stream/model cutoff) to canonical copy. */
export function coerceScenarioAContemptProbeForTts(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return text;
  if (
    looksLikeScenarioAContemptProbeQuestion(t) ||
    scenarioAEmmaVeryClearContemptReask(t)
  ) {
    return SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
  }
  if (isIncompleteScenarioAContemptProbeLeadSentence(t)) {
    const ack = extractBriefAckBeforeIncompleteEmmaContemptProbe(t);
    if (ack) return `${ack}. ${SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY}`;
    return SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
  }
  return text;
}

/**
 * Repeat/resume TTS for the contempt probe — speak the full delivered line (including Emma's quote).
 * Initial playback uses {@link scenarioAContemptProbeTtsSpokenText} to avoid re-vocalizing the vignette line.
 */
export function scenarioAContemptProbeResumeRepeatTtsText(storedAssistantText: string): string {
  const stored = (storedAssistantText ?? '').trim();
  if (!stored) return storedAssistantText;
  if (
    stored.includes(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY) ||
    stored.includes(SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY) ||
    looksLikeScenarioAContemptProbeQuestion(stored)
  ) {
    return SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
  }
  return storedAssistantText;
}

/** Canonical Scenario A repair ask after the contempt probe — injected when duplicate-strip empties the model turn. */
export const SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY =
  'Got it. If you were Ryan, how would you repair this?';

/** @deprecated Prefer {@link SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY}. */
export const S1_REPAIR_QUESTION = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;

export function assertScenarioARepairQuestionCompleteness(): void {
  const q = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
  if (!q.endsWith('?') || q.length <= 20) {
    throw new Error('S1 repair question is truncated or missing');
  }
  if (!/\bif you were ryan\b/i.test(q) || !/\brepair\b/i.test(q)) {
    throw new Error('S1 repair question is missing required Ryan repair phrasing');
  }
}

assertScenarioARepairQuestionCompleteness();

/**
 * Parallel streaming may defer the Emma-line lead, then flush the full contempt probe as the next sentence.
 * Prepend only when the next chunk is not already a complete probe (avoids hearing the quote twice).
 */
export function mergeDeferredScenarioAContemptProbeLeadWithNextSentence(
  deferredLead: string,
  nextSentence: string,
): string {
  const lead = (deferredLead ?? '').trim();
  const next = (nextSentence ?? '').trim();
  if (!lead) return next;
  if (!next) return lead;
  if (looksLikeScenarioAContemptProbeQuestion(next)) {
    return next;
  }
  const nextNorm = next.toLowerCase().replace(/\u2019/g, "'");
  const leadNorm = lead.toLowerCase().replace(/\u2019/g, "'");
  if (
    scenarioAEmmaVeryClearClosingLineMentioned(nextNorm) &&
    nextNorm.includes(leadNorm.slice(0, Math.min(leadNorm.length, 48)))
  ) {
    return next;
  }
  return `${lead} ${next}`.trim();
}

/** Remove repeated Scenario A contempt-probe asks after one was already delivered (model loop / ASR variants). */
export function stripScenarioAContemptProbeQuestion(text: string): string {
  let s = text;
  const removals: RegExp[] = [
    /\n?\s*What about when Emma says[^\n]*?\bwhat do you make of (that|it)\??\s*/gi,
    /\n?\s*What do you make of Emma['\u2019]s statement when she says[^\n]*?\??\s*/gi,
    /\n?\s*What (?:did|do) you think when[^\n]*?(?:very\s+clear|made that very clear)[^\n?]*\??\s*/gi,
    /\n?\s*What's going on for Emma when she says[\s\S]{0,280}?\??\s*/gi,
    /\n?\s*The way you read Emma['\u2019]s closing line[\s\S]{0,320}?\??\s*/gi,
    /\n?\s*What does Emma['\u2019]s closing line[\s\S]{0,400}?\??\s*/gi,
    /\n?\s*What (?:did|do) you think Emma meant when she said[\s\S]{0,400}?\??\s*/gi,
    /\n?\s*What (?:did|do) you make of Emma['\u2019]s closing line[\s\S]{0,400}?\??\s*/gi,
    /\n?\s*Reading that last line Emma says[\s\S]{0,520}?\??\s*/gi,
    /\n?\s*[^.?\n]{0,200}how does that land for you\??\s*/gi,
    /\n?\s*What do you make of[^\n]{0,140}Emma[^\n]{0,180}very clear[^\n.?!]*\??\s*/gi,
    /\n?\s*What do you make of[\s\S]{0,320}?Emma[\s\S]{0,360}?(?:very\s+clear|you'?ve\s+made|you\s+made\s+that)[\s\S]{0,120}?\??\s*/gi,
    /\n?\s*[^.?\n]{0,120}closing line from Emma[\s\S]{0,320}?read as contempt[\s\S]{0,120}?\??\s*/gi,
    /\n?\s*[^.?\n]{0,80}did that read as contempt to you(?:, or something else)?\??\s*/gi,
  ];
  for (const re of removals) {
    s = s.replace(re, '\n');
  }
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

/** When the contempt probe was already delivered, remove a duplicate ask glued into the same paragraph. */
export function stripEmbeddedScenarioAContemptProbeAsk(draft: string): string {
  const t0 = (draft ?? '').trim();
  if (!t0) return draft;
  let t = normalizeInterviewTypography(t0);
  const patterns: RegExp[] = [
    /\bWhat about when Emma says[\s\S]{0,220}?\bwhat do you make of (?:that|it)\??\s*/gi,
    /\bWhat do you make of Emma['\u2019]s statement when she says[\s\S]{0,220}?\??\s*/gi,
    /\bWhat (?:did|do) you think when[\s\S]{0,220}?(?:very\s+clear|made that very clear)[\s\S]{0,80}?\??\s*/gi,
    /\bWhat's going on for Emma when she says[\s\S]{0,280}?\??\s*/gi,
    /\bThe way you read Emma['\u2019]s closing line[\s\S]{0,320}?\??\s*/gi,
    /\bWhat does Emma['\u2019]s closing line[\s\S]{0,400}?\??\s*/gi,
    /\bWhat (?:did|do) you think Emma meant when she said[\s\S]{0,400}?\??\s*/gi,
    /\bWhat (?:did|do) you make of Emma['\u2019]s closing line[\s\S]{0,400}?\??\s*/gi,
    /\bReading that last line Emma says[\s\S]{0,520}?\??\s*/gi,
    /\b[^.?\n]{0,200}how does that land for you\??\s*/gi,
    /\bWhat do you make of[\s\S]{0,320}?Emma[\s\S]{0,360}?(?:very\s+clear|you'?ve\s+made|you\s+made\s+that)[\s\S]{0,120}?\??\s*/gi,
    /\b[^.?\n]{0,120}closing line from Emma[\s\S]{0,320}?read as contempt[\s\S]{0,120}?\??\s*/gi,
    /\b[^.?\n]{0,80}did that read as contempt to you(?:, or something else)?\??\s*/gi,
  ];
  let prev = '';
  while (prev !== t) {
    prev = t;
    for (const re of patterns) {
      t = t.replace(re, '').replace(/\s{2,}/g, ' ').trim();
    }
  }
  return t
    .replace(/^\s*[.,;—–\-–]\s*/g, '')
    .replace(/\s+[.,;—–\-–]\s*$/g, '')
    .trim();
}

/**
 * Parallel streaming TTS flushes by sentence before duplicate stripping on the full assistant turn.
 * When the Scenario A contempt probe was already spoken, suppress model echoes in a flushed chunk.
 */
export function stripScenarioAContemptProbeStreamingEcho(
  spoken: string,
  contemptProbeAlreadyAsked: boolean,
): string | null {
  const t0 = normalizeInterviewTypography((spoken ?? '').trim());
  if (!contemptProbeAlreadyAsked || !t0) {
    return t0;
  }
  if (looksLikeScenarioAContemptProbeQuestion(t0) || scenarioAEmmaVeryClearContemptReask(t0)) {
    return null;
  }
  return t0;
}
