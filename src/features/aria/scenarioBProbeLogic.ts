import { SHOW_SCENARIO_2_OPENING_EXACT } from './interviewShowScenarioExactCopy';
import { normalizeApostrophesForPromptMatch } from './interviewTypography';
import type { MessageWithScenario } from './interviewScenarioScoringSlice';
import { textContainsScenarioBVignetteBody, textContainsScenarioCVignetteBody } from './emotionScenarioTransitionInference';
import { hasScenarioBoundaryWrapPhrase } from './emotionModalTransitionOrchestration';
import { assistantTextLooksLikeMoment4HandoffLead } from './interviewTransitionBundles';
import { isScenarioBoundaryPositiveAddressReflection } from './interviewReflectionTextStrips';
import { isDecline } from './interviewControlTokens';
import { looksLikeIncompleteCutOffUserAnswer } from './interviewAnswerRelevance';
import {
  findLastUserWithPriorScenarioARepairContext,
  findLastUserWithPriorScenarioBJamesRepairContext,
  userAnswerSatisfiesScenarioARepairPrompt,
  userAnswerSatisfiesScenarioBJamesRepairPrompt,
} from './interviewRepairRefusalDetection';
import { withSkipAcceptedNextQuestionBridgePreserved } from './skipAcceptedNextQuestionBridge';

export function looksLikeScenarioBFullAppreciationProbeQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes("what do you think james could've done differently so sarah feels better");
}

/** Canonical Scenario B Q2 — client inject + TTS/modal fallback when streaming truncates. */
export const SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL =
  'What do you think James could have done differently to help Sarah feel appreciated?';

/** True when Scenario B Q2 was delivered with the appreciation construct (canonical or equivalent). */
export function isDeliveredScenarioBJamesDifferentlyProbe(text: string): boolean {
  const normalized = normalizeApostrophesForPromptMatch(text).trim();
  if (!normalized || !/\?\s*$/.test(normalized)) return false;
  const canonical = normalizeApostrophesForPromptMatch(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL).toLowerCase();
  const t = normalized.toLowerCase();
  if (t.includes(canonical)) return true;
  if (!/\bjames\b/.test(t)) return false;
  const hasAppreciationConstruct =
    /\b(feel appreciated|make sarah feel|help(ed)? sarah feel|help sarah feel|might have helped sarah)\b/.test(
      t,
    );
  const asksJamesAlternative =
    /\b(could have done|could'?ve done|done differently|what james could|anything james could)\b/.test(t);
  return hasAppreciationConstruct && asksJamesAlternative;
}

/** Off-script Q2 that frames the construct as "before the fight" without appreciation language. */
export function isBeforeFightOnlyScenarioBJamesQ2Paraphrase(text: string): boolean {
  const normalized = normalizeApostrophesForPromptMatch(text).trim();
  if (!normalized) return false;
  if (isDeliveredScenarioBJamesDifferentlyProbe(normalized)) return false;
  const t = normalized.toLowerCase();
  if (!/\bjames\b/.test(t)) return false;
  return /\b(before (the )?(fight|blow|blow-?up)|before things blew up)\b/.test(t);
}

/** Scenario B Q2 — what James could have done before the rupture (not repair-as-James). */
export function looksLikeScenarioBJamesDifferentlyQuestion(text: string): boolean {
  const t = text.toLowerCase();
  if (looksLikeScenarioBFullAppreciationProbeQuestion(text)) return true;
  const jamesCtx = /\bjames\b/.test(t);
  const differently =
    /\b(could'?ve done differently|could have done differently|done differently|anything james could|what james could)\b/.test(
      t,
    );
  const completeQuestion = /\?\s*$/.test((text ?? '').trim());
  const beforeFight =
    completeQuestion &&
    jamesCtx &&
    /\b(before (the )?(fight|blow|blow-?up)|might have helped|so sarah feels|feel appreciated|helped sarah)\b/.test(t);
  const leanJamesProbe =
    completeQuestion &&
    /\bis there anything james could have done\b/.test(t) &&
    /\bhelp(ed)?\b/.test(t);
  return (jamesCtx && differently && completeQuestion) || beforeFight || leanJamesProbe;
}

/** Brief ack before a truncated James-differently probe (e.g. "That's a real read on it. What could James"). */
function extractBriefAckBeforeIncompleteJamesProbe(text: string): string | null {
  const m = text.match(
    /^((?:that'?s (?:a )?real read on it|good read|great read|nice work|that makes sense|you(?:'re| are) seeing that|I hear you)[^.!?]{0,80})[\.,!]?\s+what could james\b/i,
  );
  const ack = m?.[1]?.trim();
  return ack ? ack.replace(/\.$/, '') : null;
}

/**
 * Streaming may flush a partial James-differently clause (no `?`, missing tail, or garbled subject).
 */
export function isIncompleteScenarioBJamesDifferentlyLeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || /\?\s*$/.test(t)) return false;
  if (looksLikeScenarioBJamesDifferentlyQuestion(t)) return false;
  const low = t.toLowerCase();
  if (/\bwhat could james\b/.test(low)) return true;
  const hasCue =
    /\b(done differently|could have done|could'?ve done|before the fight|before things blew up|feel appreciated|might have helped)\b/.test(
      low,
    );
  if (!hasCue) return false;
  return !/\bjames\b/.test(low) || /\bwhat could\b/.test(low) || /\beven\s*$/i.test(t);
}

/**
 * When the user jumps ahead to a James repair plan on Q1, the model may truncate mid-redirect
 * ("already thinking as James. Before we"). Coerce to mandatory Q2 — never re-ask vignette Q1
 * and never complete Scenario B.
 */
export function coerceScenarioBPrematureRepairRedirectToJamesDifferently(text: string): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
  const shouldCoerce =
    isIncompleteScenarioBPrematureRepairRedirectLeadSentence(t) ||
    assistantTextLooksLikeScenarioBPrematureAnswerRedirect(t);
  if (!shouldCoerce) return t;
  const ack = extractBriefAckBeforeIncompleteScenarioBQ1(t);
  if (ack) return `${ack}. ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`;
  return `Got it. ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`;
}

