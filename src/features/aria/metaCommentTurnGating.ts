import type {
  ExemptMetaCommentTurnReason,
  FrustrationMetaSuppressionDecision,
  MetaCommentClassification,
  ResolvedMetaComment,
} from '@features/aria/metaCommentClassificationTypes';
import {
  FRUSTRATION_META_CONFIDENCE_THRESHOLD,
  FRUSTRATION_META_WORD_COUNT_THRESHOLD,
} from '@features/aria/metaCommentClassificationTypes';
import { classifyUserMetaComment } from '@features/aria/metaCommentClassifierCore';
import {
  isInterviewExitConfirmationMoment,
  isInterviewNameCollectionActive,
  isInterviewPreambleBriefingMoment,
  isResumeReentryWelcomePrompt,
  isSimpleYesNoInterviewMoment,
  looksLikeInterviewExitDecline,
  looksLikeReadinessAffirmation,
  looksLikeReadinessYesHomophone,
} from '@features/aria/interviewLanguageGate';
import { classifyResumeRepeatIntent } from '@features/aria/resumeRepeatIntent';
import {
  isConfusionRepeatRequestText,
  isExplicitRepeatRequestPreClassification,
} from '@features/aria/metaCommentConfusionRepeat';

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

function stripNameTokenPunctuationForValidation(token: string): string {
  return token.replace(/[.!?,;:]+$/g, '').trim();
}

/** Short procedural assent — must not be treated as a name reply. */
export function looksLikeProceduralAffirmation(text: string): boolean {
  const t = text.trim().toLowerCase().replace(/[.!?,;:]+$/, '');
  return /^(yes|yeah|yep|yup|sure|ok|okay|ready|i'?m ready|let'?s go|go ahead|sounds good|absolutely|definitely)$/.test(
    t,
  );
}

