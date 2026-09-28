import { fetchInterviewWithinScenarioAckFromLlm } from '@features/aria/fetchInterviewWithinScenarioAckFromLlm';
import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import {
  chooseBriefScenarioAck,
  normalizeLeadingAck,
  recentAssistantMessagesForAck,
} from '@features/aria/interviewReflectionAckVariation';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { INTERVIEW_WITHIN_SCENARIO_ACK_LLM_ENABLED } from '@features/aria/interviewTurnOrchestratorConfig';
import {
  extractSalientReflectionClause,
  shortenLastInterviewerQuestionForFrustrationReask,
} from '@features/aria/metaCommentSkipFrustration';
import { countsAsSubstantiveInterviewQuestionDelivery } from '@features/aria/metaCommentClassification';
import { assessablePromptQuestionBody } from '@features/aria/interviewAssessablePromptText';
import {
  findLastRepeatableInterviewQuestionText,
  isNonRepeatableAssistantLineForVerbatimReplay,
  isRepeatableMainInterviewQuestionLine,
} from '@features/aria/interviewDisengagementTranscriptHelpers';
import { looksLikeCheckingInClientOwnedAckAssistantLine, looksLikeCheckingInSufficiencyAsk } from '@features/aria/metaCommentPatternScoring';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import {
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import { remoteLog } from '@utilities/remoteLog';

const CHECKING_IN_SUFFICIENCY_ACKS = [
  "Yes — that's enough.",
  'Yes — I heard you.',
  'Got it — that works.',
  'Yes — got it.',
] as const;

const CHECKING_IN_HEARD_YOU_ACKS = [
  'Yes — I heard you.',
  'Got it.',
  'Yes — got it.',
] as const;

/** Direct reply when user asks "wasn't that enough?" but the construct is not yet satisfied. */
const CHECKING_IN_NOT_YET_ACKS = [
  'Not quite — I still need a bit more.',
  "That's helpful — not quite what I need yet.",
  'I hear you — not quite yet.',
] as const;

function chooseRotatingAck(
  recentAssistant: MessageWithScenario[],
  pool: readonly string[],
): string {
  const lastAsst = [...recentAssistant].reverse().find((m) => m.role === 'assistant');
  const lastContent = typeof lastAsst?.content === 'string' ? lastAsst.content.trim() : '';
  const used = new Set<string>();
  for (const ack of pool) {
    const esc = ack.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`^${esc}`, 'i').test(lastContent)) used.add(ack);
  }
  const available = pool.filter((a) => !used.has(a));
  const pick = available.length ? available : [...pool];
  return pick[Math.floor(Math.random() * pick.length)]!;
}

function chooseCheckingInSufficiencyAck(recentAssistant: MessageWithScenario[]): string {
  return chooseRotatingAck(recentAssistant, CHECKING_IN_SUFFICIENCY_ACKS);
}

function chooseCheckingInHeardYouAck(recentAssistant: MessageWithScenario[]): string {
  return chooseRotatingAck(recentAssistant, CHECKING_IN_HEARD_YOU_ACKS);
}

function chooseCheckingInNotYetAck(recentAssistant: MessageWithScenario[]): string {
  return chooseRotatingAck(recentAssistant, CHECKING_IN_NOT_YET_ACKS);
}

function chooseCheckingInOwnershipLead(
  recentAssistant: MessageWithScenario[],
  confirmingSufficiency: boolean,
): string {
  return confirmingSufficiency
    ? chooseCheckingInSufficiencyAck(recentAssistant)
    : chooseCheckingInHeardYouAck(recentAssistant);
}

export { looksLikeCheckingInSufficiencyAsk } from '@features/aria/metaCommentPatternScoring';

function normalizeQuestionTextForCompare(text: string): string {
  return stripControlTokens(text).trim().toLowerCase().replace(/\s+/g, ' ');
}

function briefAckDuplicatesSufficiencyLead(sufficiencyLead: string, briefAck: string): boolean {
  const leadNorm = normalizeLeadingAck(sufficiencyLead);
  const briefNorm = normalizeLeadingAck(briefAck);
  if (!briefNorm) return false;
  if (leadNorm.includes(briefNorm) || briefNorm.includes(leadNorm)) return true;
  const leadWords = new Set(leadNorm.split(/\s+/).filter(Boolean));
  const briefWords = briefNorm.split(/\s+/).filter(Boolean);
  return briefWords.length > 0 && briefWords.every((word) => leadWords.has(word));
}

