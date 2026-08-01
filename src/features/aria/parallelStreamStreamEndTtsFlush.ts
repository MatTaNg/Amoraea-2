import { Platform } from 'react-native';

import { stripControlTokens } from '@features/aria/interviewControlTokens';
import {
  coerceIncompleteInterviewClosingForTts,
  isApprovedElongatingProbeOnly,
  isInterviewClosingReflectiveAckFragment,
  isInterviewClosingThanksFragment,
  looksLikeInterviewClosingAssistantMessage,
  stripDuplicateInterviewClosingSentencesWithinDraft,
} from '@features/aria/elongatingProbe';
import { computeMoment5InterviewCloseGate } from '@features/aria/interviewProgressSync';
import {
  looksLikeMoment5AccountabilityProbeAssistantPrompt,
} from '@features/aria/probeAndScoringUtils';
import {
  looksLikeMoment5ResolutionFollowUpPrompt,
  stripInterviewClosingBundledWithMoment5ResolutionFollowUp,
} from '@features/aria/moment5SpecificityRedirect';
import { extractMoment5AnswerForClosingReflection } from '@features/aria/moment5TranscriptHelpers';
import { deriveClosingPillarContextFromScenarioScores } from '@features/aria/closingReflectionGrounding';
import { enrichPersonalMomentClosingForTts } from '@features/aria/personalMomentClosingEnrichment';
import { looksLikeSkipConfirmationAssistantPrompt } from '@features/aria/metaCommentSkipFrustration';
import { stripInternalReflectionSchemaLeak } from '@features/aria/interviewReflectionTextStrips';
import { stripDuplicateScenarioAContemptProbeParagraphs, stripDuplicateScenarioARepairQuestionParagraphs } from '@features/aria/interviewAssistantDuplicateStrip';
import { isShortAckOnlySentence } from '@features/aria/interviewerFrameworkPrompt';
import {
  looksLikeScenarioARepairQuestion,
  looksLikeScenarioARepairStreamFragment,
  resolveInterviewQuestionRepeatTtsText,
  shouldSuppressScenarioARepairBeforeContemptAnswer,
  clearParallelTtsBatchIfScenarioARepairLeakBeforeContempt,
} from '@features/aria/interviewDisengagementProbes';
import {
  normalizeScenarioARepairQuestionInAssistantDraft,
  shouldSkipScenarioARepairDraftNormalization,
} from '@features/aria/scenarioARepairQuestionHelpers';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from '@features/aria/probeAndScoringUtils';
import { isActiveScenarioAConstructProbeTurn, scenarioAMinimumEngagementForHandoff, shouldDeliverScenarioFollowUpQuestion, transcriptContainsScenarioCRepairQuestion } from '@features/aria/scenarioFollowUpTranscriptGuard';
import {
  coerceScenarioBJamesDifferentlyQuestionForTts,
  coerceScenarioBJamesSayToJamesQuestionForTts,
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import {
  coerceScenarioCNextProbeForStreamTts,
  coerceScenarioCRepairQuestionForTts,
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCSophiePerspectiveQuestion,
  scenarioCRepairConstructStillPending,
  scenarioCSophiePerspectiveProbeAlreadyDelivered,
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
  shouldSkipS2ToS3HandoffReplayAtStreamEnd,
} from '@features/aria/scenarioCPromptDetection';
import { sanitizeAssistantInterviewerCharacterNames } from '@/constants/interviewCharacterNames';
import { ensureCanonicalIntroBriefingForTts } from '@features/aria/interviewPreambleBriefing';
import { substituteCanonicalInterviewScenarioBodiesForTts } from '@features/aria/substituteCanonicalInterviewScenarioBodiesForTts';
import {
  dedupeAdjacentBoundaryValidationsBeforeParticipantName,
  ensureSpokenTextIncludesParticipantFirstName,
} from '@features/aria/interviewerFrameworkPrompt';
import {
  hasInterviewClosingTtsDeliveredForSession,
  releaseInterviewClosingSpeak,
  shouldSuppressDuplicateInterviewClosingTts,
  tryAcquireInterviewClosingSpeak,
} from '@features/aria/interviewClosingTtsSession';
import { ASSISTANT_INTERVIEW_SPEECH, SHOW_SCENARIO_CARD_CANONICAL_SPEECH, TAB_RESTORE_PENDING_SPEAK_OPTIONS } from '@features/aria/interviewTtsSpeakOptions';
import {
  buildClientFrustrationMetaFallbackAssistantText,
  lastSubstantivePriorUserExcerptInScenario,
} from '@features/aria/metaCommentClassification';
import { triggerCompletedScenarioScoringIfNeeded } from '@features/aria/runScenarioBoundaryScoring';
import { resolveAssessableQuestionTextForResponseTiming } from '@features/aria/resolveAssessableQuestionTextForResponseTiming';
import { getSessionLogRuntime, setTtsPlaybackActive, writeSessionLog } from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';

import { mergeDeferredScenarioAContemptProbeLeadWithNextSentence } from '@features/aria/scenarioAContemptProbeLogic';
import {
  applyPostClaudeScenarioAdvanceBundleOverride,
  resolveScenarioUserTextForBoundaryReflection,
} from '@features/aria/interviewScenarioAdvanceAfterRepair';
import { textContainsScenarioBVignetteBody } from '@features/aria/emotionScenarioTransitionInference';
import { isExactShowScenario3VignetteText } from '@features/aria/showScenarioCardCanonicalTts';
import { advanceInterviewScenarioRefsAfterCanonicalShowScenarioCard } from '@features/aria/interviewScenarioRefSync';
import { buildScenario1To2BundleForInterview, buildScenario2To3BundleForInterview, scenarioHandoffBundleMissingNextSegmentVignette } from '@features/aria/interviewTransitionBundles';
import { enrichScenarioBoundaryHandoffBundleWithDynamicLead } from '@features/aria/resolveScenarioBoundaryLeadForInterview';
import { SCENARIO_2_TEXT, SCENARIO_3_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import { SCENARIO_2_OPENING, SCENARIO_3_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';
import {
  isUnauthorizedS1FollowUp,
  looksLikeBriefStreamAckOnly,
  looksLikeScenarioHandoffOrVignetteBundle,
  looksLikeShortProbeFallback,
} from '@features/aria/interviewSpokenTextHeuristics';

import type { MaybeQueueParallelStreamSentenceForTts } from './parallelStreamMaybeQueueSentenceForTts';
import { speakMissedScenarioBoundaryLeadAtStreamEnd, resolveStreamEndHandoffSpeechAfterPartialBoundaryLead } from './parallelStreamScenarioBoundaryHandoff';
import type { ParallelStreamTtsBatchController } from './parallelStreamTtsBatchController';
import type { ParallelStreamTtsPlaybackContext } from './parallelStreamTtsRuntimeState';

function applyStreamEndCanonicalHandoffUiState(
  deps: ParallelStreamTtsPlaybackContext['deps'],
  kind: 'situation_2' | 'situation_3',
  handoffToSpeak: string,
): void {
  advanceInterviewScenarioRefsAfterCanonicalShowScenarioCard(
    {
      currentScenarioRef: deps.currentScenarioRef,
      currentInterviewMomentRef: deps.currentInterviewMomentRef,
      interviewMomentsCompleteRef: deps.interviewMomentsCompleteRef,
      resumeActiveScenarioRef: deps.resumeActiveScenarioRef,
      interviewSessionIdRef: deps.interviewSessionIdRef,
    },
    kind,
  );
  deps.applyReferenceCardFromAssistantSpeechRef?.current?.(handoffToSpeak);
}

function releaseStreamEndSequentialHandoffTtsState(
  deps: ParallelStreamTtsPlaybackContext['deps'],
): void {
  if (deps.ttsUtteranceInFlightRef) {
    deps.ttsUtteranceInFlightRef.current = null;
  }
  deps.ttsLineInFlightRef.current = false;
  if (deps.userId) {
    setTtsPlaybackActive(false);
  }
}

/** Parallel stream keeps playback-active between chunks until finalize; handoffs must not drain 8s. */
function releaseStaleParallelStreamPlaybackBeforeStreamEndHandoff(
  deps: ParallelStreamTtsPlaybackContext['deps'],
): void {
  deps.ttsLineInFlightRef.current = false;
  if (deps.userId) {
    setTtsPlaybackActive(false);
  }
}

async function awaitParallelStreamPlaybackSettledBeforeStreamEndHandoff(args: {
  batch: ParallelStreamTtsBatchController;
  state: ParallelStreamTtsPlaybackContext['state'];
  deps: ParallelStreamTtsPlaybackContext['deps'];
}): Promise<void> {
  args.batch.flushParallelTtsBatch(true);
  await args.state.ttsChain;
  releaseStaleParallelStreamPlaybackBeforeStreamEndHandoff(args.deps);
}

export async function flushParallelStreamDeferredSentencesAtEnd(args: {
  ctx: ParallelStreamTtsPlaybackContext;
  batch: ParallelStreamTtsBatchController;
  maybeQueueSentenceForTts: MaybeQueueParallelStreamSentenceForTts;
  speakScenarioAContemptProbeStreamOnce: () => Promise<void>;
  speakShowScenarioCardStreamOnce: () => Promise<void>;
}): Promise<void> {
  const { ctx, batch, maybeQueueSentenceForTts, speakScenarioAContemptProbeStreamOnce, speakShowScenarioCardStreamOnce } = args;
  const { deps, params, state } = ctx;
  const suppressRepairBeforeContempt = () =>
    shouldSuppressScenarioARepairBeforeContemptAnswer({
      currentScenario: deps.currentScenarioRef.current,
      currentMoment: deps.currentInterviewMomentRef.current,
      shouldForceScenarioAContemptProbe: params.shouldForceScenarioAContemptProbe,
      scenarioAContemptProbeSpokenThisStream: state.scenarioAContemptProbeSpokenThisStream,
      scenarioAContemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
      specificEmmaLineAlreadyAddressed: params.specificEmmaLineAlreadyAddressed,
      scenarioARepairQuestionAsked: deps.scenarioARepairQuestionAskedRef.current,
      allowScenarioARepairAfterContemptAnswer: params.allowScenarioARepairAfterContemptAnswer,
    });
  const discardParallelBatchRepairLeak = (logTag: string) => {
    const batchText = batch.parallelTtsBatchDeduped();
    const discard = clearParallelTtsBatchIfScenarioARepairLeakBeforeContempt({
      batchText,
      suppressRepairBeforeContempt: suppressRepairBeforeContempt(),
      streamContemptProbeMuteArmedFromStart: ctx.streamContemptProbeMuteArmedFromStart,
    });
    if (discard.discarded) {
      state.parallelTtsBatchBuffer = '';
      state.parallelTtsBatchPrefetch = null;
      void remoteLog(logTag, {
        preview: batchText.slice(0, 220),
        s1ContemptFixVersion: 21,
      });
      return true;
    }
    return false;
  };

  if (state.sentenceBuffer.trim() && !state.streamContemptProbeMuteActive) {
    const tail = state.sentenceBuffer.trim();
    if (state.moment5StickyCloseBufferAll) {
      state.moment5ClosingStreamBuffer = state.moment5ClosingStreamBuffer
        ? `${state.moment5ClosingStreamBuffer} ${tail}`.trim()
        : tail;
    } else {
      maybeQueueSentenceForTts(state.sentenceBuffer);
    }
    state.sentenceBuffer = '';
  }
  if (state.streamContemptProbeMuteActive) {
    if (state.sentenceBuffer.trim()) {
      state.scenarioAContemptProbeStreamBuffer = state.scenarioAContemptProbeStreamBuffer
        ? `${state.scenarioAContemptProbeStreamBuffer} ${state.sentenceBuffer.trim()}`.trim()
        : state.sentenceBuffer.trim();
      state.sentenceBuffer = '';
    }
    if (state.deferredScenarioAContemptProbeLeadSentence) {
      state.scenarioAContemptProbeStreamBuffer = mergeDeferredScenarioAContemptProbeLeadWithNextSentence(
        state.deferredScenarioAContemptProbeLeadSentence,
        state.scenarioAContemptProbeStreamBuffer,
      );
      state.deferredScenarioAContemptProbeLeadSentence = null;
    }
    await speakScenarioAContemptProbeStreamOnce();
  }
  if (!state.showScenarioCardCanonicalSpokenThisStream && !state.scenarioAContemptProbeSpokenThisStream) {
    await speakShowScenarioCardStreamOnce();
  }
  await awaitParallelStreamPlaybackSettledBeforeStreamEndHandoff({ batch, state, deps });
  const repairSatisfiedHandoffPending =
    state.pendingS1RepairSatisfiedHandoff || state.pendingS2RepairSatisfiedHandoff;
  if (!repairSatisfiedHandoffPending) {
    await speakMissedScenarioBoundaryLeadAtStreamEnd(ctx);
  }
  if (
    state.pendingS1RepairSatisfiedHandoff &&
    !state.s1RepairSatisfiedHandoffSpokenThisStream &&
    isActiveScenarioAConstructProbeTurn(deps.currentScenarioRef.current, deps.currentInterviewMomentRef.current) &&
    scenarioAMinimumEngagementForHandoff(params.messagesToUse)
  ) {
    state.pendingS1RepairSatisfiedHandoff = false;
    const advanceBundle = applyPostClaudeScenarioAdvanceBundleOverride(
      '',
      params.participantFirstNameForSpoken,
      params.messagesToUse,
      deps.currentInterviewMomentRef.current,
      deps.currentScenarioRef.current,
    );
    /**
     * Stream already suppressed post-repair follow-ups / boundary paraphrases.
     * If transcript walk-back fails to re-confirm repair context, still speak the
     * canonical S1→S2 client bundle so we never stall on a brief ack alone.
     */
    const fallbackS1Bundle = `[SCENARIO_COMPLETE:1]\n\n${buildScenario1To2BundleForInterview(
      params.participantFirstNameForSpoken,
      SCENARIO_2_TEXT,
      resolveScenarioUserTextForBoundaryReflection(params.messagesToUse, 1),
    )}`;
    const handoffText = stripControlTokens(
      await enrichScenarioBoundaryHandoffBundleWithDynamicLead({
        bundleText: advanceBundle ?? fallbackS1Bundle,
        firstName: params.participantFirstNameForSpoken,
        messages: params.messagesToUse,
        completedScenario: 1,
        interviewSessionId: deps.interviewSessionIdRef.current,
      }),
    );
    const spokenSoFar = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
    let handoffToSpeak = handoffText;
    if (handoffToSpeak && scenarioHandoffBundleMissingNextSegmentVignette(handoffToSpeak, 1)) {
      handoffToSpeak = stripControlTokens(fallbackS1Bundle);
      void remoteLog('[S1_S2_HANDOFF_INCOMPLETE_BUNDLE_REPLACED]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: handoffToSpeak.slice(0, 280),
      });
    }
    if (handoffToSpeak && !textContainsScenarioBVignetteBody(spokenSoFar)) {
      const resolvedHandoff = resolveStreamEndHandoffSpeechAfterPartialBoundaryLead(
        handoffToSpeak,
        spokenSoFar,
        1,
      );
      if (!resolvedHandoff) {
        state.pendingS1RepairSatisfiedHandoff = false;
      } else {
      handoffToSpeak = resolvedHandoff;
      state.s1RepairSatisfiedHandoffSpokenThisStream = true;
      batch.flushParallelTtsBatch(true);
      await state.ttsChain;
      void remoteLog('[S1_REPAIR_SATISFIED_HANDOFF_STREAM_END_SPEAK]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: handoffToSpeak.slice(0, 280),
        streamSpokePreview: spokenSoFar.slice(0, 120),
        usedFallbackBundle: !advanceBundle,
      });
      /**
       * Arm utterance text only (not line/playback flags) so tab-hide during S2 open
       * restores the vignette. prepareSpeakTextSafeMainPlayback sets line-in-flight and
       * playback-active after drainPriorTtsPlaybackBeforeSpeak; pre-arming those here
       * makes drain wait the full 8s timeout after the boundary lead just finished.
       */
      if (deps.ttsUtteranceInFlightRef) {
        deps.ttsUtteranceInFlightRef.current = handoffToSpeak;
      }
      deps.parallelStreamingTtsRef.current.accumulatedFullText = spokenSoFar
        ? `${spokenSoFar}\n\n${handoffToSpeak}`.trim()
        : handoffToSpeak;
      deps.lastQuestionTextRef.current = SCENARIO_2_OPENING;
      try {
        await deps.speakTextSafe(handoffToSpeak, SHOW_SCENARIO_CARD_CANONICAL_SPEECH);
        if (deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef) {
          deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current = {
            ...deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current,
            situation_2: true,
          };
        }
        applyStreamEndCanonicalHandoffUiState(deps, 'situation_2', handoffToSpeak);
      } finally {
        releaseStreamEndSequentialHandoffTtsState(deps);
      }
      deps.parallelStreamingTtsRef.current.spokenCompleteText = spokenSoFar
        ? `${spokenSoFar} ${handoffToSpeak}`.trim()
        : handoffToSpeak;
      params.textToParallelStream.spokenStarted = true;
      deps.recordInterviewAssistantDeliveryForMetaExemptionRef.current(handoffToSpeak);
      triggerCompletedScenarioScoringIfNeeded({
        completedScenario: 1,
        messagesForScoring: params.messagesToUse,
        trigger: 's1_repair_satisfied_handoff_stream_end',
        ensureCompletedScenarioScored: deps.ensureCompletedScenarioScored,
      });
      }
    }
  } else if (state.pendingS1RepairSatisfiedHandoff) {
    state.pendingS1RepairSatisfiedHandoff = false;
  }
  if (state.pendingS2RepairSatisfiedHandoff && !state.s2RepairSatisfiedHandoffSpokenThisStream) {
    if (
      shouldSkipS2ToS3HandoffReplayAtStreamEnd({
        currentScenario: deps.currentScenarioRef.current,
        messages: params.messagesToUse,
      })
    ) {
      state.pendingS2RepairSatisfiedHandoff = false;
      void remoteLog('[S2_S3_HANDOFF_SKIPPED_ALREADY_ON_S3]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        scenarioRef: deps.currentScenarioRef.current,
        momentRef: deps.currentInterviewMomentRef.current,
      });
    } else {
    state.pendingS2RepairSatisfiedHandoff = false;
    const advanceBundle = applyPostClaudeScenarioAdvanceBundleOverride(
      '',
      params.participantFirstNameForSpoken,
      params.messagesToUse,
      deps.currentInterviewMomentRef.current,
      deps.currentScenarioRef.current,
    );
    const fallbackS2Bundle = `[SCENARIO_COMPLETE:2]\n\n${buildScenario2To3BundleForInterview(
      params.participantFirstNameForSpoken,
      SCENARIO_3_TEXT,
      resolveScenarioUserTextForBoundaryReflection(params.messagesToUse, 2),
    )}`;
    const handoffText = stripControlTokens(
      await enrichScenarioBoundaryHandoffBundleWithDynamicLead({
        bundleText: advanceBundle ?? fallbackS2Bundle,
        firstName: params.participantFirstNameForSpoken,
        messages: params.messagesToUse,
        completedScenario: 2,
        interviewSessionId: deps.interviewSessionIdRef.current,
      }),
    );
    const spokenSoFar = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
    let handoffToSpeak = handoffText;
    if (handoffToSpeak && scenarioHandoffBundleMissingNextSegmentVignette(handoffToSpeak, 2)) {
      handoffToSpeak = stripControlTokens(fallbackS2Bundle);
      void remoteLog('[S2_S3_HANDOFF_INCOMPLETE_BUNDLE_REPLACED]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: handoffToSpeak.slice(0, 280),
      });
    }
    if (handoffToSpeak && !isExactShowScenario3VignetteText(spokenSoFar)) {
      const resolvedHandoff = resolveStreamEndHandoffSpeechAfterPartialBoundaryLead(
        handoffToSpeak,
        spokenSoFar,
        2,
      );
      if (!resolvedHandoff) {
        state.pendingS2RepairSatisfiedHandoff = false;
      } else {
      handoffToSpeak = resolvedHandoff;
      state.s2RepairSatisfiedHandoffSpokenThisStream = true;
      batch.flushParallelTtsBatch(true);
      await state.ttsChain;
      void remoteLog('[S2_REPAIR_SATISFIED_HANDOFF_STREAM_END_SPEAK]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: handoffToSpeak.slice(0, 280),
        streamSpokePreview: spokenSoFar.slice(0, 120),
        usedFallbackBundle: !advanceBundle,
      });
      if (deps.ttsUtteranceInFlightRef) {
        deps.ttsUtteranceInFlightRef.current = handoffToSpeak;
      }
      deps.parallelStreamingTtsRef.current.accumulatedFullText = spokenSoFar
        ? `${spokenSoFar}\n\n${handoffToSpeak}`.trim()
        : handoffToSpeak;
      deps.lastQuestionTextRef.current = SCENARIO_3_OPENING;
      try {
        await deps.speakTextSafe(handoffToSpeak, SHOW_SCENARIO_CARD_CANONICAL_SPEECH);
        if (deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef) {
          deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current = {
            ...deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current,
            situation_3: true,
          };
        }
        applyStreamEndCanonicalHandoffUiState(deps, 'situation_3', handoffToSpeak);
      } finally {
        releaseStreamEndSequentialHandoffTtsState(deps);
      }
      deps.parallelStreamingTtsRef.current.spokenCompleteText = spokenSoFar
        ? `${spokenSoFar} ${handoffToSpeak}`.trim()
        : handoffToSpeak;
      params.textToParallelStream.spokenStarted = true;
      deps.recordInterviewAssistantDeliveryForMetaExemptionRef.current(handoffToSpeak);
      triggerCompletedScenarioScoringIfNeeded({
        completedScenario: 2,
        messagesForScoring: params.messagesToUse,
        trigger: 's2_repair_satisfied_handoff_stream_end',
        ensureCompletedScenarioScored: deps.ensureCompletedScenarioScored,
      });
      }
    }
    }
  } else if (state.pendingS2RepairSatisfiedHandoff) {
    state.pendingS2RepairSatisfiedHandoff = false;
  }
  if (state.deferredWarmBoundarySentence) {
    const hold: string = state.deferredWarmBoundarySentence;
    state.deferredWarmBoundarySentence = null;
    if (state.parallelTtsBatchBuffer.trim()) {
      state.parallelTtsBatchBuffer = `${hold} ${state.parallelTtsBatchBuffer}`.trim();
      state.parallelTtsBatchPrefetch = null;
      if (!discardParallelBatchRepairLeak('[S1_BATCH_WARM_DEFER_FLUSH_DISCARDED_BEFORE_CONTEMPT]')) {
        batch.flushParallelTtsBatch(true);
      }
    } else if (params.textToParallelStream.spokenStarted) {
      void remoteLog('[BOUNDARY_WARM_DEFERRED_DROPPED_AFTER_STREAM_SPOKE]', {
        preview: hold.slice(0, 120),
      });
    } else {
      maybeQueueSentenceForTts(hold, false);
    }
  }
  if (state.deferredScenarioARepairLeadSentence) {
    const holdRepair = state.deferredScenarioARepairLeadSentence;
    state.deferredScenarioARepairLeadSentence = null;
    const suppressRepairBeforeContempt = shouldSuppressScenarioARepairBeforeContemptAnswer({
      currentScenario: deps.currentScenarioRef.current,
      currentMoment: deps.currentInterviewMomentRef.current,
      shouldForceScenarioAContemptProbe: params.shouldForceScenarioAContemptProbe,
      scenarioAContemptProbeSpokenThisStream: state.scenarioAContemptProbeSpokenThisStream,
      scenarioAContemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
      specificEmmaLineAlreadyAddressed: params.specificEmmaLineAlreadyAddressed,
      scenarioARepairQuestionAsked: deps.scenarioARepairQuestionAskedRef.current,
      allowScenarioARepairAfterContemptAnswer: params.allowScenarioARepairAfterContemptAnswer,
    });
    if (suppressRepairBeforeContempt) {
      void remoteLog('[S1_DEFERRED_REPAIR_FLUSH_SUPPRESSED_BEFORE_CONTEMPT]', {
        preview: holdRepair.slice(0, 220),
        s1ContemptFixVersion: 20,
      });
    } else {
      const repairFlushText = resolveInterviewQuestionRepeatTtsText(holdRepair);
      maybeQueueSentenceForTts(repairFlushText, false);
    }
  } else if (
    isActiveScenarioAConstructProbeTurn(deps.currentScenarioRef.current, deps.currentInterviewMomentRef.current) &&
    deps.scenarioAContemptProbeAskedRef.current &&
    !state.scenarioARepairQuestionSpokenThisStream &&
    (params.allowScenarioARepairAfterContemptAnswer || state.pendingScenarioARepairAfterContemptFlush) &&
    shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY)
  ) {
    state.pendingScenarioARepairAfterContemptFlush = false;
    state.scenarioARepairQuestionSpokenThisStream = true;
    maybeQueueSentenceForTts(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY, false);
  }
  if (state.deferredScenarioARepairShortAckSentence) {
    const holdAck = state.deferredScenarioARepairShortAckSentence;
    state.deferredScenarioARepairShortAckSentence = null;
    if (
      (params.allowScenarioARepairAfterContemptAnswer ||
        state.pendingScenarioARepairAfterContemptFlush) &&
      shouldDeliverScenarioFollowUpQuestion(
        params.messagesToUse,
        SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
      ) &&
      !state.scenarioARepairQuestionSpokenThisStream
    ) {
      state.pendingScenarioARepairAfterContemptFlush = false;
      state.scenarioARepairQuestionSpokenThisStream = true;
      void remoteLog('[S1_REPAIR_SHORT_ACK_FLUSH_CANONICAL]', {
        preview: holdAck.slice(0, 80),
        s1ContemptFixVersion: 24,
      });
      maybeQueueSentenceForTts(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY, false);
    } else {
      void remoteLog('[S1_REPAIR_SHORT_ACK_DEFERRED_DROPPED]', {
        preview: holdAck.slice(0, 80),
        s1ContemptFixVersion: 24,
      });
    }
  }
  if (
    isActiveScenarioAConstructProbeTurn(deps.currentScenarioRef.current, deps.currentInterviewMomentRef.current) &&
    deps.scenarioAContemptProbeAskedRef.current &&
    !state.scenarioARepairQuestionSpokenThisStream &&
    shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY)
  ) {
    const spokenSoFar = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
    if (
      spokenSoFar &&
      isShortAckOnlySentence(spokenSoFar) &&
      !looksLikeScenarioARepairQuestion(spokenSoFar)
    ) {
      state.scenarioARepairQuestionSpokenThisStream = true;
      void remoteLog('[S1_REPAIR_SHORT_ACK_SPOKEN_FLUSH_CANONICAL]', {
        preview: spokenSoFar.slice(0, 80),
        s1ContemptFixVersion: 25,
      });
      maybeQueueSentenceForTts(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY, false);
    }
  }
  if (state.deferredScenarioBJamesShortAckSentence) {
    const holdAck = state.deferredScenarioBJamesShortAckSentence;
    state.deferredScenarioBJamesShortAckSentence = null;
    if (state.deferredScenarioBJamesDifferentlyLeadSentence) {
      const merged = coerceScenarioBJamesDifferentlyQuestionForTts(
        `${holdAck} ${state.deferredScenarioBJamesDifferentlyLeadSentence}`.trim(),
      );
      state.deferredScenarioBJamesDifferentlyLeadSentence = null;
      maybeQueueSentenceForTts(merged, false);
    } else if (deps.currentScenarioRef.current === 2) {
      maybeQueueSentenceForTts(`${holdAck} ${SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL}`.trim(), false);
    } else {
      maybeQueueSentenceForTts(holdAck, false);
    }
  } else if (state.deferredScenarioBJamesDifferentlyLeadSentence) {
    const holdJames = state.deferredScenarioBJamesDifferentlyLeadSentence;
    state.deferredScenarioBJamesDifferentlyLeadSentence = null;
    maybeQueueSentenceForTts(coerceScenarioBJamesDifferentlyQuestionForTts(holdJames), false);
  } else if (state.deferredScenarioBJamesSayToJamesLeadSentence) {
    const holdSayToJames = state.deferredScenarioBJamesSayToJamesLeadSentence;
    state.deferredScenarioBJamesSayToJamesLeadSentence = null;
    maybeQueueSentenceForTts(
      coerceScenarioBJamesSayToJamesQuestionForTts(
        holdSayToJames,
        params.shouldForceScenarioBJamesRepairProbe,
      ),
      false,
    );
  }
  if (state.deferredScenarioCShortAckSentence) {
    const holdAck = state.deferredScenarioCShortAckSentence;
    state.deferredScenarioCShortAckSentence = null;
    const nextProbe = coerceScenarioCNextProbeForStreamTts(params.messagesToUse);
    const repairConstructPending = scenarioCRepairConstructStillPending(params.messagesToUse);
    const sophieDue =
      looksLikeScenarioCSophiePerspectiveQuestion(nextProbe) &&
      !scenarioCSophiePerspectiveProbeAlreadyDelivered(params.messagesToUse);
    const repairDue =
      isScenarioCRepairAssistantPrompt(nextProbe) &&
      ((!deps.s3RepairProbeDeliveredRef.current && !state.scenarioCRepairQuestionSpokenThisStream) ||
        (repairConstructPending && !state.scenarioCRepairQuestionSpokenThisStream));
    if (sophieDue || repairDue) {
      if (looksLikeScenarioCSophiePerspectiveQuestion(nextProbe)) {
        state.scenarioCSophiePerspectiveProbeSpokenThisStream = true;
      } else if (isScenarioCRepairAssistantPrompt(nextProbe)) {
        state.scenarioCRepairQuestionSpokenThisStream = true;
      }
      void remoteLog('[S3_Q1_SHORT_ACK_FLUSH_CANONICAL]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: `${holdAck} ${nextProbe}`.trim().slice(0, 220),
      });
      maybeQueueSentenceForTts(`${holdAck} ${nextProbe}`.trim(), false);
    } else {
      void remoteLog('[S3_Q1_SHORT_ACK_DEFERRED_DROPPED]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: holdAck.slice(0, 80),
      });
    }
  } else if (
    state.pendingScenarioCNextProbeFlush &&
    deps.currentScenarioRef.current === 3 &&
    !transcriptContainsScenarioCRepairQuestion(params.messagesToUse)
  ) {
    state.pendingScenarioCNextProbeFlush = false;
    const nextProbe = coerceScenarioCNextProbeForStreamTts(params.messagesToUse);
    const repairConstructPending = scenarioCRepairConstructStillPending(params.messagesToUse);
    const sophieDue =
      looksLikeScenarioCSophiePerspectiveQuestion(nextProbe) &&
      !scenarioCSophiePerspectiveProbeAlreadyDelivered(params.messagesToUse);
    const repairDue =
      isScenarioCRepairAssistantPrompt(nextProbe) &&
      ((!deps.s3RepairProbeDeliveredRef.current && !state.scenarioCRepairQuestionSpokenThisStream) ||
        (repairConstructPending && !state.scenarioCRepairQuestionSpokenThisStream));
    if (sophieDue || repairDue) {
      if (looksLikeScenarioCSophiePerspectiveQuestion(nextProbe)) {
        state.scenarioCSophiePerspectiveProbeSpokenThisStream = true;
      } else if (isScenarioCRepairAssistantPrompt(nextProbe)) {
        state.scenarioCRepairQuestionSpokenThisStream = true;
      }
      void remoteLog('[S3_NEXT_PROBE_FLUSH_AT_STREAM_END]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: nextProbe.slice(0, 220),
      });
      maybeQueueSentenceForTts(nextProbe, false);
    }
  }
  if (state.deferredScenarioAContemptProbeLeadSentence) {
    if (state.streamContemptProbeMuteActive) {
      state.scenarioAContemptProbeStreamBuffer = mergeDeferredScenarioAContemptProbeLeadWithNextSentence(
        state.deferredScenarioAContemptProbeLeadSentence,
        state.scenarioAContemptProbeStreamBuffer,
      );
    } else {
      maybeQueueSentenceForTts(state.deferredScenarioAContemptProbeLeadSentence, false);
    }
    state.deferredScenarioAContemptProbeLeadSentence = null;
  }
  if (state.deferredInterviewClosingLeadSentence) {
    if (deps.currentInterviewMomentRef.current === 5) {
      state.moment5ClosingStreamBuffer = state.moment5ClosingStreamBuffer
        ? `${state.moment5ClosingStreamBuffer} ${state.deferredInterviewClosingLeadSentence}`.trim()
        : state.deferredInterviewClosingLeadSentence;
    } else {
      maybeQueueSentenceForTts(state.deferredInterviewClosingLeadSentence, false, true);
    }
    state.deferredInterviewClosingLeadSentence = null;
  }
  if (state.moment5ClosingStreamBuffer.trim()) {
    const rawBuffer = state.moment5ClosingStreamBuffer.trim();
    const strippedBuffer = stripInternalReflectionSchemaLeak(
      stripDuplicateInterviewClosingSentencesWithinDraft(rawBuffer),
    );
    state.moment5ClosingStreamBuffer = '';
    const closeGateForBufferedFlush = computeMoment5InterviewCloseGate(params.messagesToUse ?? [], {
      moment5QuestionDelivered: deps.moment5QuestionDeliveredRef.current,
      moment5PrimaryAnchorSession: deps.moment5PrimaryAnchorDeliveredSessionRef.current,
      postM5UserTurnsRef: deps.moment5PostPromptUserTurnCountRef.current,
      accountabilityProbeFired: deps.moment5AccountabilityProbeFiredRef.current,
      currentInterviewMoment: deps.currentInterviewMomentRef.current,
      moment5ResolutionDelivered: deps.moment5ResolutionDeliveredRef.current,
    });
    const resolutionBuffered = looksLikeMoment5ResolutionFollowUpPrompt(strippedBuffer);
    const accountabilityBuffered = looksLikeMoment5AccountabilityProbeAssistantPrompt(strippedBuffer);
    const skipConfirmationBuffered = looksLikeSkipConfirmationAssistantPrompt(strippedBuffer);
    if (
      strippedBuffer.trim() &&
      !closeGateForBufferedFlush.moment5CloseAllowed &&
      skipConfirmationBuffered
    ) {
      void remoteLog('[M5_BUFFERED_SKIP_CONFIRMATION_FLUSH]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: strippedBuffer.slice(0, 220),
        rawBufferPreview: rawBuffer.slice(0, 160),
      });
      maybeQueueSentenceForTts(strippedBuffer, false, true);
    } else if (
      strippedBuffer.trim() &&
      !closeGateForBufferedFlush.moment5CloseAllowed &&
      (resolutionBuffered ||
        (accountabilityBuffered && closeGateForBufferedFlush.accountabilityProbeStillRequired))
    ) {
      const probeFlushText = resolutionBuffered
        ? stripInterviewClosingBundledWithMoment5ResolutionFollowUp(strippedBuffer).trim()
        : strippedBuffer.trim();
      if (
        probeFlushText &&
        !looksLikeInterviewClosingAssistantMessage(probeFlushText)
      ) {
        void remoteLog('[M5_BUFFERED_PROBE_FLUSH]', {
          interviewSessionId: deps.interviewSessionIdRef.current,
          resolutionBuffered,
          accountabilityBuffered,
          accountabilityProbeStillRequired:
            closeGateForBufferedFlush.accountabilityProbeStillRequired,
          resolutionFollowUpStillRequired:
            closeGateForBufferedFlush.resolutionFollowUpStillRequired,
          preview: probeFlushText.slice(0, 220),
          rawBufferPreview: rawBuffer.slice(0, 160),
        });
        maybeQueueSentenceForTts(probeFlushText, false, true);
      } else {
        void remoteLog('[M5_BUFFERED_PROBE_FLUSH_SKIPPED]', {
          interviewSessionId: deps.interviewSessionIdRef.current,
          preview: probeFlushText?.slice(0, 220) ?? null,
          rawBufferPreview: rawBuffer.slice(0, 160),
        });
      }
    } else {
    const m5UserForClosing = extractMoment5AnswerForClosingReflection(params.messagesToUse ?? []);
    const closingPillarContext = deriveClosingPillarContextFromScenarioScores(
      deps.scenarioScoresRef.current,
    );
    let dedupedClosing = coerceIncompleteInterviewClosingForTts(
      enrichPersonalMomentClosingForTts(
        strippedBuffer,
        params.participantFirstNameForSpoken,
        m5UserForClosing,
        closingPillarContext,
      ),
      params.participantFirstNameForSpoken,
    );
    if (!dedupedClosing.trim()) {
      dedupedClosing = enrichPersonalMomentClosingForTts(
        '',
        params.participantFirstNameForSpoken,
        m5UserForClosing,
        closingPillarContext,
      );
    }
    void remoteLog('[M5_CLOSING_STREAM_FLUSH]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: dedupedClosing.slice(0, 220),
      rawBufferPreview: rawBuffer.slice(0, 160),
    });
    if (dedupedClosing.trim()) {
      const closingTtsSessionKey =
        deps.interviewSessionAttemptIdRef.current ?? deps.interviewSessionIdRef.current;
      const closingFlushLooksFinal = looksLikeInterviewClosingAssistantMessage(dedupedClosing);
      const closeGateForStreamFlush = computeMoment5InterviewCloseGate(params.messagesToUse ?? [], {
        moment5QuestionDelivered: deps.moment5QuestionDeliveredRef.current,
        moment5PrimaryAnchorSession: deps.moment5PrimaryAnchorDeliveredSessionRef.current,
        postM5UserTurnsRef: deps.moment5PostPromptUserTurnCountRef.current,
        accountabilityProbeFired: deps.moment5AccountabilityProbeFiredRef.current,
        currentInterviewMoment: deps.currentInterviewMomentRef.current,
        moment5ResolutionDelivered: deps.moment5ResolutionDeliveredRef.current,
      });
      if (closingFlushLooksFinal && !closeGateForStreamFlush.moment5CloseAllowed) {
        void remoteLog('[M5_CLOSING_STREAM_FLUSH_SUPPRESSED_PRE_CLOSE_GATE]', {
          interviewSessionId: deps.interviewSessionIdRef.current,
          accountabilityProbeStillRequired: closeGateForStreamFlush.accountabilityProbeStillRequired,
          resolutionFollowUpStillRequired: closeGateForStreamFlush.resolutionFollowUpStillRequired,
          resolutionFollowUpAwaitingAnswer: closeGateForStreamFlush.resolutionFollowUpAwaitingAnswer,
          postM5UserTurns: closeGateForStreamFlush.postM5UserTurns,
          preview: dedupedClosing.slice(0, 220),
        });
      } else if (
        shouldSuppressDuplicateInterviewClosingTts(closingTtsSessionKey, dedupedClosing) &&
        hasInterviewClosingTtsDeliveredForSession(closingTtsSessionKey)
      ) {
        void remoteLog('[M5_CLOSING_TTS_SUPPRESSED_DUPLICATE]', {
          interviewSessionId: deps.interviewSessionIdRef.current,
          source: 'm5_closing_stream_flush',
          preview: dedupedClosing.slice(0, 220),
        });
        if (closingFlushLooksFinal) {
          params.textToParallelStream.spokenStarted = true;
        }
      } else {
        if (
          shouldSuppressDuplicateInterviewClosingTts(closingTtsSessionKey, dedupedClosing) &&
          !hasInterviewClosingTtsDeliveredForSession(closingTtsSessionKey)
        ) {
          void remoteLog('[M5_CLOSING_TTS_SUPPRESSED_DUPLICATE]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            source: 'm5_closing_stream_flush_stale_in_flight',
            preview: dedupedClosing.slice(0, 220),
          });
          releaseInterviewClosingSpeak(closingTtsSessionKey);
        } else if (closingFlushLooksFinal && !tryAcquireInterviewClosingSpeak(closingTtsSessionKey)) {
          void remoteLog('[M5_CLOSING_FLUSH_SUPPRESSED_IN_FLIGHT]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: dedupedClosing.slice(0, 220),
          });
          if (!hasInterviewClosingTtsDeliveredForSession(closingTtsSessionKey)) {
            releaseInterviewClosingSpeak(closingTtsSessionKey);
            tryAcquireInterviewClosingSpeak(closingTtsSessionKey);
          }
        }
        maybeQueueSentenceForTts(dedupedClosing, false, true);
      }
    }
    }
  }
  if (state.deferredScenarioVignetteTailForOpeningMerge) {
    const heldTail = state.deferredScenarioVignetteTailForOpeningMerge;
    state.deferredScenarioVignetteTailForOpeningMerge = null;
    if (!state.streamShowScenarioCardMuteActive && !state.showScenarioCardCanonicalSpokenThisStream) {
      maybeQueueSentenceForTts(heldTail, false);
    }
  }
  const endBatchBeforeDiscard = batch.parallelTtsBatchDeduped();
  const endDiscard = clearParallelTtsBatchIfScenarioARepairLeakBeforeContempt({
    batchText: endBatchBeforeDiscard,
    suppressRepairBeforeContempt: suppressRepairBeforeContempt(),
    streamContemptProbeMuteArmedFromStart: ctx.streamContemptProbeMuteArmedFromStart,
  });
  discardParallelBatchRepairLeak('[S1_BATCH_END_FLUSH_DISCARDED_BEFORE_CONTEMPT]');
  batch.flushParallelTtsBatch(true);
  if (!state.streamContemptProbeMuteActive) {
    await state.ttsChain;
  }
}

