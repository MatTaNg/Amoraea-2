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
import { extractMoment5AnswerForClosingReflection } from '@features/aria/moment5TranscriptHelpers';
import { deriveClosingPillarContextFromScenarioScores } from '@features/aria/closingReflectionGrounding';
import { enrichPersonalMomentClosingForTts } from '@features/aria/personalMomentClosingEnrichment';
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
import { markS3RepairProbeTtsDelivered } from '@features/aria/scenarioCDeliveryReconcile';
import {
  coerceScenarioCNextProbeForStreamTts,
  coerceScenarioCRepairQuestionForTts,
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCSophiePerspectiveQuestion,
  scenarioCRepairConstructStillPending,
  scenarioCSophiePerspectiveProbeAlreadyDelivered,
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
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
import { getSessionLogRuntime, setTtsPlaybackActive, writeSessionLog } from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';

import { mergeDeferredScenarioAContemptProbeLeadWithNextSentence } from '@features/aria/scenarioAContemptProbeLogic';
import {
  applyPostClaudeScenarioAdvanceBundleOverride,
  resolveScenarioUserTextForBoundaryReflection,
} from '@features/aria/interviewScenarioAdvanceAfterRepair';
import { textContainsScenarioBVignetteBody } from '@features/aria/emotionScenarioTransitionInference';
import { isExactShowScenario3VignetteText } from '@features/aria/showScenarioCardCanonicalTts';
import { buildScenario1To2BundleForInterview, buildScenario2To3BundleForInterview, scenarioHandoffBundleMissingNextSegmentVignette } from '@features/aria/interviewTransitionBundles';
import { SCENARIO_2_TEXT, SCENARIO_3_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import { SCENARIO_2_OPENING, SCENARIO_3_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';
import { speakLongFormInterviewHtmlMp3 } from '@features/aria/utils/speakLongFormInterviewHtmlMp3';
import {
  isUnauthorizedS1TabRestoreFollowUp,
  looksLikeBriefStreamAckOnly,
  looksLikeScenarioHandoffOrVignetteBundle,
  looksLikeShortProbeFallback,
} from '@features/aria/computeParallelStreamTabRestoreText';

import type { MaybeQueueParallelStreamSentenceForTts } from './parallelStreamMaybeQueueSentenceForTts';
import { speakMissedScenarioBoundaryLeadAtStreamEnd } from './parallelStreamScenarioBoundaryHandoff';
import type { ParallelStreamTtsBatchController } from './parallelStreamTtsBatchController';
import type { ParallelStreamTtsPlaybackContext } from './parallelStreamTtsRuntimeState';

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
  await speakMissedScenarioBoundaryLeadAtStreamEnd(ctx);
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
    const handoffText = stripControlTokens(advanceBundle ?? fallbackS1Bundle);
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
       * HTML handoff bypasses speakTextSafe — arm in-flight so tab-hide during S2 open
       * restores the vignette, not a suppressed Ryan follow-up still in stream accum.
       */
      if (deps.webTtsUtteranceInFlightRef) {
        deps.webTtsUtteranceInFlightRef.current = handoffToSpeak;
      }
      deps.ttsLineInFlightRef.current = true;
      if (deps.userId) {
        setTtsPlaybackActive(true);
      }
      deps.parallelStreamingTtsRef.current.accumulatedFullText = handoffToSpeak;
      deps.lastQuestionTextRef.current = SCENARIO_2_OPENING;
      let htmlMp3Played = false;
      try {
        try {
          htmlMp3Played = await speakLongFormInterviewHtmlMp3({
            text: handoffToSpeak,
            telemetrySource: 'turn',
            onPlaybackStarted: () => deps.setVoiceState('speaking'),
          });
        } catch {
          htmlMp3Played = false;
        }
        if (!htmlMp3Played) {
          await deps.speakTextSafe(handoffToSpeak, SHOW_SCENARIO_CARD_CANONICAL_SPEECH);
        } else {
          deps.setVoiceState('idle');
        }
        if (deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef) {
          deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current = {
            ...deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current,
            situation_2: true,
          };
        }
      } finally {
        if (!deps.webTtsTabInterruptPendingReplayRef.current) {
          if (deps.webTtsUtteranceInFlightRef) {
            deps.webTtsUtteranceInFlightRef.current = null;
          }
          deps.ttsLineInFlightRef.current = false;
          if (deps.userId && !deps.parallelStreamingTtsRef.current.active) {
            setTtsPlaybackActive(false);
          }
        }
      }
      deps.parallelStreamingTtsRef.current.spokenCompleteText = handoffToSpeak;
      params.textToParallelStream.spokenStarted = true;
      deps.recordInterviewAssistantDeliveryForMetaExemptionRef.current(handoffToSpeak);
      triggerCompletedScenarioScoringIfNeeded({
        completedScenario: 1,
        messagesForScoring: params.messagesToUse,
        trigger: 's1_repair_satisfied_handoff_stream_end',
        ensureCompletedScenarioScored: deps.ensureCompletedScenarioScored,
      });
    }
  } else if (state.pendingS1RepairSatisfiedHandoff) {
    state.pendingS1RepairSatisfiedHandoff = false;
  }
  if (state.pendingS2RepairSatisfiedHandoff && !state.s2RepairSatisfiedHandoffSpokenThisStream) {
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
    const handoffText = stripControlTokens(advanceBundle ?? fallbackS2Bundle);
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
      state.s2RepairSatisfiedHandoffSpokenThisStream = true;
      batch.flushParallelTtsBatch(true);
      await state.ttsChain;
      void remoteLog('[S2_REPAIR_SATISFIED_HANDOFF_STREAM_END_SPEAK]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: handoffToSpeak.slice(0, 280),
        streamSpokePreview: spokenSoFar.slice(0, 120),
        usedFallbackBundle: !advanceBundle,
      });
      if (deps.webTtsUtteranceInFlightRef) {
        deps.webTtsUtteranceInFlightRef.current = handoffToSpeak;
      }
      deps.ttsLineInFlightRef.current = true;
      if (deps.userId) {
        setTtsPlaybackActive(true);
      }
      deps.parallelStreamingTtsRef.current.accumulatedFullText = handoffToSpeak;
      deps.lastQuestionTextRef.current = SCENARIO_3_OPENING;
      let htmlMp3Played = false;
      try {
        try {
          htmlMp3Played = await speakLongFormInterviewHtmlMp3({
            text: handoffToSpeak,
            telemetrySource: 'turn',
            onPlaybackStarted: () => deps.setVoiceState('speaking'),
          });
        } catch {
          htmlMp3Played = false;
        }
        if (!htmlMp3Played) {
          await deps.speakTextSafe(handoffToSpeak, SHOW_SCENARIO_CARD_CANONICAL_SPEECH);
        } else {
          deps.setVoiceState('idle');
        }
        if (deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef) {
          deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current = {
            ...deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current,
            situation_3: true,
          };
        }
      } finally {
        if (!deps.webTtsTabInterruptPendingReplayRef.current) {
          if (deps.webTtsUtteranceInFlightRef) {
            deps.webTtsUtteranceInFlightRef.current = null;
          }
          deps.ttsLineInFlightRef.current = false;
          if (deps.userId && !deps.parallelStreamingTtsRef.current.active) {
            setTtsPlaybackActive(false);
          }
        }
      }
      deps.parallelStreamingTtsRef.current.spokenCompleteText = handoffToSpeak;
      params.textToParallelStream.spokenStarted = true;
      deps.recordInterviewAssistantDeliveryForMetaExemptionRef.current(handoffToSpeak);
      triggerCompletedScenarioScoringIfNeeded({
        completedScenario: 2,
        messagesForScoring: params.messagesToUse,
        trigger: 's2_repair_satisfied_handoff_stream_end',
        ensureCompletedScenarioScored: deps.ensureCompletedScenarioScored,
      });
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
        markS3RepairProbeTtsDelivered(deps);
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
        markS3RepairProbeTtsDelivered(deps);
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
    state.moment5ClosingStreamBuffer = '';
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
        if (closingFlushLooksFinal) {
          params.textToParallelStream.spokenStarted = true;
          state.interviewClosingSpokenThisStream = true;
        }
        maybeQueueSentenceForTts(dedupedClosing, false, true);
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
  const { deps, params, state } = ctx;
  deps.recordingJustFinishedBeforeNextTtsRef.current = false;
  deps.postRecordingParallelStreamSettleRef.current = false;
  if (!deps.webTtsTabInterruptPendingReplayRef.current) {
    deps.parallelStreamingTtsRef.current.active = false;
    if (deps.userId) {
      setTtsPlaybackActive(false);
      deps.ttsLineInFlightRef.current = false;
    }
  }
  if (
    Platform.OS === 'web' &&
    deps.webTtsTabInterruptPendingReplayRef.current &&
    !params.metaFrustrationFirstSignalBuffered
  ) {
    const fullReplay = stripControlTokens(params.textToParallelStream.full).trim();
    if (fullReplay.length > 0) {
      const isClosingReplay =
        isInterviewClosingThanksFragment(fullReplay) ||
        isInterviewClosingReflectiveAckFragment(fullReplay) ||
        looksLikeInterviewClosingAssistantMessage(fullReplay);
      if (isClosingReplay) {
        deps.webTtsTabInterruptPendingReplayRef.current = false;
      } else {
        const prior = deps.pendingGestureRestoreSpeakRef.current;
        const preserveHtmlResume =
          prior?.restoreMode === 'resume_html' || hasWebInterviewHtmlAudioTabResumePending();
        const spokenComplete = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
        /**
         * Do not replace a queued restore (or a spoken S1→S2 handoff) with stream leftovers
         * that are only a brief ack / unauthorized Ryan follow-up.
         */
        const fullIsStaleFollowUp =
          isUnauthorizedS1TabRestoreFollowUp(fullReplay) ||
          looksLikeBriefStreamAckOnly(fullReplay) ||
          (looksLikeShortProbeFallback(fullReplay) &&
            looksLikeScenarioHandoffOrVignetteBundle(spokenComplete));
        const preferSpokenHandoff =
          looksLikeScenarioHandoffOrVignetteBundle(spokenComplete) && fullIsStaleFollowUp;
        const preferPrior =
          !!prior?.text?.trim() &&
          (preserveHtmlResume ||
            (fullIsStaleFollowUp &&
              (looksLikeScenarioHandoffOrVignetteBundle(prior.text) ||
                prior.text.trim().length >= fullReplay.length)));
        const restoreText = substituteCanonicalInterviewScenarioBodiesForTts(
          preferSpokenHandoff
            ? spokenComplete
            : preferPrior && prior?.text
              ? prior.text
              : preserveHtmlResume && prior?.text
                ? prior.text
                : fullReplay,
        );
        deps.pendingGestureRestoreSpeakRef.current = {
          text: restoreText,
          restoreMode: preserveHtmlResume ? 'resume_html' : prior?.restoreMode ?? 'replay',
          queuedAtMs: prior?.queuedAtMs ?? Date.now(),
          options: prior?.options ?? { ...TAB_RESTORE_PENDING_SPEAK_OPTIONS },
          resolve: prior?.resolve ?? (() => {}),
          reject: prior?.reject ?? (() => {}),
        };
        deps.setWebTabGestureRestoreOverlay(true);
      }
    }
  }
  if (params.metaFrustrationFirstSignalBuffered) {
    await runParallelStreamMetaFrustrationBufferedTts(ctx);
  }
  if (params.textToParallelStream.spokenStarted) {
    deps.setVoiceState('idle');
    if (Platform.OS === 'web') {
      deps.scheduleWebMicPreInitRefreshAfterTtsCompletes();
    }
  }
}

export async function runParallelStreamMetaFrustrationBufferedTts(
  ctx: ParallelStreamTtsPlaybackContext,
): Promise<void> {
  const { deps, params } = ctx;
  deps.webTtsTabInterruptPendingReplayRef.current = false;
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
        question_text: stripControlTokens(spokenFinal).trim().slice(0, 2000),
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
