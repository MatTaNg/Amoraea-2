import { isApprovedElongatingProbeOnly } from './elongatingProbe';
import { chooseBriefScenarioAck } from './interviewReflectionAckVariation';
import { enrichPersonalMomentClosingForTts } from './personalMomentClosingEnrichment';
import {
  buildBoundaryReflectionFromUserCorpus,
  buildPatternReflectionSentence,
} from './relationalPatternReflection';
import type { MessageWithScenario } from './interviewScenarioScoringSlice';
import { isScenarioBoundaryClosureTurn } from './interviewReflectionTextStrips';

/** Normalize curly apostrophes so handoff regexes match model output (`Here\u2019s` vs `Here's`). */
function normalizeTypographicApostrophesForMatch(s: string): string {
  return s.replace(/\u2019/g, "'").replace(/\u2018/g, "'");
}

/** Fiction first names — good for echo *detection* on scripted questions, bad as mandatory-prefix *anchors* ("James and dropped"). */
const SCENARIO_VIGNETTE_FIRST_NAMES = new Set(['james', 'sarah', 'emma', 'ryan', 'sophie', 'daniel']);

/**
 * Scenario B mandatory James-differently prompt (wording may vary slightly).
 * It repeats vignette names — must not satisfy "echo" checks by itself (false positive vs user analysis).
 */