export type ScenarioBJamesDifferentlyCoerceContext = {
  messages?: readonly MessageWithScenario[];
  interviewMoment?: number;
  streamSpokeS2Opening?: boolean;
  s2CanonicalPlaybackConfirmed?: boolean;
};

function lastScenarioBOpeningAssistantIndex(messages: readonly MessageWithScenario[]): number {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role !== 'assistant') continue;
    if ((messages[i] as { isWelcomeBack?: boolean }).isWelcomeBack) continue;
    const c = (messages[i].content ?? '').trim();
    if (
      isScenarioBQ1Prompt(c) ||
      looksLikeScenarioBQ1Question(c) ||
      (textContainsScenarioBVignetteBody(c) && /\?\s*$/.test(c))
    ) {
      return i;
    }
  }
  return -1;
}

/** True when S2 Q1 (or vignette+opening) was delivered but the user has not answered it yet. */
export function scenarioBOpeningAwaitingFirstUserAnswer(
  messages: readonly MessageWithScenario[],
): boolean {
  const openingIdx = lastScenarioBOpeningAssistantIndex(messages);
  if (openingIdx < 0) return false;
  for (let i = openingIdx + 1; i < messages.length; i += 1) {
    if (messages[i].role !== 'user') continue;
    if ((messages[i] as { isWelcomeBack?: boolean }).isWelcomeBack) continue;
    if ((messages[i].content ?? '').trim()) return false;
  }
  return true;
}

function hasScenarioBUserAnswerAfterOpening(messages: readonly MessageWithScenario[]): boolean {
  const openingIdx = lastScenarioBOpeningAssistantIndex(messages);
  if (openingIdx >= 0) {
    for (let i = openingIdx + 1; i < messages.length; i += 1) {
      if (messages[i].role !== 'user') continue;
      if ((messages[i] as { isWelcomeBack?: boolean }).isWelcomeBack) continue;
      if ((messages[i].content ?? '').trim()) return true;
    }
    return false;
  }
  return messages.some(
    (m) =>
      m.role === 'user' &&
      m.scenarioNumber === 2 &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      (m.content ?? '').trim(),
  );
}

/** S1→S2 transition: opening may exist only in stream playback, not yet in transcript. */
export function shouldSuppressPrematureScenarioBJamesQ2Coercion(
  ctx: ScenarioBJamesDifferentlyCoerceContext,
): boolean {
  const messages = ctx.messages ?? [];
  const s2OpeningDeliveredViaStream =
    ctx.s2CanonicalPlaybackConfirmed === true || ctx.streamSpokeS2Opening === true;

  if (scenarioBOpeningAwaitingFirstUserAnswer(messages)) return true;

  if (s2OpeningDeliveredViaStream && !hasScenarioBUserAnswerAfterOpening(messages)) {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const onS1ToS2Transition =
      ctx.interviewMoment === 1 ||
      ctx.s2CanonicalPlaybackConfirmed === true ||
      (!!lastUser &&
        (lastUser.scenarioNumber === 1 || lastUser.scenarioNumber == null));
    if (onS1ToS2Transition) return true;
  }

  if (ctx.interviewMoment !== 2) return false;
  if (!s2OpeningDeliveredViaStream) return false;
  /** Once the user has answered S2 Q1, never strip Q2 based on a stale S1 repair pairing. */
  if (hasScenarioBUserAnswerAfterOpening(messages)) return false;

  const repairCtx = findLastUserWithPriorScenarioARepairContext(messages);
  if (
    repairCtx.lastUserContent &&
    repairCtx.priorRepairAssistantContent &&
    userAnswerSatisfiesScenarioARepairPrompt(
      repairCtx.lastUserContent,
      repairCtx.priorRepairAssistantContent,
    )
  ) {
    return true;
  }
  return false;
}

export function lastScenarioBUserAnswerContent(messages?: readonly MessageWithScenario[]): string {
  if (!messages?.length) return '';
  return [...messages].reverse().find((m) => m.role === 'user')?.content?.trim() ?? '';
}

/** User turns since Scenario B vignette / Q1 — blocks premature S2→S3 after a single answer. */
export function countScenarioBUserTurns(messages: readonly MessageWithScenario[]): number {
  let count = 0;
  let sawS2Start = false;
  for (const m of messages) {
    if (m.role === 'assistant') {
      const content = m.content ?? '';
      if (textContainsScenarioBVignetteBody(content) || looksLikeScenarioBQ1Question(content)) {
        sawS2Start = true;
      }
    }
    if (m.role === 'user' && sawS2Start) {
      count += 1;
    }
  }
  if (count > 0) return count;
  return messages.filter((m) => m.role === 'user' && m.scenarioNumber === 2).length;
}

export function scenarioBMinimumEngagementForHandoff(messages: readonly MessageWithScenario[]): boolean {
  const userTurns = countScenarioBUserTurns(messages);
  if (userTurns >= 2) return true;

  const jamesRepairCtx = findLastUserWithPriorScenarioBJamesRepairContext(messages);
  if (
    jamesRepairCtx.lastUserContent &&
    jamesRepairCtx.priorJamesRepairAssistantContent &&
    userAnswerSatisfiesScenarioBJamesRepairPrompt(
      jamesRepairCtx.lastUserContent,
      jamesRepairCtx.priorJamesRepairAssistantContent,
    )
  ) {
    return true;
  }

  const { lastUserContent, priorAssistantContent } = findLastUserWithPriorAssistantContent(messages);
  if (
    lastUserContent &&
    priorAssistantContent &&
    looksLikeScenarioBJamesDifferentlyQuestion(priorAssistantContent) &&
    !looksLikeScenarioBRepairAsJamesQuestion(priorAssistantContent) &&
    scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(lastUserContent)
  ) {
    return userTurns >= 1;
  }

  return false;
}

/**
 * Next scripted Scenario B beat when a premature S2→S3 handoff is blocked.
 * Prefer Q2 (James differently / before the fight) before Q3 (repair-as-James).
 */
export function resolveScenarioBNextRequiredFollowUpPrompt(
  messages: readonly MessageWithScenario[],
): string {
  const hasJamesDifferentlyOrAppreciation = messages.some(
    (m) =>
      m.role === 'assistant' &&
      looksLikeScenarioBJamesDifferentlyQuestion(m.content ?? '') &&
      !looksLikeScenarioBRepairAsJamesQuestion(m.content ?? ''),
  );
  if (!hasJamesDifferentlyOrAppreciation) {
    return SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
  }
  return SCENARIO_B_JAMES_REPAIR_CANONICAL;
}