/** True when the most recent assistant turn already contains the target question text. */
export function lastAssistantAlreadyAskedQuestion(
  messages: readonly MessageWithScenario[],
  questionText: string,
): boolean {
  const target = normalizeQuestionTextForCompare(questionText);
  if (!target) return false;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;
    const content = stripControlTokens(String(message.content ?? '')).trim();
    if (!content) return false;
    if (looksLikeCheckingInClientOwnedAckAssistantLine(content)) continue;

    const normalized = normalizeQuestionTextForCompare(content);
    if (normalized === target || normalized.endsWith(target)) return true;

    const sentences = content.split(/(?<=[.!?])\s+/);
    const lastSentence = sentences[sentences.length - 1]?.trim() ?? '';
    const lastNorm = normalizeQuestionTextForCompare(lastSentence);
    return lastNorm === target || lastNorm.includes(target) || target.includes(lastNorm);
  }

  return false;
}

/** True when any recent assistant turn (skipping meta-ack pollution) already asked the question. */
export function transcriptContainsAssessableQuestion(
  messages: readonly MessageWithScenario[],
  questionText: string,
): boolean {
  const target = normalizeQuestionTextForCompare(questionText);
  if (!target) return false;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;
    const content = stripControlTokens(String(message.content ?? '')).trim();
    if (!content || looksLikeCheckingInClientOwnedAckAssistantLine(content)) continue;

    const normalized = normalizeQuestionTextForCompare(content);
    if (normalized === target || normalized.endsWith(target)) return true;

    const sentences = content.split(/(?<=[.!?])\s+/);
    const lastSentence = sentences[sentences.length - 1]?.trim() ?? '';
    const lastNorm = normalizeQuestionTextForCompare(lastSentence);
    if (lastNorm === target || lastNorm.includes(target) || target.includes(lastNorm)) return true;
  }

  return false;
}

function findLastAssessableQuestionInTranscript(
  messages: readonly MessageWithScenario[],
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role !== 'assistant') continue;
    const content = stripControlTokens(String(message.content ?? '')).trim();
    if (!content) continue;
    if (looksLikeCheckingInClientOwnedAckAssistantLine(content)) continue;
    if (isNonRepeatableAssistantLineForVerbatimReplay(content)) continue;
    if (isRepeatableMainInterviewQuestionLine(content)) {
      const body = assessablePromptQuestionBody(content);
      if (body && countsAsSubstantiveInterviewQuestionDelivery(body)) {
        return body.slice(0, 240);
      }
    }
  }
  return '';
}

/**
 * When transcript dedup blocks orchestrator advance, still pivot forward on checking-in
 * if the canonical probe has not yet been asked in the immediately prior assistant turn.
 */
export function resolveCheckingInAdvanceProbeBypassingTranscriptGuard(
  flags: PreClaudeScenarioConstructProbeFlags,
  messages: readonly MessageWithScenario[],
): InterviewCanonicalProbeId | null {
  if (
    flags.shouldForceScenarioBJamesRepairProbe &&
    !lastAssistantAlreadyAskedQuestion(messages, SCENARIO_B_JAMES_REPAIR_CANONICAL)
  ) {
    return null;
  }
  return null;
}

function formatPriorAnswerReflection(priorSubstantiveText: string): string | null {
  const clause = extractSalientReflectionClause(priorSubstantiveText);
  if (clause) {
    const trimmed = clause.replace(/[.!?]+$/, '').trim();
    if (trimmed) return `You said ${trimmed}`;
  }
  const flat = priorSubstantiveText.trim().replace(/\s+/g, ' ');
  const words = flat.split(/\s+/).filter(Boolean);
  if (words.length >= 8) {
    const clip = flat.length > 100 ? `${flat.slice(0, 97).trim()}…` : flat;
    return `You said ${clip.replace(/[.!?]+$/, '').trim()}`;
  }
  return null;
}