function isLikelyScenarioBJamesDifferentlyQuestionBody(text: string): boolean {
  const t = (text ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (t.length > 320) return false;
  const hasJamesProbe =
    /james could have done (?:something )?differently/i.test(t) ||
    /what do you think james could have done/i.test(t);
  const hasAppreciatedCue = /feel appreciated|helped sarah/i.test(t);
  const hasOpeningCue = /before things blew up/i.test(t);
  const looksReflective = /\b(you'?re|you are|i hear|sounds like|so you|reading|centering|named)\b/i.test(t);
  return hasJamesProbe && hasAppreciatedCue && (hasOpeningCue || t.length < 200) && !looksReflective;
}

/**
 * Short scripted Scenario B Q3 — not a paraphrase of the user's James-differently answer even when they said "James…"
 * (attempt 85: echo detector false positive skipped mandatory ack).
 */
function looksLikeBareScenarioBRepairAsJamesProbe(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length > 220) return false;
  const low = t.toLowerCase();
  if (!/\bjames\b/.test(low)) return false;
  if (!/\b(repair|fix|handle|approach|make it right|make things right|mend|patch)\b/.test(low)) return false;
  return (
    /\bif you were james\b/.test(low) ||
    (/\bhow would you\b/.test(low) && /\bjames\b/.test(low)) ||
    /\bhow would you repair\b.*\bjames\b/.test(low) ||
    /\bjames\b.*\bhow would you repair\b/.test(low)
  );
}

/** First paragraph opens with a scenario handoff and little/no lead-in (attempt 85: S2→S3 felt abrupt). */
function needsMandatoryAckBeforeScenarioHandoff(userTurn: string, head: string): boolean {
  if (!(userTurn ?? '').trim()) return false;
  if (/\bi hear you\s*:/i.test(head)) return false;
  const h = normalizeTypographicApostrophesForMatch(head).trim();
  const stripped = h.replace(/^(\s*(yeah|mm|fair|okay|ok|thanks|thank you)[.,]?\s*)+/i, '').trim();
  // First paragraph often contains the full vignette — only inspect the opening for the handoff cue.
  const opening = stripped.slice(0, 420);
  const bareHandoff =
    /^here'?s the third situation\b/i.test(opening) ||
    /^here'?s the second situation\b/i.test(opening) ||
    /^on to the second situation\b/i.test(opening);
  if (!bareHandoff) return false;
  return !userTurnIsSubstantivelyEchoed(userTurn, head);
}

/** True if assistant copy plausibly echoes substantive wording from the user's last turn (not generic filler alone). */
function assistantTurnEchoesUserLastAnswer(userAnswer: string, assistantText: string): boolean {
  const a = (assistantText ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (a.length < 26) return false;
  const u = (userAnswer ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (u.length < 8) return a.length >= 40;
  const stop = new Set([
    'think', 'that', 'they', 'there', 'about', 'would', 'could', 'something', 'because', 'really', 'still',
    'what', 'when', 'where', 'which', 'while', 'those', 'these', 'other', 'being', 'going', 'having',
  ]);
  const words = u
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9']/gi, ''))
    .filter((w) => w.length > 5 && !stop.has(w))
    .slice(0, 14);
  if (words.length === 0) return false;
  const echoOutsideNames = words.some((w) => !SCENARIO_VIGNETTE_FIRST_NAMES.has(w) && a.includes(w));
  if (echoOutsideNames) return true;
  const echoNameOnly = words.some((w) => SCENARIO_VIGNETTE_FIRST_NAMES.has(w) && a.includes(w));
  if (echoNameOnly && isLikelyScenarioBJamesDifferentlyQuestionBody(assistantText)) {
    return false;
  }
  if (echoNameOnly && looksLikeBareScenarioBRepairAsJamesProbe(assistantText)) {
    return false;
  }
  return echoNameOnly;
}

function normalizeUserTurnForTierCheck(userTurn: string): string {
  return userTurn.replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s+/g, ' ').trim();
}

/** Last assistant message text (for Tier 3 echo-of-question heuristic). */
function lastAssistantPlainText(recentAssistant: MessageWithScenario[]): string {
  const last = [...recentAssistant].reverse().find((m) => m.role === 'assistant');
  return typeof last?.content === 'string' ? last.content : '';
}

/** Tier 3 — minimal confirmations, short passes, name exchange, echo of prior question (see REFLECTION CALIBRATION in framework prompt). */
function isTier3MinimalUserTurn(userTurn: string, recentAssistant: MessageWithScenario[]): boolean {
  const u = normalizeUserTurnForTierCheck(userTurn ?? '');
  if (!u) return true;
  const lower = u.toLowerCase();
  if (
    /^(ready|yes|yeah|yep|sure|ok|okay|no|nope|nah|maybe|not really|i guess|i don'?t know|idk|pass|skip|nothing|none|mm|mhm|hm|uh\s*huh|sounds good|let'?s go|nothing comes to mind|not sure)\.?$/i.test(
      lower
    )
  ) {
    return true;
  }
  const words = u.split(/\s+/).filter(Boolean);
  const compact = lower.replace(/[^a-z0-9]/g, '');
  if (words.length === 1 && compact.length <= 7) return true;
  if (words.length === 2 && compact.length <= 10) return true;
  const lastAsst = lastAssistantPlainText(recentAssistant).toLowerCase().replace(/\s+/g, ' ');
  if (lastAsst.length > 50 && lower.length >= 10 && lower.length <= lastAsst.length * 0.92) {
    const uC = lower.replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
    const aC = lastAsst.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    if (uC.length >= 14 && aC.includes(uC)) return true;
  }
  return false;
}

/** True if assistant copy (usually first paragraph) plausibly registers the user's last turn, including one- or two-word answers. */
function userTurnIsSubstantivelyEchoed(userTurn: string, assistantText: string): boolean {
  const a = (assistantText ?? '').trim();
  if (!a) return false;
  if (assistantTurnEchoesUserLastAnswer(userTurn, a)) return true;
  const u = userTurn.toLowerCase().replace(/\s+/g, ' ').trim();
  const al = a.toLowerCase();
  if (!u) return false;
  if (u.length <= 40) {
    const shortEchoStop = new Set([
      'think', 'that', 'they', 'there', 'about', 'would', 'could', 'something', 'because', 'really', 'still',
      'what', 'when', 'where', 'which', 'while', 'those', 'these', 'other', 'being', 'going', 'having',
      'your', 'you', 'are', 'was', 'were', 'have', 'has', 'had', 'just', 'like', 'know', 'need', 'want',
      'maybe', 'also', 'then', 'than', 'more', 'some', 'very', 'well', 'yeah', 'okay', 'with', 'from',
    ]);
    const tokens = u
      .split(/[^a-z0-9']+/i)
      .map((w) => w.replace(/[^a-z0-9']/gi, ''))
      .filter((w) => w.length >= 3 && !shortEchoStop.has(w));
    return tokens.length > 0 && tokens.some((w) => al.includes(w));
  }
  return false;
}

/** True when the first paragraph already opens with a short receipt (model or client). */
function assistantFirstParagraphHasBriefReceipt(p: string): boolean {
  const t = normalizeTypographicApostrophesForMatch((p ?? '').trim());
  if (!t) return true;
  if (/^\s*\[INTERVIEW_COMPLETE\]/i.test(t)) return true;
  return (
    /^(got it|good|great|nice|makes sense|that makes a lot of sense|i'?m with you|yeah|yep|right|mm|hm|fair|okay|ok|thanks|thank you)\s*(?:\u2014|\u2013|-|,|\.)/i.test(
      t
    ) ||
    /^(got it|makes sense|that makes a lot of sense|i'?m with you|well done)\.\s/i.test(t) ||
    /^i hear you\s*(?:\u2014|\u2013|-|,|:)/i.test(t) ||
    /^(i see|i'm hearing)\b/i.test(t) ||
    /^(you're|you are)\b/i.test(t) ||
    /^that\s*'s\s+(a\s+real\s+read|exactly|interesting|fair|helpful)\b/i.test(t) ||
    /^i see what you mean\b/i.test(t)
  );
}

/** Scenario / onboarding openers — do not prepend "Got it —" before these. */
function looksLikeBareScenarioSituationLead(p: string): boolean {
  const t = normalizeTypographicApostrophesForMatch((p ?? '').replace(/\s+/g, ' ').trim());
  const open = t.slice(0, 200);
  return (
    /^here'?s the (first|second|third) situation\b/i.test(open) ||
    /^on to the second situation\b/i.test(open) ||
    /^hi,?\s+i'?m\b/i.test(open) ||
    /^good to meet you\b/i.test(open) ||
    /^the way this works\b/i.test(open)
  );
}

/**
 * Scenario boundary reflection: one second-person interpretive conclusion (not a paraphrase).
 */
export function summarizeUserAnswerForBoundaryReflection(userTurn: string): string {
  return buildBoundaryReflectionFromUserCorpus(userTurn);
}

/**
 * Scenario boundary reflection: one conclusion sentence when distillable from the scenario corpus.
 */
export function buildBoundaryReflectionSentence(
  firstName: string,
  lastUserAnswer: string,
  opts?: { openerIndex?: number; scenario?: 1 | 2 | 3 },
): string {
  void firstName;
  return buildBoundaryReflectionFromUserCorpus(lastUserAnswer.trim(), opts);
}

/** @deprecated Prefer {@link buildBoundaryReflectionSentence}. */
export function buildScenarioABoundaryReflectionSentence(
  firstName: string,
  lastUserAnswer: string,
): string {
  return buildBoundaryReflectionSentence(firstName, lastUserAnswer);
}

/**
 * Forced probes: no client reflection bridge — deliver the probe text only.
 */
export function wrapForcedProbeWithAck(
  _userAnswer: string,
  _priorModelChunk: string,
  probeQuestion: string,
  _recentAssistant: MessageWithScenario[],
): string {
  return probeQuestion.trim();
}

/**
 * Prepend a brief acknowledgment when the model skipped registering the user's answer.
 * Used for post-claude display and the first streaming TTS sentence of each turn.
 */
export function prependBriefAckIfMissingBeforeMove(
  assistantDraft: string,
  userTurn: string,
  recentAssistant: MessageWithScenario[],
  _interviewMoment = 0,
): string {
  void _interviewMoment;
  const draft = (assistantDraft ?? '').trim();
  if (!draft) return draft;
  if (isApprovedElongatingProbeOnly(draft)) return draft;
  if (/^\[(INTERVIEW_COMPLETE|STAGE_[123]_COMPLETE)/i.test(draft)) return draft;

  const parts = draft.split(/\n\n/);
  let first = parts[0] ?? '';

  if (isScenarioBoundaryClosureTurn(draft)) return draft;
  if (assistantFirstParagraphHasBriefReceipt(first)) return draft;
  if (userTurnIsSubstantivelyEchoed(userTurn, first)) return draft;
  if (/^got it\s*[—–-]/i.test(first)) return draft;

  if (looksLikeBareScenarioSituationLead(first) && !needsMandatoryAckBeforeScenarioHandoff(userTurn, first)) {
    return draft;
  }

  const ack = chooseBriefScenarioAck(recentAssistant);
  first = `${ack} ${first}`.trim();
  parts[0] = first;
  return parts.join('\n\n').trim() || draft;
}

/**
 * If the model skipped a specific acknowledgment, prepend a minimal echo so every user turn gets a register-before-move.
 */
export function ensureAcknowledgmentBeforeMove(
  assistantDraft: string,
  userTurn: string,
  recentAssistant: MessageWithScenario[],
  interviewMoment: number,
): string {
  return prependBriefAckIfMissingBeforeMove(
    assistantDraft,
    userTurn,
    recentAssistant,
    interviewMoment,
  );
}

export function ensureAcknowledgmentBeforeClosing(
  closingDraft: string,
  userTurn: string,
  _recentAssistant: MessageWithScenario[],
  participantFirstName = '',
): string {
  return enrichPersonalMomentClosingForTts(closingDraft, participantFirstName, userTurn);
}