/** Scenario B Q3 repair-as-James already answered — skip re-asking Q2 or Q3. */
export function scenarioBJamesRepairProbeAlreadySatisfied(
  messages: readonly MessageWithScenario[],
): boolean {
  const jamesRepairCtx = findLastUserWithPriorScenarioBJamesRepairContext(messages);
  if (
    jamesRepairCtx.lastUserContent &&
    jamesRepairCtx.priorJamesRepairAssistantContent &&
    userAnswerSatisfiesScenarioBJamesRepairPrompt(
      jamesRepairCtx.lastUserContent,
      jamesRepairCtx.priorJamesRepairAssistantContent,
    )
  ) {
    return true;
  }

  const { lastUserContent, priorAssistantContent } = findLastUserWithPriorAssistantContent(messages);
  if (!lastUserContent?.trim() || !priorAssistantContent?.trim()) {
    return false;
  }

  /** Concrete repair answer to Q2 (differently) — even when repair Q3 was spoken but not transcript-persisted. */
  if (
    looksLikeScenarioBJamesDifferentlyQuestion(priorAssistantContent) &&
    !looksLikeScenarioBRepairAsJamesQuestion(priorAssistantContent) &&
    userAnswerSatisfiesScenarioBJamesRepairPrompt(lastUserContent, priorAssistantContent)
  ) {
    return true;
  }

  return false;
}

export type PrepareScenarioBEmotionAfterModalArgs = ScenarioBJamesDifferentlyCoerceContext & {
  scenarioJustCompleted?: 1 | 2 | 3;
  streamAlreadySpokeBefore?: boolean;
};

/** Sanitize or skip emotion-modal afterModal when stream already delivered S2 Q1. */
export function prepareScenarioBEmotionAfterModalForTts(
  afterModal: string,
  ctx: PrepareScenarioBEmotionAfterModalArgs,
): string {
  const raw = (afterModal ?? '').trim();
  if (!raw) return '';

  const streamConfirmedS2Opening =
    ctx.scenarioJustCompleted === 1 &&
    ctx.streamAlreadySpokeBefore === true &&
    (ctx.s2CanonicalPlaybackConfirmed === true || ctx.streamSpokeS2Opening === true);

  if (streamConfirmedS2Opening && shouldSuppressPrematureScenarioBJamesQ2Coercion(ctx)) {
    return '';
  }

  if (!shouldSuppressPrematureScenarioBJamesQ2Coercion(ctx)) {
    return raw;
  }

  let prepared = coerceScenarioBJamesDifferentlyQuestionForTts(raw, ctx);
  prepared = stripPrematureScenarioBJamesQ2FromAssistantDraft(prepared);
  if (looksLikeScenarioBJamesDifferentlyQuestion(prepared) && !looksLikeScenarioBQ1Question(prepared)) {
    return '';
  }
  return prepared.trim();
}

/** Remove premature James Q2 sentences from a multi-part assistant draft. */
export function stripPrematureScenarioBJamesQ2FromAssistantDraft(text: string): string {
  if (!text?.trim()) return text;
  const kept = text
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part.length > 0 &&
        !looksLikeScenarioBJamesDifferentlyQuestion(part) &&
        !isIncompleteScenarioBJamesDifferentlyLeadSentence(part),
    );
  return kept.join('\n\n').trim();
}

/** Replace truncated / garbled James-differently asks with the canonical scripted Q2. */
export function coerceScenarioBJamesDifferentlyQuestionForTts(
  text: string,
  ctx?: ScenarioBJamesDifferentlyCoerceContext,
): string {
  return withSkipAcceptedNextQuestionBridgePreserved(text, (raw) => {
  const t = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
  const suppressPrematureQ2 = ctx && shouldSuppressPrematureScenarioBJamesQ2Coercion(ctx);
  if (suppressPrematureQ2) {
    const userJumpedAheadWithRepair = scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(
      lastScenarioBUserAnswerContent(ctx?.messages),
    );
    if (
      userJumpedAheadWithRepair &&
      looksLikeScenarioBJamesDifferentlyQuestion(t) &&
      hasScenarioBUserAnswerAfterOpening(ctx?.messages ?? [])
    ) {
      return t;
    }
    if (looksLikeScenarioBJamesDifferentlyQuestion(t) && !looksLikeScenarioBQ1Question(t)) {
      return stripPrematureScenarioBJamesQ2FromAssistantDraft(t);
    }
    if (
      isIncompleteScenarioBJamesDifferentlyLeadSentence(t) ||
      isIncompleteScenarioBPrematureRepairRedirectLeadSentence(t) ||
      assistantTextLooksLikeScenarioBPrematureAnswerRedirect(t)
    ) {
      return stripPrematureScenarioBJamesQ2FromAssistantDraft(t);
    }
  }
  if (isIncompleteScenarioBPrematureRepairRedirectLeadSentence(t)) {
    return coerceScenarioBPrematureRepairRedirectToJamesDifferently(t);
  }
  if (looksLikeScenarioBJamesDifferentlyQuestion(t)) {
    if (
      isBeforeFightOnlyScenarioBJamesQ2Paraphrase(t) ||
      !isDeliveredScenarioBJamesDifferentlyProbe(t)
    ) {
      const ack = extractBriefAckBeforeIncompleteJamesProbe(t);
      if (ack) return `${ack}. ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`;
      return SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
    }
  }
  if (isIncompleteScenarioBJamesDifferentlyLeadSentence(t)) {
    const ack = extractBriefAckBeforeIncompleteJamesProbe(t);
    if (ack) return `${ack}. ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`;
    return SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
  }
  if (
    looksLikeScenarioBJamesSayToJamesRolePlayQuestion(t) ||
    isIncompleteScenarioBJamesSayToJamesLeadSentence(t)
  ) {
    return coerceScenarioBJamesSayToJamesQuestionForTts(t, false);
  }
  if (
    /\b(done differently|before the fight|before things blew up)\b/i.test(t) &&
    !/\bjames\b/i.test(t)
  ) {
    return SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
  }
  return t;
  });
}