/** Prefer transcript-derived assessable questions over polluted lastQuestionTextRef meta-ack copy. */
export function resolveCheckingInActiveQuestionText(args: {
  messages: readonly MessageWithScenario[];
  lastQuestionTextRef: string;
  lastInterviewerContent: string;
  activeScenario: number;
}): string {
  const fromAssessableScan = findLastAssessableQuestionInTranscript(args.messages).trim();
  if (
    fromAssessableScan &&
    countsAsSubstantiveInterviewQuestionDelivery(fromAssessableScan)
  ) {
    return fromAssessableScan;
  }

  const fromTranscript = findLastRepeatableInterviewQuestionText(
    [...args.messages],
    args.lastQuestionTextRef,
    { activeScenario: args.activeScenario },
  ).trim();
  if (
    fromTranscript &&
    !looksLikeCheckingInClientOwnedAckAssistantLine(fromTranscript) &&
    countsAsSubstantiveInterviewQuestionDelivery(fromTranscript)
  ) {
    return fromTranscript.slice(0, 240);
  }

  const ref = args.lastQuestionTextRef.trim();
  if (
    ref &&
    !looksLikeCheckingInClientOwnedAckAssistantLine(ref) &&
    countsAsSubstantiveInterviewQuestionDelivery(ref)
  ) {
    return ref.slice(0, 240);
  }

  const interviewer = args.lastInterviewerContent.trim();
  if (
    interviewer &&
    !looksLikeCheckingInClientOwnedAckAssistantLine(interviewer) &&
    countsAsSubstantiveInterviewQuestionDelivery(interviewer)
  ) {
    return interviewer.slice(0, 240);
  }

  if (fromAssessableScan) return fromAssessableScan;
  if (
    fromTranscript &&
    !looksLikeCheckingInClientOwnedAckAssistantLine(fromTranscript) &&
    isRepeatableMainInterviewQuestionLine(fromTranscript)
  ) {
    return fromTranscript.slice(0, 240);
  }
  if (looksLikeScenarioBRepairAsJamesQuestion(ref)) return ref.slice(0, 240);
  if (looksLikeScenarioBJamesDifferentlyQuestion(ref)) return ref.slice(0, 240);
  return '';
}

function essentialLookingForClause(activeQuestionPreview: string): string | null {
  if (looksLikeCheckingInClientOwnedAckAssistantLine(activeQuestionPreview)) return null;
  if (
    !countsAsSubstantiveInterviewQuestionDelivery(activeQuestionPreview) &&
    !looksLikeScenarioBRepairAsJamesQuestion(activeQuestionPreview) &&
    !looksLikeScenarioBJamesDifferentlyQuestion(activeQuestionPreview)
  ) {
    return null;
  }
  const essential = shortenLastInterviewerQuestionForFrustrationReask(activeQuestionPreview);
  const core = essential.endsWith('?') ? essential.slice(0, -1).trim() : essential.trim();
  if (!core || core.length < 8) return null;
  if (looksLikeCheckingInClientOwnedAckAssistantLine(core)) return null;
  return `What I'm looking for here is ${core}.`;
}

function buildCheckingInStaticAckFromPrior(
  ownershipLead: string,
  priorSubstantiveText: string,
  recentAssistant: MessageWithScenario[],
  checkingInFrustrationAdjacent?: boolean,
  includeOwnershipLead = true,
): string {
  const priorReflection = formatPriorAnswerReflection(priorSubstantiveText);
  if (priorReflection) {
    if (!includeOwnershipLead) {
      return `${priorReflection}.`.trim();
    }
    return `${ownershipLead} ${priorReflection}.`.trim();
  }
  if (!checkingInFrustrationAdjacent) {
    return ownershipLead;
  }
  const briefReflection = chooseBriefScenarioAck(recentAssistant);
  if (briefAckDuplicatesSufficiencyLead(ownershipLead, briefReflection)) {
    return ownershipLead;
  }
  return `${ownershipLead} ${briefReflection}`.trim();
}

/**
 * Client-owned checking-in reply when the active question is already on the table:
 * confirm they were heard, mirror one prior point, and clarify what is still needed.
 */
