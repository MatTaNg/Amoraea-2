import { countSpokenWords } from '@features/aria/interviewLanguageGate';
import { resolvePlausibleInterviewFirstName } from '@features/aria/interviewNameValidation';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import {
  FRUSTRATION_META_WORD_COUNT_THRESHOLD,
  buildSkipRequestConfirmationSpeech,
  evaluateFrustrationMetaCommentPathSuppression,
  getInabilitySubstantiveOverrideDetail,
  getMetaCommentCanonicalResponseSummary,
  getPriorSubstantiveNonMetaUserContentInMoment,
  isCheckingInFrustrationAdjacent,
  looksLikeSkipConfirmationConnectivityGreeting,
  resolveMetaCommentForInterviewTurn,
} from '@features/aria/metaCommentClassification';
import type { PreClaudeFrustrationSkipGateState } from '@features/aria/resolvePreClaudeFrustrationSkipGates';
import type { PreClaudeTurnSkipAndMetaGateResult } from '@features/aria/resolvePreClaudeTurnSkipAndMetaGates';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { getScenarioNumberForNewMessage } from '@features/aria/scenarioNumberDetection';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';

/** Meta-comment classification, inability/skip_request handling, telemetry, and result assembly. */
export function resolvePreClaudeMetaCommentGateState(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  resumeGatePendingEarly: boolean,
  frustrationSkip: PreClaudeFrustrationSkipGateState,
): PreClaudeTurnSkipAndMetaGateResult {
  const {
    frustrationSkipAcceptancePipeline,
    frustrationSkipDeclinePipeline,
    proactiveScenarioSkipConfirmationInjection,
  } = frustrationSkip;

  const priorUserUtteranceCountForMeta = deps.messages.filter(
    (m) => m.role === 'user' && !(m as { isWelcomeBack?: boolean }).isWelcomeBack,
  ).length;
  const wcForMetaExempt = countSpokenWords(trimmed);
  const suppressMetaClassificationPostMetaAckAwaitingSubstantive =
    deps.metaCommentAckAwaitingSubstantiveBaselineSeqRef.current !== null &&
    deps.substantiveInterviewQuestionDeliveredSeqRef.current ===
      deps.metaCommentAckAwaitingSubstantiveBaselineSeqRef.current;
  const metaResolved = resolveMetaCommentForInterviewTurn(trimmed, {
    lastQuestionText: deps.lastQuestionTextRef.current,
    priorUserUtteranceCount: priorUserUtteranceCountForMeta,
    isInterviewAppRoute: deps.isInterviewAppRoute,
    hasProfileFirstName: !!resolvePlausibleInterviewFirstName(deps.interviewNameRef.current),
    interviewName: deps.interviewNameRef.current,
    nameReaskPending: deps.interviewNameReaskPendingRef.current,
    lastAssistantCue:
      [...deps.messages].reverse().find((m) => m.role === 'assistant')?.content ?? null,
    suppressMetaClassificationPostMetaAckAwaitingSubstantive,
    resumeGatePending: resumeGatePendingEarly,
    spokenWordCount: wcForMetaExempt,
  });
  void remoteLog('meta_comment_classification_result', {
    transcript_text: trimmed,
    word_count: wcForMetaExempt,
    classification_result: metaResolved.effective?.type ?? null,
    classification_confidence: metaResolved.effective?.confidence ?? null,
    raw_classification: metaResolved.raw?.type ?? null,
    raw_confidence: metaResolved.raw?.confidence ?? null,
    exempt_meta_turn: metaResolved.exemptMetaCommentTurn,
    exempt_meta_turn_reason: metaResolved.exemptMetaCommentTurnReason,
    suppress_post_meta_ack_window: suppressMetaClassificationPostMetaAckAwaitingSubstantive,
    meta_ack_substantive_baseline_seq: deps.metaCommentAckAwaitingSubstantiveBaselineSeqRef.current,
    substantive_question_delivery_seq: deps.substantiveInterviewQuestionDeliveredSeqRef.current,
  });
  const inabilityOverrideDetail = getInabilitySubstantiveOverrideDetail(trimmed);
  if (inabilityOverrideDetail) {
    void remoteLog('inability_substantive_override', {
      ...inabilityOverrideDetail,
      transcript_text: trimmed,
      classification_result_after_override: metaResolved.effective?.type ?? null,
    });
  }
  let metaCommentClassification = metaResolved.effective;
  let skipConfirmationGreetingReconnectInjection = false;
  if (
    deps.isInterviewAppRoute &&
    !deps.isAdmin &&
    deps.frustrationSkipAwaitingConfirmationRef.current &&
    looksLikeSkipConfirmationConnectivityGreeting(trimmed)
  ) {
    metaCommentClassification = { type: 'ambiguous_short', confidence: 0.42 };
    skipConfirmationGreetingReconnectInjection = true;
  }
  const momentNumMeta = deps.currentInterviewMomentRef.current;
  let userScenarioTagForMeta =
    (deps.currentScenarioRef.current as number | undefined) ??
    getScenarioNumberForNewMessage(deps.messages, 'user');
  if (momentNumMeta >= 4) {
    userScenarioTagForMeta = 3;
  }

  if (metaCommentClassification?.type !== 'inability') {
    deps.inabilityCountByMomentRef.current = {
      ...deps.inabilityCountByMomentRef.current,
      [momentNumMeta]: 0,
    };
  }

  let alreadyAnsweredPriorSubstantiveVerified: boolean | undefined;
  if (metaCommentClassification?.type === 'already_answered') {
    alreadyAnsweredPriorSubstantiveVerified =
      getPriorSubstantiveNonMetaUserContentInMoment(
        deps.messages,
        userScenarioTagForMeta as 1 | 2 | 3,
        momentNumMeta,
      ) != null;
  }

  const inabilityPrevForLog =
    metaCommentClassification?.type === 'inability'
      ? (deps.inabilityCountByMomentRef.current[momentNumMeta] ?? 0)
      : undefined;
  let inabilityCountInMomentLog: number | undefined;
  let inabilityEscalatedToSkipLog: boolean | undefined;
  if (metaCommentClassification?.type === 'inability' && inabilityPrevForLog !== undefined) {
    inabilityCountInMomentLog = inabilityPrevForLog === 0 ? 1 : inabilityPrevForLog + 1;
    // First "I don't know" already offers skip confirmation (same as skip_request).
    inabilityEscalatedToSkipLog = true;
  }

  const priorNonMetaExcerptForSkip = getPriorSubstantiveNonMetaUserContentInMoment(
    deps.messages,
    userScenarioTagForMeta as 1 | 2 | 3,
    momentNumMeta,
  );
  const checkingInFrustrationAdjacent =
    metaCommentClassification?.type === 'checking_in'
      ? isCheckingInFrustrationAdjacent({
          checkingInText: trimmed,
          priorSubstantiveText: priorNonMetaExcerptForSkip,
        })
      : false;
  const skipRequestConfirmationSpeech = buildSkipRequestConfirmationSpeech({
    priorSubstantiveNonMetaExcerpt: priorNonMetaExcerptForSkip,
  });

  if (metaCommentClassification?.type === 'skip_request') {
    const mSk = deps.currentInterviewMomentRef.current;
    if (mSk < 1 || mSk > 3 || deps.closingQuestionPending) {
      metaCommentClassification = null;
    }
  }
  if (metaCommentClassification?.type === 'inability' && deps.closingQuestionPending) {
    metaCommentClassification = null;
  }

  const priorFrustrationSignalCountInMoment =
    deps.metaCommentFrustrationCountByMomentRef.current[momentNumMeta] ?? 0;
  const frustrationPathSuppression = evaluateFrustrationMetaCommentPathSuppression({
    classification: metaCommentClassification,
    wordCount: wcForMetaExempt,
    priorFrustrationSignalCountInMoment,
  });
  if (
    frustrationPathSuppression.suppress &&
    metaCommentClassification?.type === 'frustration' &&
    frustrationPathSuppression.suppressionEventType
  ) {
    const suppressionPayload =
      frustrationPathSuppression.reason === 'word_count_above_threshold'
        ? {
            transcript_text: trimmed,
            classification_confidence: metaCommentClassification.confidence,
            raw_classification: 'frustration' as const,
            word_count: wcForMetaExempt,
            suppression_reason: 'word_count_above_threshold' as const,
            word_count_threshold: FRUSTRATION_META_WORD_COUNT_THRESHOLD,
            repeated_frustration_prior: priorFrustrationSignalCountInMoment >= 1,
            moment_number: momentNumMeta,
          }
        : {
            transcript_text: trimmed,
            classification_confidence: metaCommentClassification.confidence,
            raw_classification: 'frustration' as const,
            word_count: wcForMetaExempt,
            suppression_reason: 'confidence_below_0.85' as const,
            repeated_frustration_prior: priorFrustrationSignalCountInMoment >= 1,
            moment_number: momentNumMeta,
          };
    void remoteLog(frustrationPathSuppression.suppressionEventType, suppressionPayload);
    metaCommentClassification = null;
  }

  let inabilityInvitationClientInjection = false;
  let inabilityEscalationSkipInjection = false;
  if (
    metaCommentClassification?.type === 'inability' &&
    deps.isInterviewAppRoute &&
    !deps.isAdmin &&
    deps.status === 'active' &&
    !deps.closingQuestionPending &&
    !deps.frustrationSkipOfferPendingRef.current &&
    !frustrationSkipAcceptancePipeline &&
    !frustrationSkipDeclinePipeline &&
    !proactiveScenarioSkipConfirmationInjection
  ) {
    const mIn = deps.currentInterviewMomentRef.current;
    if (mIn >= 1 && mIn <= 3) {
      // Same branch as an explicit skip request: offer skip confirmation (score impact if accepted).
      inabilityEscalationSkipInjection = true;
    }
  }

  const metaClassSnapshotPrePipeline = metaCommentClassification;
  if (
    frustrationSkipAcceptancePipeline ||
    frustrationSkipDeclinePipeline ||
    proactiveScenarioSkipConfirmationInjection
  ) {
    metaCommentClassification = null;
  }
  if (metaClassSnapshotPrePipeline?.type === 'skip_request') {
    const mSkipSeen = deps.currentInterviewMomentRef.current;
    deps.skipRequestClassificationSeenByMomentRef.current = {
      ...deps.skipRequestClassificationSeenByMomentRef.current,
      [mSkipSeen]: true,
    };
  }
  const metaForTelemetry = metaCommentClassification;
  const skipRequestMetaConfirmationInjection =
    metaCommentClassification?.type === 'skip_request' &&
    deps.isInterviewAppRoute &&
    !deps.isAdmin &&
    deps.status === 'active' &&
    !deps.closingQuestionPending &&
    !deps.frustrationSkipOfferPendingRef.current &&
    !frustrationSkipAcceptancePipeline &&
    !frustrationSkipDeclinePipeline;
  let repeatedFrustrationInMoment = false;
  if (metaForTelemetry?.type === 'frustration') {
    const momentNum = deps.currentInterviewMomentRef.current;
    const prev = deps.metaCommentFrustrationCountByMomentRef.current[momentNum] ?? 0;
    const next = prev + 1;
    deps.metaCommentFrustrationCountByMomentRef.current = {
      ...deps.metaCommentFrustrationCountByMomentRef.current,
      [momentNum]: next,
    };
    repeatedFrustrationInMoment = next >= 2;
    if (repeatedFrustrationInMoment && deps.userId) {
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId: deps.userId,
        attemptId: r.attemptId,
        eventType: 'repeated_frustration_signal',
        eventData: {
          moment_number: momentNum,
          frustration_signal_count: next,
          transcript_preview: trimmed.slice(0, 280),
        },
        platform: r.platform,
      });
    }
    if (metaForTelemetry?.type === 'frustration' && repeatedFrustrationInMoment) {
      deps.frustrationSkipOfferPendingRef.current = false;
      deps.frustrationSkipHadPriorAnswerRef.current = null;
      deps.frustrationSkipAwaitingConfirmationRef.current = false;
      deps.scenarioSkipOfferSourceRef.current = null;
    }
  }
  const suppressForcedConstructProbesForMetaFrustration =
    (metaForTelemetry?.type === 'frustration' && !repeatedFrustrationInMoment) ||
    metaForTelemetry?.type === 'skip_request' ||
    metaForTelemetry?.type === 'inability' ||
    metaForTelemetry?.type === 'already_answered';
  if (metaForTelemetry && deps.userId) {
    const r = getSessionLogRuntime();
    const summary = getMetaCommentCanonicalResponseSummary(
      metaForTelemetry.type,
      repeatedFrustrationInMoment && metaForTelemetry.type === 'frustration',
      metaForTelemetry.type === 'confusion' ? metaForTelemetry.confusion_subtype : undefined,
      metaForTelemetry.type === 'checking_in' ? checkingInFrustrationAdjacent : undefined,
    );
    writeSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 'meta_comment_detected',
      eventData: {
        transcript_text: trimmed,
        word_count: countSpokenWords(trimmed),
        moment_number: deps.currentInterviewMomentRef.current,
        meta_comment_type: metaForTelemetry.type,
        classification_confidence: metaForTelemetry.confidence,
        aira_response_delivered: summary,
        repeated_frustration: repeatedFrustrationInMoment,
        ...(metaForTelemetry.type === 'confusion' && metaForTelemetry.confusion_subtype
          ? { confusion_subtype: metaForTelemetry.confusion_subtype }
          : {}),
        ...(metaForTelemetry.type === 'inability'
          ? {
              inability_count_in_moment: inabilityCountInMomentLog,
              escalated_to_skip_request: inabilityEscalatedToSkipLog === true,
            }
          : {}),
        ...(metaForTelemetry.type === 'already_answered'
          ? {
              had_prior_answer: alreadyAnsweredPriorSubstantiveVerified === true,
              resolved_as:
                alreadyAnsweredPriorSubstantiveVerified === true
                  ? 'ownership_and_advance'
                  : 'frustration_path',
              skip_consumed: false,
            }
          : {}),
        ...(metaForTelemetry.type === 'checking_in'
          ? {
              checking_in_frustration_adjacent: checkingInFrustrationAdjacent,
              ...(checkingInFrustrationAdjacent
                ? { pivot_reason: 'frustration_adjacent_checking_in' }
                : {}),
            }
          : {}),
      },
      platform: r.platform,
    });
  }

  return {
    frustrationSkipAcceptancePipeline,
    frustrationSkipDeclinePipeline,
    proactiveScenarioSkipConfirmationInjection,
    skipConfirmationGreetingReconnectInjection,
    metaCommentClassification,
    metaClassSnapshotPrePipeline,
    alreadyAnsweredPriorSubstantiveVerified,
    inabilityCountInMomentLog,
    inabilityEscalatedToSkipLog,
    checkingInFrustrationAdjacent,
    skipRequestConfirmationSpeech,
    inabilityInvitationClientInjection,
    inabilityEscalationSkipInjection,
    skipRequestMetaConfirmationInjection,
    repeatedFrustrationInMoment,
    suppressForcedConstructProbesForMetaFrustration,
  };
}