/** Off-script James role-play elicitation (e.g. "How would you actually say that to James?") — not Q2/Q3 canonical. */
export function looksLikeScenarioBJamesSayToJamesRolePlayQuestion(text: string): boolean {
  const low = (text ?? '').toLowerCase();
  if (!/\bjames\b/.test(low) || /\brepair\b/.test(low)) return false;
  return (
    (/\bhow would you\b/.test(low) && /\b(say that|actually say|say it|put that)\b/.test(low)) ||
    (/\bwhat would you say\b/.test(low) && /\bto james\b/.test(low))
  );
}

/**
 * Streaming cutoff for off-script "say that to James" asks (e.g. "…to james what" with no `?`).
 * Also matches complete off-script variants so they can be coerced to canonical Q2/Q3.
 */
export function isIncompleteScenarioBJamesSayToJamesLeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (looksLikeScenarioBJamesSayToJamesRolePlayQuestion(t)) {
    return !/\?\s*$/.test(t) || t.split(/\s+/).filter(Boolean).length < 8;
  }
  const low = t.toLowerCase();
  if (/\brepair\b/.test(low) || !/\bjames\b/.test(low)) return false;
  return /\bhow would you\b/.test(low) && /\b(say|actually)\b/.test(low);
}

/** Replace off-script / truncated "say that to James" with canonical Q2 or Q3 (one question only). */
export function coerceScenarioBJamesSayToJamesQuestionForTts(
  text: string,
  preferRepair = false,
): string {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) {
    return preferRepair ? SCENARIO_B_JAMES_REPAIR_CANONICAL : SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
  }
  if (
    !looksLikeScenarioBJamesSayToJamesRolePlayQuestion(t) &&
    !isIncompleteScenarioBJamesSayToJamesLeadSentence(t)
  ) {
    return t;
  }
  const preferRepairFromText =
    preferRepair ||
    looksLikeScenarioBRepairAsJamesQuestion(t) ||
    isIncompleteScenarioBJamesRepairLeadSentence(t);
  const canonical = preferRepairFromText
    ? SCENARIO_B_JAMES_REPAIR_CANONICAL
    : SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL;
  const ack =
    extractBriefAckBeforeIncompleteJamesProbe(t) ??
    extractBriefAckBeforeIncompleteJamesRepairProbe(t);
  if (ack) return `${ack}. ${canonical}`;
  return canonical;
}

/**
 * When the model emits a truncated "say that to James" line and repair Q3 in one turn,
 * collapse to a single canonical question so the user is not double-prompted.
 */
export function collapseScenarioBJamesSayToJamesWithRepairDuplicate(
  text: string,
  preferRepair = false,
): string {
  const paragraphs = (text ?? '')
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (paragraphs.length <= 1) {
    return coerceScenarioBJamesSayToJamesQuestionForTts(
      (text ?? '').replace(/\s+/g, ' ').trim(),
      preferRepair,
    );
  }
  const sayToJamesParagraph = paragraphs.find(
    (p) =>
      looksLikeScenarioBJamesSayToJamesRolePlayQuestion(p) ||
      isIncompleteScenarioBJamesSayToJamesLeadSentence(p),
  );
  const hasRepair = paragraphs.some((p) => looksLikeScenarioBRepairAsJamesQuestion(p));
  if (!sayToJamesParagraph || !hasRepair) {
    return coerceScenarioBJamesSayToJamesQuestionForTts(
      (text ?? '').replace(/\s+/g, ' ').trim(),
      preferRepair,
    );
  }
  return coerceScenarioBJamesSayToJamesQuestionForTts(sayToJamesParagraph, true);
}

/** Brief ack before a truncated James-repair probe (e.g. "Got it. And if you were James, how would you repair things now that"). */
function extractBriefAckBeforeIncompleteJamesRepairProbe(text: string): string | null {
  const m = text.match(
    /^((?:got it|that'?s (?:a )?real read on it|good read|great read|nice work|that makes sense|you(?:'re| are) seeing that|i hear you|makes sense)[^.!?]{0,80})[\.,!]?\s+(?:and\s+)?(?:if you were james|how would you)\b/i,
  );
  const ack = m?.[1]?.trim();
  return ack ? ack.replace(/\.$/, '') : null;
}

/**
 * Streaming may flush a partial James-repair clause (no `?`, dangling "now that", or garbled tail).
 */
export function isIncompleteScenarioBJamesRepairLeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || /\?\s*$/.test(t)) return false;
  if (looksLikeScenarioBJamesDifferentlyQuestion(t)) return false;
  const low = t.toLowerCase();
  const hasJamesRepairCue =
    (/\bif you were james\b/.test(low) &&
      /\b(repair|fix|make it right|make things right|patch things|apologize|mend|make up|sort (?:this|it) out)\b/.test(
        low,
      )) ||
    (/\bhow would you\b/.test(low) && /\bjames\b/.test(low) && /\brepair\b/.test(low));
  if (!hasJamesRepairCue) return false;
  return true;
}

/** Legacy third-person James repair (not role-switch) — coerce to canonical Q3. */
export function looksLikeScenarioBLegacyThirdPersonJamesRepairQuestion(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t || /\bif you were james\b/.test(t)) return false;
  if (/\bhow would james go about repair/i.test(t)) return true;
  if (/\bhow would james\b/.test(t) && /\b(repair|repairing|repairs)\b/.test(t)) return true;
  if (
    /\bhow would james\b/.test(t) &&
    /\bwith sarah\b/.test(t) &&
    /\b(fight|repair|repairing)\b/.test(t)
  ) {
    return true;
  }
  return false;
}