export function buildCheckingInAckOnlySpeech(args: {
  messages: readonly MessageWithScenario[];
  priorSubstantiveText: string;
  activeQuestionPreview: string;
  priorAnswerSatisfiesActiveQuestion?: boolean;
  checkingInFrustrationAdjacent?: boolean;
}): string {
  const recentAssistant = recentAssistantMessagesForAck([...args.messages]);
  const priorReflection = formatPriorAnswerReflection(args.priorSubstantiveText);
  const lookingFor = args.priorAnswerSatisfiesActiveQuestion
    ? null
    : essentialLookingForClause(args.activeQuestionPreview);
  const confirmingSufficiency = args.priorAnswerSatisfiesActiveQuestion === true;
  const ownership = chooseCheckingInOwnershipLead(recentAssistant, confirmingSufficiency);
  const sufficiencyChallengeNotMet =
    args.checkingInFrustrationAdjacent === true && !confirmingSufficiency;
  const clarifyLead = sufficiencyChallengeNotMet
    ? chooseCheckingInNotYetAck(recentAssistant)
    : ownership;

  if (priorReflection) {
    if (args.priorAnswerSatisfiesActiveQuestion) {
      return `${ownership} ${priorReflection} — that's enough.`;
    }
    if (lookingFor) {
      return `${clarifyLead} ${priorReflection}. ${lookingFor}`;
    }
    return `${clarifyLead} ${priorReflection}.`;
  }

  if (lookingFor) {
    return `${ownership} ${lookingFor}`;
  }
  return ownership;
}

function recentAckPreviews(messages: readonly MessageWithScenario[]): string[] {
  const acks: string[] = [];
  for (const m of [...messages].reverse()) {
    if (m.role !== 'assistant') continue;
    const c = String(m.content ?? '').trim();
    if (!c) continue;
    const firstSentence = (c.match(/^[^.!?]+[.!?]?/)?.[0] ?? c).trim();
    if (firstSentence.length <= 80) acks.unshift(firstSentence);
    if (acks.length >= 3) break;
  }
  return acks;
}

/**
 * Brief receipt for checking-in turns ("Was that enough?") before pivoting or re-asking.
 * Uses the prior substantive answer for reflection — not the meta phrase itself.
 */
export async function resolveCheckingInBriefAckForInterview(args: {
  messages: readonly MessageWithScenario[];
  priorSubstantiveText: string;
  activeQuestionPreview: string;
  interviewSessionId?: string | null;
  checkingInFrustrationAdjacent?: boolean;
  /** When false (default), use heard-you ownership — not sufficiency confirms like "that's enough". */
  confirmingSufficiency?: boolean;
}): Promise<{ ack: string; source: 'llm' | 'static' }> {
  const recentAssistant = recentAssistantMessagesForAck([...args.messages]);
  const confirmingSufficiency = args.confirmingSufficiency === true;
  const ownershipLead = chooseCheckingInOwnershipLead(
    recentAssistant,
    confirmingSufficiency,
  );
  const prior = args.priorSubstantiveText.trim();
  const staticAck = prior
    ? buildCheckingInStaticAckFromPrior(
        ownershipLead,
        prior,
        recentAssistant,
        args.checkingInFrustrationAdjacent,
        confirmingSufficiency,
      )
    : ownershipLead;

  if (!INTERVIEW_WITHIN_SCENARIO_ACK_LLM_ENABLED || !prior) {
    return { ack: staticAck, source: 'static' };
  }

  try {
    const llmReflection = await fetchInterviewWithinScenarioAckFromLlm({
      userText: prior,
      activeQuestionPreview: args.activeQuestionPreview,
      recentAckPreviews: recentAckPreviews(args.messages),
    });
    if (llmReflection) {
      const ack = confirmingSufficiency
        ? `${ownershipLead} ${llmReflection}`.trim()
        : llmReflection.trim();
      void remoteLog('[CHECKING_IN_ACK_LLM]', {
        interviewSessionId: args.interviewSessionId ?? null,
        source: 'llm',
        preview: ack.slice(0, 120),
      });
      return { ack, source: 'llm' };
    }
  } catch (err) {
    void remoteLog('[CHECKING_IN_ACK_LLM]', {
      interviewSessionId: args.interviewSessionId ?? null,
      source: 'static',
      reason: 'llm_error',
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { ack: staticAck, source: 'static' };
}

export function checkingInAckEmbedsConstructReask(ack: string): boolean {
  return /\bwhat i'?m looking for here is\b/i.test((ack ?? '').trim());
}

export function prefixProbeWithCheckingInAck(ack: string, probe: string): string {
  const lead = ack.trim();
  const body = probe.trim();
  if (!lead) return body;
  if (!body) return lead;
  /** Clarify-reask acks already embed the construct via essentialLookingForClause — skip verbatim probe repeat. */
  if (checkingInAckEmbedsConstructReask(lead)) {
    return lead;
  }
  return `${lead} ${body}`;
}