export async function finalizeParallelStreamPlaybackSession(ctx: ParallelStreamTtsPlaybackContext): Promise<void> {
  const { deps, params } = ctx;
  deps.recordingJustFinishedBeforeNextTtsRef.current = false;
  deps.postRecordingParallelStreamSettleRef.current = false;
  deps.parallelStreamingTtsRef.current.active = false;
  if (deps.userId) {
    setTtsPlaybackActive(false);
    deps.ttsLineInFlightRef.current = false;
  }
  if (params.metaFrustrationFirstSignalBuffered) {
    await runParallelStreamMetaFrustrationBufferedTts(ctx);
  }
  if (params.textToParallelStream.spokenStarted) {
    deps.setVoiceState('idle');
  }
}

export async function runParallelStreamMetaFrustrationBufferedTts(
  ctx: ParallelStreamTtsPlaybackContext,
): Promise<void> {
  const { deps, params } = ctx;
  let display = stripControlTokens(params.textToParallelStream.full).trim();
  if (isApprovedElongatingProbeOnly(display)) {
    const excerpt = lastSubstantivePriorUserExcerptInScenario(
      params.messagesToUse,
      params.userScenarioTag as 1 | 2 | 3,
    );
    display = buildClientFrustrationMetaFallbackAssistantText({
      lastQuestionText: deps.lastQuestionTextRef.current,
      userTranscript: params.trimmed,
      hadPriorSubstantiveAnswerInMoment: params.hadPriorSubstantiveAnswerForFrustrationOffer,
      priorSubstantiveUserExcerpt: excerpt,
    });
    void remoteLog('[META_FRUSTRATION_ELONGATING_BUFFER_OVERRIDE]', {
      replaced: true,
      preview: display.slice(0, 240),
    });
  }
  display = stripDuplicateScenarioAContemptProbeParagraphs(
    display,
    params.messagesToUse,
    deps.currentInterviewMomentRef.current,
    deps.scenarioAContemptProbeAskedRef.current,
  );
  display = stripDuplicateScenarioARepairQuestionParagraphs(
    display,
    params.messagesToUse,
    deps.currentInterviewMomentRef.current,
    deps.scenarioARepairQuestionAskedRef.current,
  );
  if (
    isActiveScenarioAConstructProbeTurn(
      deps.currentScenarioRef.current,
      deps.currentInterviewMomentRef.current,
    ) &&
    !shouldSkipScenarioARepairDraftNormalization(display)
  ) {
    display = normalizeScenarioARepairQuestionInAssistantDraft(display);
  }
  if (looksLikeInterviewClosingAssistantMessage(display)) {
    display = stripDuplicateInterviewClosingSentencesWithinDraft(display);
    params.textToParallelStream.closingSpoken = true;
  }
  params.textToParallelStream.full = display;
  const spokenSan = ensureCanonicalIntroBriefingForTts(
    substituteCanonicalInterviewScenarioBodiesForTts(
      dedupeAdjacentBoundaryValidationsBeforeParticipantName(
        sanitizeAssistantInterviewerCharacterNames(display),
        params.participantFirstNameForSpoken,
      ),
    ),
    params.participantFirstNameForSpoken,
  );
  const spokenFinal = ensureSpokenTextIncludesParticipantFirstName(spokenSan, params.participantFirstNameForSpoken, {
    allowAppendWhenMissing: true,
  });
  params.textToParallelStream.spokenStarted = true;
  deps.setVoiceState('speaking');
  deps.recordInterviewAssistantDeliveryForMetaExemptionRef.current(stripControlTokens(spokenFinal).trim());
  if (deps.userId) {
    const rtd = getSessionLogRuntime();
    writeSessionLog({
      userId: deps.userId,
      attemptId: rtd.attemptId,
      eventType: 'question_delivered',
      eventData: {
        moment_number: deps.currentInterviewMomentRef.current,
        scenario_number: deps.currentScenarioRef.current,
        question_text: resolveAssessableQuestionTextForResponseTiming(
          stripControlTokens(spokenFinal).trim(),
        ).slice(0, 2000),
        delivered_at: new Date().toISOString(),
        tts_pipeline: 'meta_frustration_buffered',
      },
      platform: rtd.platform,
    });
  }
  await deps.speakTextSafe(spokenFinal, ASSISTANT_INTERVIEW_SPEECH);
}

export function resetParallelStreamOnError(ctx: ParallelStreamTtsPlaybackContext): void {
  const { deps, params, state } = ctx;
  state.ttsCancelled = true;
  state.deferredWarmBoundarySentence = null;
  state.deferredScenarioARepairShortAckSentence = null;
  state.deferredScenarioCShortAckSentence = null;
  state.pendingScenarioCNextProbeFlush = false;
  deps.recordingJustFinishedBeforeNextTtsRef.current = false;
  deps.postRecordingParallelStreamSettleRef.current = false;
  deps.parallelStreamingTtsRef.current.active = false;
  if (deps.userId) {
    setTtsPlaybackActive(false);
    deps.ttsLineInFlightRef.current = false;
  }
  if (params.textToParallelStream.spokenStarted) {
    deps.setVoiceState('idle');
  }
}