/** Replace truncated / garbled James-repair asks with the canonical scripted Q3. */
export function coerceScenarioBJamesRepairQuestionForTts(text: string): string {
  return withSkipAcceptedNextQuestionBridgePreserved(text, (raw) => {
  const t = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return SCENARIO_B_JAMES_REPAIR_CANONICAL;
  if (looksLikeScenarioBLegacyThirdPersonJamesRepairQuestion(t)) {
    const ack = extractBriefAckBeforeIncompleteJamesRepairProbe(t);
    return ack ? `${ack}. ${SCENARIO_B_JAMES_REPAIR_CANONICAL}` : `Got it. ${SCENARIO_B_JAMES_REPAIR_CANONICAL}`;
  }
  if (looksLikeScenarioBRepairAsJamesQuestion(t) && /\?\s*$/.test(t)) {
    const ack = extractBriefAckBeforeIncompleteJamesRepairProbe(t);
    if (ack) return `${ack}. ${SCENARIO_B_JAMES_REPAIR_CANONICAL}`;
    if (t.toLowerCase() !== SCENARIO_B_JAMES_REPAIR_CANONICAL.toLowerCase()) {
      return SCENARIO_B_JAMES_REPAIR_CANONICAL;
    }
    return t;
  }
  if (isIncompleteScenarioBJamesRepairLeadSentence(t)) {
    const ack = extractBriefAckBeforeIncompleteJamesRepairProbe(t);
    if (ack) return `${ack}. ${SCENARIO_B_JAMES_REPAIR_CANONICAL}`;
    return SCENARIO_B_JAMES_REPAIR_CANONICAL;
  }
  return t;
  });
}

/** Canonical Scenario B Q3 — client inject when the model closes early after James-differently. */
export const SCENARIO_B_JAMES_REPAIR_CANONICAL = 'And if you were James, how would you repair?';

/** Scenario B Q3 — repair in James's shoes. */
export function looksLikeScenarioBRepairAsJamesQuestion(text: string): boolean {
  const t = text.toLowerCase();
  const asJames =
    /\bif you were james\b/.test(t) &&
    /\b(repair|fix|make it right|apologize|patch things|make up|mend|handle|approach|smooth|sort (this|it) out|navigate|move forward)\b/.test(
      t,
    );
  const howRepairJames =
    /\bhow would you\b/.test(t) &&
    /\bjames\b/.test(t) &&
    /\b(repair|fix|make things right|make it right|patch things|apologize|mend|make up)\b/.test(t);
  const compact =
    t.length < 200 &&
    /\bjames\b/.test(t) &&
    /\b(you were|as james|if you were)\b/.test(t) &&
    /\b(repair|fix|make things right|make it right|patch things|apologize|mend|make up|sort (this|it) out|navigate|move forward)\b/.test(
      t,
    );
  const howJamesRepairThirdPerson =
    /\bhow would james\b/.test(t) &&
    /\b(repair|repairing|repairs|fix|make it right|make things right|patch things|apologize|mend|make up|sort (this|it) out)\b/.test(
      t,
    );
  return asJames || howRepairJames || howJamesRepairThirdPerson || compact;
}

/** Model jumped to Scenario C (or completion) without asking what James could have done differently first. */
export function looksLikeAssistantSkipsScenarioBJamesIntermediateQuestion(text: string): boolean {
  if (looksLikeScenarioBJamesDifferentlyQuestion(text)) return false;
  const t = text.toLowerCase();
  if (/\[scenario_complete:2\]/i.test(text)) return true;
  return (
    t.includes('sophie and daniel') ||
    ((t.includes("i didn't know what to say") || t.includes("i didn't know how")) && t.includes('sophie')) ||
    (t.includes('third situation') && t.includes('sophie')) ||
    (t.includes("here's the third situation") && t.includes('personal'))
  );
}

export function stripScenarioBRepairAsJamesQuestion(text: string): string {
  return text
    .replace(/(?:^|\n)\s*If you were James,?\s+how would you repair\??\s*/gi, '\n')
    .replace(
      /(?:^|\n)\s*How would you repair[^?.!\n]*if you were James[^?.!\n]*[?.!]?\s*/gi,
      '\n',
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Last user turn in `messages` with the assistant message they were answering. */
export function findLastUserWithPriorAssistantContent(messages: MessageWithScenario[]): {
  lastUserContent: string | null;
  priorAssistantContent: string | null;
} {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role !== 'user') continue;
    const lastUserContent = (messages[i].content ?? '').trim();
    let priorAssistantContent: string | null = null;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (messages[j].role === 'assistant') {
        priorAssistantContent = messages[j].content ?? '';
        break;
      }
    }
    return { lastUserContent, priorAssistantContent };
  }
  return { lastUserContent: null, priorAssistantContent: null };
}

/**
 * True when the user's answer to Scenario B Q2 (James differently) or the optional full appreciation probe
 * already contains repair-oriented content, so Q3 (repair-as-James) should not fire.
 */
const SCENARIO_B_JAMES_REPAIR_SUBSTANCE_PATTERN =
  /\b(repair|apolog|fix|make (it|things) right|patch|mend|make up|sort (?:this|it) out|comfort|listen|celebrat|appreciat|acknowledg|reflect|assure|sorry|hear you|understand|better in the future|try to be better)\w*\b/i;