/** Mirrors Amoraea greeting-name heuristic — short name-like reply on first user turn. */
export function looksLikeShortNameReply(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 50) return false;
  const parts = t
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => stripNameTokenPunctuationForValidation(p))
    .filter((p) => p.length > 0);
  return parts.length <= 2 && parts.every((p) => /^[a-zA-Z'-]+$/.test(p));
}

/**
 * First classification after transcription: raw classifier + narrow interview exemptions.
 * Exempt only (a) first-turn greeting-name reply, or (b) short replies (fewer than 8 words) still inside the
 * post–meta-ack window before the next substantive question delivery.
 */
export function resolveMetaCommentForInterviewTurn(
  text: string,
  ctx: {
    lastQuestionText: string | null | undefined;
    priorUserUtteranceCount: number;
    isInterviewAppRoute: boolean;
    hasProfileFirstName: boolean;
    interviewName?: string | null;
    nameReaskPending?: boolean;
    lastAssistantCue?: string | null;
    /**
     * True only while still between a meta-comment acknowledgment that did not yet pair with a substantive
     * interview delivery (see `countsAsSubstantiveInterviewQuestionDelivery`) — suppress duplicate meta reads.
     */
    suppressMetaClassificationPostMetaAckAwaitingSubstantive?: boolean;
    /** Resume welcome gate: next mic turn is procedural assent, not substantive scenario content. */
    resumeGatePending?: boolean;
    /** Prefer interview `countSpokenWords` when provided; else heuristic word count on `text`. */
    spokenWordCount?: number;
  }
): ResolvedMetaComment {
  const raw = classifyUserMetaComment(text);
  const wc = ctx.spokenWordCount ?? wordCount(text);
  const isGreetingNameTurn =
    ctx.isInterviewAppRoute &&
    ctx.priorUserUtteranceCount === 0 &&
    !ctx.hasProfileFirstName &&
    looksLikeShortNameReply(text);
  const isNameCollectionTurn =
    ctx.isInterviewAppRoute &&
    !ctx.hasProfileFirstName &&
    !looksLikeProceduralAffirmation(text) &&
    (isInterviewNameCollectionActive({
      interviewName: ctx.interviewName,
      nameReaskPending: ctx.nameReaskPending,
      lastQuestionText: ctx.lastQuestionText,
      lastAssistantCue: ctx.lastAssistantCue,
    }) ||
      looksLikeShortNameReply(text));
  const isPreambleOrReadinessTurn =
    ctx.isInterviewAppRoute &&
    (isInterviewPreambleBriefingMoment(ctx.lastQuestionText) ||
      isSimpleYesNoInterviewMoment(ctx.lastQuestionText));
  const isResumeReentryTurn =
    ctx.isInterviewAppRoute &&
    (ctx.resumeGatePending === true ||
      isResumeReentryWelcomePrompt(ctx.lastQuestionText)) &&
    (looksLikeReadinessYesHomophone(text) || looksLikeReadinessAffirmation(text)) &&
    !isExplicitRepeatRequestPreClassification(text) &&
    classifyResumeRepeatIntent(text) !== 'repeat';
  const isExitDeclineTurn =
    ctx.isInterviewAppRoute &&
    isInterviewExitConfirmationMoment(ctx.lastQuestionText) &&
    looksLikeInterviewExitDecline(text);
  const postMetaAckSeqWindow =
    ctx.suppressMetaClassificationPostMetaAckAwaitingSubstantive === true && wc < 8;

  let exemptMetaCommentTurn = false;
  let exemptMetaCommentTurnReason: ExemptMetaCommentTurnReason = 'no_exemption_condition_met';

  if (isGreetingNameTurn) {
    exemptMetaCommentTurn = true;
    exemptMetaCommentTurnReason = 'name_entry_turn';
  } else if (isPreambleOrReadinessTurn) {
    exemptMetaCommentTurn = true;
    exemptMetaCommentTurnReason = 'preamble_readiness_turn';
  } else if (isNameCollectionTurn) {
    exemptMetaCommentTurn = true;
    exemptMetaCommentTurnReason = 'name_entry_turn';
  } else if (isExitDeclineTurn) {
    exemptMetaCommentTurn = true;
    exemptMetaCommentTurnReason = 'exit_decline_turn';
  } else if (isResumeReentryTurn) {
    exemptMetaCommentTurn = true;
    exemptMetaCommentTurnReason = 'resume_reentry_turn';
  } else if (
    postMetaAckSeqWindow &&
    !isExplicitRepeatRequestPreClassification(text) &&
    !isConfusionRepeatRequestText(text)
  ) {
    exemptMetaCommentTurn = true;
    exemptMetaCommentTurnReason = 'seq_not_advanced_since_last_ack';
  } else {
    exemptMetaCommentTurnReason = 'no_exemption_condition_met';
  }

  const effective = exemptMetaCommentTurn ? null : raw;
  return { raw, effective, exemptMetaCommentTurn, exemptMetaCommentTurnReason };
}

export function isCheckingInFrustrationAdjacent(args: {
  checkingInText: string;
  priorSubstantiveText?: string | null | undefined;
}): boolean {
  const current = args.checkingInText.trim().toLowerCase();
  const prior = (args.priorSubstantiveText ?? '').trim().toLowerCase();
  const priorWordCount = wordCount(prior);
  const priorLong = priorWordCount >= 50;
  const priorPersonalOrEmotional =
    /\b(i|my|me|we|our|us)\b/.test(prior) &&
    /\b(feel|felt|hurt|angry|upset|sad|tears?|lonely|argument|fight|stopped talking|cut each other out|self-reflection|passed away|died|grief)\b/.test(
      prior
    );
  const priorDetailedNarrative =
    priorWordCount >= 32 &&
    /\b(there was a time|one time|at one point|i remember when|after|before|that night|for a while)\b/.test(
      prior
    );
  const sharpCheckingIn =
    /\b(did you get all that|was that enough|did that answer it|i already said all of that|i just explained all of that)\b/.test(
      current
    );
  return sharpCheckingIn || priorLong || priorPersonalOrEmotional || priorDetailedNarrative;
}

/**
 * Gates whether a frustration classification diverts to the frustration-handling path.
 * Word-count guard runs first; repeated prior frustration in this moment exempts word count only.
 */
export function evaluateFrustrationMetaCommentPathSuppression(args: {
  classification: MetaCommentClassification | null | undefined;
  wordCount: number;
  /** Frustration signals already counted in this interview moment before the current turn. */
  priorFrustrationSignalCountInMoment: number;
}): FrustrationMetaSuppressionDecision {
  const { classification, wordCount, priorFrustrationSignalCountInMoment } = args;
  if (classification?.type !== 'frustration') {
    return { suppress: false, reason: null, suppressionEventType: null };
  }
  const repeatedFrustrationPrior = priorFrustrationSignalCountInMoment >= 1;
  if (!repeatedFrustrationPrior && wordCount >= FRUSTRATION_META_WORD_COUNT_THRESHOLD) {
    return {
      suppress: true,
      reason: 'word_count_above_threshold',
      suppressionEventType: 'meta_comment_suppressed_word_count_guard',
    };
  }
  if (classification.confidence < FRUSTRATION_META_CONFIDENCE_THRESHOLD) {
    return {
      suppress: true,
      reason: 'confidence_below_0.85',
      suppressionEventType: 'meta_comment_suppressed_confidence_threshold',
    };
  }
  return { suppress: false, reason: null, suppressionEventType: null };
}