/** User cut off mid James-repair clause (e.g. session log: "If I were James, I would..."). */
export function isIncompleteScenarioBJamesRepairUserAnswer(answer: string): boolean {
  const t = normalizeApostrophesForPromptMatch(answer).replace(/\s+/g, ' ').trim();
  if (!t) return true;
  const low = t.toLowerCase();
  const hasJamesRoleSwitch =
    /\bif i were james\b/.test(low) || /\b(as james|being james)\b/.test(low);
  if (!hasJamesRoleSwitch) return false;
  if (SCENARIO_B_JAMES_REPAIR_SUBSTANCE_PATTERN.test(t)) return false;
  if (/\.{2,}\s*$/.test(t)) return true;
  if (/\b(i'?d|i would|i will)\s*[\.,…]*\s*$/i.test(t)) return true;
  return t.split(/\s+/).filter(Boolean).length <= 8;
}

export function scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(answer: string): boolean {
  const t = normalizeApostrophesForPromptMatch(answer).toLowerCase().trim();
  if (!t) return false;
  if (isIncompleteScenarioBJamesRepairUserAnswer(answer)) return false;

  const hasRepairSubstance = SCENARIO_B_JAMES_REPAIR_SUBSTANCE_PATTERN.test(t);

  /** Q3 skip only when the user already answered in James's shoes — not third-person Q2 prescriptions. */
  const firstPersonJamesRepair =
    ((/\bif i were james\b/i.test(t) || /\b(as james|being james)\b/i.test(t)) &&
      hasRepairSubstance) ||
    (/\b(i'?d|i would|i will)\b/i.test(t) &&
      hasRepairSubstance &&
      /\b(james|sarah|her|him)\b/i.test(t));

  const explicitRepairAsJames =
    /\bhow i would repair\b/i.test(t) ||
    (/\bi would (?:try to )?repair\b/i.test(t) && /\b(as james|if i were james)\b/i.test(t));

  return firstPersonJamesRepair || explicitRepairAsJames;
}

/**
 * User answered Scenario B Q2 (what James could have done differently) while still on Q1.
 * Participants cannot know the scripted order — accept and advance within the scenario.
 */
export function userAnswerLooksLikeAheadOfScheduleScenarioBJamesDifferentlyOnQ1(
  answer: string,
): boolean {
  if (scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(answer)) return false;
  const t = normalizeApostrophesForPromptMatch(answer).toLowerCase().trim();
  if (!t || !/\bjames\b/.test(t)) return false;
  const thirdPersonPrescription =
    /\b(james|he)\b/.test(t) &&
    /\b(could have|could'?ve|should have|should'?ve|would have|would'?ve)\b/.test(t) &&
    /\b(done differently|said|told|celebrat|appreciat|listen|comfort|met her|pushed|deadline|happy for|acknowledg)\w*\b/.test(
      t,
    );
  const explicitJamesDiff =
    /\bwhat james could\b/.test(t) ||
    /\banything james could\b/.test(t) ||
    /\bjames could have done\b/.test(t);
  return thirdPersonPrescription || explicitJamesDiff;
}

/** True when the user jumped ahead to a later Scenario B construct on vignette Q1. */
export function userAnswerLooksLikeAheadOfScheduleScenarioBOnQ1(answer: string): boolean {
  return (
    scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(answer) ||
    userAnswerLooksLikeAheadOfScheduleScenarioBJamesDifferentlyOnQ1(answer)
  );
}

/**
 * Model redirect when the user answered a later Scenario B question before it was asked.
 * Participant has no knowledge of future scripted questions — coerce to the next mandatory beat.
 */
export function assistantTextLooksLikeScenarioBPrematureAnswerRedirect(text: string): boolean {
  const low = normalizeApostrophesForPromptMatch(text).toLowerCase().trim();
  if (!low) return false;
  const strongAheadCue =
    /\b(good answer for where we'?re heading|actually what i'?ll ask you about in a moment|already thinking as james)\b/.test(
      low,
    );
  if (!strongAheadCue) return false;
  return /\b(but first|first though|before we|what do you think is going on|what do you think caused)\b/.test(
    low,
  );
}

export function lastAssistantPromptIsScenarioBQ1OrPrematureRedirect(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  return (
    isScenarioBQ1Prompt(t) ||
    looksLikeScenarioBQ1Question(t) ||
    isIncompleteScenarioBQ1LeadSentence(t) ||
    isIncompleteScenarioBPrematureRepairRedirectLeadSentence(t) ||
    assistantTextLooksLikeScenarioBPrematureAnswerRedirect(t)
  );
}

/** Scenario B Q3 skipped when Q2 / appreciation answer already contains repair-oriented content. */
export function shouldSkipScenarioBRepairAsJamesProbe(
  messages: MessageWithScenario[],
  assistantDraft: string,
  interviewMoment: number,
): boolean {
  if (interviewMoment !== 2) return false;
  if (!assistantDraft.trim()) return false;
  if (!looksLikeScenarioBRepairAsJamesQuestion(assistantDraft)) return false;

  if (scenarioBJamesRepairProbeAlreadySatisfied(messages)) {
    return true;
  }

  const { lastUserContent, priorAssistantContent } = findLastUserWithPriorAssistantContent(messages);
  if (!lastUserContent || !priorAssistantContent) return false;

  const prior = priorAssistantContent;
  const priorIsJamesDiffOrAppreciation =
    (looksLikeScenarioBJamesDifferentlyQuestion(prior) || looksLikeScenarioBFullAppreciationProbeQuestion(prior)) &&
    !looksLikeScenarioBRepairAsJamesQuestion(prior);

  if (!priorIsJamesDiffOrAppreciation) return false;
  return scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(lastUserContent);
}

export function shouldReplaceScenarioBRepairWithSkipAndScenario3Transition(
  messages: MessageWithScenario[],
  strippedAssistantDraft: string,
  interviewMoment: number,
): boolean {
  return shouldSkipScenarioBRepairAsJamesProbe(messages, strippedAssistantDraft, interviewMoment);
}

/**
 * Streaming may flush a partial Scenario B boundary wrap (reflection + segment close) without the S3 vignette.
 */
export function isIncompleteScenarioBBoundaryClosureLeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || /\?\s*$/.test(t)) return false;
  if (textContainsScenarioCVignetteBody(t)) return false;
  if (/\b(?:here'?s the third situation|on to the third situation)\b/i.test(t)) return false;
  const low = t.toLowerCase();
  const hasClosureLead =
    /\bthat situation is complete\b/.test(low) ||
    /\bthat scenario is complete\b/.test(low) ||
    /\bthat'?s the end of that situation\b/.test(low) ||
    /\bwhat i (?:heard|got) was\b/.test(low) ||
    /\bi can see that\b/.test(low) ||
    /\bso (?:your|for you,? (?:the )?(?:read|repair|instinct))\b/.test(low) ||
    /\bso your (?:read|repair|instinct)\b/.test(low);
  if (!hasClosureLead) return false;
  return !looksLikeAssistantSkipsScenarioBJamesIntermediateQuestion(t);
}

/**
 * S2→S3 transition copy (reflection + third-situation lead), not S3→Moment-4 personal card.
 * Shared boundary phrases like "what I heard was" also appear on valid S2→S3 handoffs.
 */
export function isScenarioBToScenario3HandoffText(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (textContainsScenarioCVignetteBody(t)) return true;
  const low = t.toLowerCase();
  if (/\b(?:held a grudge|really hard time with|got under your skin)\b/.test(low)) return false;
  if (/\bfinished the three situations\b/.test(low)) return false;
  if (/\bend of the three described situations\b/.test(low)) return false;
  if (/\bsophie and daniel\b/.test(low) && /\bhave had the same argument\b/.test(low)) return true;
  return (
    /\bhere'?s the third situation\b/.test(low) ||
    /\bon to the third situation\b/.test(low) ||
    (/\bthat scenario is complete\b/.test(low) && /\bthird situation\b/.test(low)) ||
    (/\bmove to something more personal\b/.test(low) && /\bthird situation\b/.test(low))
  );
}

export function isScenarioBBoundaryReflectionWithoutNextVignette(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || textContainsScenarioCVignetteBody(t)) return false;
  /** Sarah/James vignette present — complete S1→S2 handoff, not an incomplete S2→S3 wrap. */
  if (textContainsScenarioBVignetteBody(t)) return false;
  const low = t.toLowerCase();
  /** S1→S2 transition copy — not an incomplete Scenario B→C boundary. */
  if (/\bwe'?ve got two more situations\b/.test(low) && !/\bsecond one done\b/.test(low)) {
    return false;
  }
  if (
    /\bthat'?s a wrap on that one\b/.test(low) &&
    !/\bsecond one done\b/.test(low) &&
    !/\bone more situation and then we'?ll get personal\b/.test(low)
  ) {
    return false;
  }
  /** Scenario A Ryan/Emma wrap — not an incomplete Scenario B→C boundary. */
  if (
    /\b(ryan|emma)\b/.test(low) &&
    !/\b(sarah|james)\b/.test(low) &&
    hasScenarioBoundaryWrapPhrase(t)
  ) {
    return false;
  }
  if (/\b(?:here'?s the third situation|on to the third situation)\b/.test(low)) return false;
  /** S3→M4 boundary uses the same reflection openers — not an incomplete S2→S3 wrap. */
  if (/\bend of the three described situations\b/.test(low)) return false;
  if (/\btwo questions left\b/.test(low) && /\bmore personal\b/.test(low)) return false;
  if (/\b(?:held a grudge|really hard time with|got under your skin)\b/.test(low)) return false;
  if (assistantTextLooksLikeMoment4HandoffLead(t)) return false;
  if (isScenarioBoundaryPositiveAddressReflection(t)) return true;
  return (
    hasScenarioBoundaryWrapPhrase(t) ||
    /\bthat'?s the end of that situation\b/.test(low) ||
    /\bwhat i (?:heard|got) was\b/.test(low) ||
    /\bwhat came through was\b/.test(low) ||
    /\bwhat landed for me was\b/.test(low) ||
    /\byou (?:saw|recognized|picked up on|read|focused(?:\s+on)?)\b/.test(low) ||
    /\bi can see that\b/.test(low) ||
    isIncompleteScenarioBBoundaryClosureLeadSentence(t)
  );
}

export const SCENARIO_B_Q1_CANONICAL = SHOW_SCENARIO_2_OPENING_EXACT;

export function isScenarioBQ1Prompt(text: string): boolean {
  const t = normalizeApostrophesForPromptMatch(text).toLowerCase();
  return t.includes('what do you think is going on here');
}

/** Complete S2 Q1 paraphrase (Sarah/James mentalizing) — not the exact scripted opening. */
export function looksLikeScenarioBQ1Question(text: string): boolean {
  if (isScenarioBQ1Prompt(text)) return true;
  const t = normalizeApostrophesForPromptMatch(text).toLowerCase();
  if (!/\bwhat do you think is going on\b/.test(t)) return false;
  return (
    /\bbetween sarah and james\b/.test(t) ||
    /\bin that situation\b/.test(t) ||
    /\?\s*$/.test((text ?? '').trim())
  );
}

/** Brief ack before truncated S2 Q1 (e.g. "I hear you — and I'll get to that. But first, what do you think caused"). */
function extractBriefAckBeforeIncompleteScenarioBQ1(text: string): string | null {
  const normalized = normalizeApostrophesForPromptMatch(text);
  const m = normalized.match(
    /^((?:i hear you(?:\s*[—–-]\s*and i'?ll get to that)?|got it(?:\s*[—–-]\s*(?:that sounds like you(?:'re| are) already thinking as james|that'?s actually what i'?ll ask you about in a moment|that'?s a good answer for where we'?re heading))?|that makes sense|good read|great read|nice work|you(?:'re| are) seeing that|makes sense)[^.!?]{0,120})[\.,!]?\s+(?:but first,?|first though,?\s+)?(?:before we\b|what do you think\b)/i,
  );
  const ack = m?.[1]?.trim();
  if (ack) return ack.replace(/\.$/, '');
  const hearYouLead = normalized.match(
    /^(i hear you(?:\s*[—–-]\s*and i'?ll get to that)?)\s*[.,!]/i,
  );
  if (hearYouLead?.[1]) return hearYouLead[1].trim();
  return null;
}

/**
 * Model redirect when the user jumped ahead to repair-as-James before Q2/Q3 were asked
 * (e.g. "Got it — that sounds like you're already thinking as James. Before we").
 */
export function isIncompleteScenarioBPrematureRepairRedirectLeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || /\?\s*$/.test(t)) return false;
  if (looksLikeScenarioBJamesDifferentlyQuestion(t) || looksLikeScenarioBRepairAsJamesQuestion(t)) {
    return false;
  }
  const low = normalizeApostrophesForPromptMatch(t).toLowerCase();
  if (/\bbefore we\s*$/i.test(t)) return true;
  if (/\bbefore we move\b/i.test(low) && !/\?\s*$/.test(t)) return true;
  if (/\balready thinking as james\b/i.test(t)) return true;
  if (/\bthat'?s actually what i'?ll ask\b/i.test(low) && /\bbefore we\b/i.test(low)) return true;
  if (/\bi'?ll get to that\b/i.test(low) && /\bbefore we\b/i.test(low)) return true;
  if (/\bgood answer for where we'?re heading\b/i.test(low)) return true;
  return false;
}

/**
 * Streaming may flush a partial S2 Q1 clause when redirecting premature repair answers
 * (no `?`, dangling "what do you think caused", or Sarah/James paraphrase cutoff).
 */
export function isIncompleteScenarioBQ1LeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || /\?\s*$/.test(t)) return false;
  if (looksLikeScenarioBQ1Question(t) || isScenarioBQ1Prompt(t)) return false;
  if (looksLikeScenarioBJamesDifferentlyQuestion(t) || looksLikeScenarioBRepairAsJamesQuestion(t)) {
    return false;
  }
  const low = t.toLowerCase();
  if (/\bwhat do you think caused\b/.test(low)) return true;
  if (/\bwhat do you think is going on\b/.test(low)) return true;
  if (/\bi'?ll get to that\b/.test(low) && /\bbut first\b/.test(low)) return true;
  if (/\bthat'?s actually what i'?ll ask you about\b/.test(low) && /\bbut first\b/.test(low)) {
    return true;
  }
  if (isIncompleteScenarioBPrematureRepairRedirectLeadSentence(t)) return true;
  return false;
}

/** Replace truncated / garbled S2 Q1 asks with the canonical scripted opening question. */
export function coerceScenarioBQ1QuestionForTts(text: string): string {
  return withSkipAcceptedNextQuestionBridgePreserved(text, (raw) => {
  const t = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return SCENARIO_B_Q1_CANONICAL;
  /** Jump-ahead repair on vignette Q1 → mandatory Q2, not another pass at Q1. */
  if (
    isIncompleteScenarioBPrematureRepairRedirectLeadSentence(t) ||
    assistantTextLooksLikeScenarioBPrematureAnswerRedirect(t)
  ) {
    return coerceScenarioBPrematureRepairRedirectToJamesDifferently(t);
  }
  if (looksLikeScenarioBQ1Question(t) && /\?\s*$/.test(t) && !isScenarioBQ1Prompt(t)) {
    const ack = extractBriefAckBeforeIncompleteScenarioBQ1(t);
    if (ack) return `${ack}. ${SCENARIO_B_Q1_CANONICAL}`;
    return SCENARIO_B_Q1_CANONICAL;
  }
  if (isIncompleteScenarioBQ1LeadSentence(t)) {
    const ack = extractBriefAckBeforeIncompleteScenarioBQ1(t);
    if (ack) return `${ack}. ${SCENARIO_B_Q1_CANONICAL}`;
    return SCENARIO_B_Q1_CANONICAL;
  }
  return t;
  });
}

export function userSidesEntirelyWithJames(text: string): boolean {
  const t = text.toLowerCase();
  const blamesSarah =
    /\b(sarah (is|was) (too|overly)? ?(sensitive|dramatic|overreacting)|sarah should( have)? just|sarah is the problem)\b/.test(
      t,
    );
  const jamesOnlyRight =
    /\b(james (did nothing wrong|was right|handled it fine)|nothing james could do|james was fine)\b/.test(t);
  return blamesSarah || jamesOnlyRight;
}

function priorScenarioBAssistantTurns(msgs: readonly MessageWithScenario[]) {
  return msgs.filter(
    (m) =>
      m.role === 'assistant' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      !(m as { isScoreCard?: boolean }).isScoreCard,
  );
}

function transcriptAlreadyContainsScenarioBRepairAsJamesQuestion(
  msgs: readonly MessageWithScenario[],
): boolean {
  return priorScenarioBAssistantTurns(msgs).some((m) =>
    looksLikeScenarioBRepairAsJamesQuestion((m as { content?: string }).content ?? ''),
  );
}

/** Force canonical James repair Q3 after a substantive answer to James-differently Q2. */
export function shouldForceScenarioBJamesRepairProbe(params: {
  currentMoment: number;
  messages: readonly MessageWithScenario[];
  lastAssistantContent: string;
  userAnswer: string;
  suppressForcedConstructProbesForMetaFrustration: boolean;
}): boolean {
  if (params.suppressForcedConstructProbesForMetaFrustration) return false;
  if (params.currentMoment !== 2) return false;
  if (scenarioBJamesRepairProbeAlreadySatisfied(params.messages)) return false;
  if (isDecline(params.userAnswer)) return false;
  if (looksLikeIncompleteCutOffUserAnswer(params.userAnswer)) return false;
  if (!looksLikeScenarioBJamesDifferentlyQuestion(params.lastAssistantContent)) return false;
  if (transcriptAlreadyContainsScenarioBRepairAsJamesQuestion(params.messages)) return false;
  if (scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(params.userAnswer)) return false;
  return true;
}

/** Scripted Scenario B follow-ups that must never be treated as paraphrased show-scenario-card vignettes. */
export function isScenarioBScriptedProbeForTts(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  return (
    looksLikeScenarioBJamesDifferentlyQuestion(t) ||
    looksLikeScenarioBQ1Question(t) ||
    looksLikeScenarioBFullAppreciationProbeQuestion(t) ||
    looksLikeScenarioBRepairAsJamesQuestion(t)
  );
}

/** Parallel stream may carry a prior turn's long S2 handoff in spokenCompleteText while suppressing the current B probe. */
export function streamMissedScenarioBScriptedProbeDelivery(
  streamSpokenText: string,
  coercedAssistantText: string,
  ctx?: ScenarioBJamesDifferentlyCoerceContext,
): boolean {
  const coerced = (coercedAssistantText ?? '').trim();
  const spoken = (streamSpokenText ?? '').trim();
  if (!coerced) return false;
  if (looksLikeScenarioBJamesDifferentlyQuestion(coerced) && !looksLikeScenarioBJamesDifferentlyQuestion(spoken)) {
    if (ctx && shouldSuppressPrematureScenarioBJamesQ2Coercion(ctx)) {
      return false;
    }
    return true;
  }
  if (looksLikeScenarioBRepairAsJamesQuestion(coerced) && !looksLikeScenarioBRepairAsJamesQuestion(spoken)) {
    if (ctx?.messages && scenarioBJamesRepairProbeAlreadySatisfied(ctx.messages)) {
      return false;
    }
    return true;
  }
  if (
    ctx?.messages &&
    scenarioBJamesRepairProbeAlreadySatisfied(ctx.messages) &&
    looksLikeScenarioBJamesDifferentlyQuestion(coerced) &&
    !looksLikeScenarioBJamesDifferentlyQuestion(spoken)
  ) {
    return false;
  }
  if (looksLikeScenarioBQ1Question(coerced) && !looksLikeScenarioBQ1Question(spoken)) {
    return true;
  }
  return false;
}
