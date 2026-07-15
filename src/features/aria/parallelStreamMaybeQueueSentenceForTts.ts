import { prependBriefAckIfMissingBeforeMove } from '@features/aria/interviewAcknowledgmentMoveGate';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { recentAssistantMessagesForAck } from '@features/aria/interviewReflectionAckVariation';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { remoteLog } from '@utilities/remoteLog';
import {
  isActiveScenarioAConstructProbeTurn,
  scenarioAMinimumEngagementForHandoff,
  shouldDeliverScenarioFollowUpQuestion,
  userIsAnsweringAfterStreamDeliveredScenarioAContemptProbe,
} from '@features/aria/scenarioFollowUpTranscriptGuard';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from '@features/aria/probeAndScoringUtils';
import { shouldAllowScenarioARepairAfterContemptAnswer } from '@features/aria/scenarioARepairQuestionHelpers';
import { isScenarioModalFollowUpProbe } from '@features/aria/interviewScenarioModalPrompt';
import { isScenarioANonScriptedModalParaphrase } from '@features/aria/situation1ExactModalPrompt';
import { isInternalReflectionSchemaStreamFragment } from '@features/aria/interviewReflectionTextStrips';
import {
  applyConsecutiveStreamSentenceDedup,
  elongatingProbePlaybackBlockReason,
  isApprovedElongatingProbeOnly,
  isIncompleteInterviewClosingLeadSentence,
  isInterviewClosingStreamFragment,
  looksLikeInterviewClosingAssistantMessage,
  stripInterviewClosingStreamingEcho,
} from '@features/aria/elongatingProbe';
import {
  isShortAckOnlySentence,
  shouldHoldBoundaryWarmStreamingLine,
} from '@features/aria/interviewerFrameworkPrompt';
import {
  shouldDeferScenarioVignetteTailForOpeningMerge,
  looksLikeCanonicalScenarioOpeningQuestion,
} from '@features/aria/interviewScenarioOpeningStreamGate';
import {
  looksLikeScenarioARepairQuestion,
  isIncompleteScenarioARepairLeadSentence,
  stripScenarioARepairQuestionStreamingEcho,
  shouldSuppressScenarioARepairBeforeContemptAnswer,
  looksLikeScenarioARepairStreamFragment,
  findLastUserWithPriorAssistantContent,
  findLastUserWithPriorScenarioARepairContext,
  userAnswerSatisfiesScenarioARepairPrompt,
  shouldAdvanceScenarioAAfterSatisfiedRepair,
  shouldAdvanceScenarioBAfterSatisfiedRepair,
} from '@features/aria/interviewDisengagementProbes';
import { shouldAdvanceScenarioCAfterSatisfiedDanielRepair } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import {
  looksLikeMoment5AccountabilityProbeAssistantPrompt,
  looksLikeScenarioAContemptProbeQuestion,
  scenarioAEmmaVeryClearContemptReask,
  stripMoment4SpecificityFollowUpStreamingEcho,
  stripMoment5AccountabilityProbeStreamingEcho,
  stripMoment5SpecificityRedirectStreamingEcho,
} from '@features/aria/probeAndScoringUtils';
import { computeMoment5InterviewCloseGate } from '@features/aria/interviewProgressSync';
import { markMoment5ResolutionFollowUpTtsDelivered } from '@features/aria/moment5DeliveryReconcile';
import { markS3RepairProbeTtsDelivered } from '@features/aria/scenarioCDeliveryReconcile';
import { looksLikeMoment5ResolutionFollowUpPrompt } from '@features/aria/moment5SpecificityRedirect';
import {
  isIncompleteScenarioAContemptProbeLeadSentence,
  isScenarioABoundaryReflectionWithoutNextVignette,
  mergeDeferredScenarioAContemptProbeLeadWithNextSentence,
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  coerceScenarioAContemptProbeForTts,
  stripScenarioAContemptProbeStreamingEcho,
} from '@features/aria/scenarioAContemptProbeLogic';
import {
  coerceScenarioARepairQuestionForTts,
} from '@features/aria/scenarioARepairQuestionHelpers';
import {
  coerceScenarioBJamesDifferentlyQuestionForTts,
  coerceScenarioBJamesRepairQuestionForTts,
  coerceScenarioBJamesSayToJamesQuestionForTts,
  isIncompleteScenarioBJamesDifferentlyLeadSentence,
  isIncompleteScenarioBJamesRepairLeadSentence,
  isIncompleteScenarioBJamesSayToJamesLeadSentence,
  isScenarioBBoundaryReflectionWithoutNextVignette,
  scenarioBMinimumEngagementForHandoff,
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBJamesSayToJamesRolePlayQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
  looksLikeScenarioBLegacyThirdPersonJamesRepairQuestion,
  lastScenarioBUserAnswerContent,
  scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent,
  scenarioBJamesRepairProbeAlreadySatisfied,
  shouldSkipScenarioBRepairAsJamesProbe,
} from '@features/aria/scenarioBProbeLogic';
import {
  coerceMoment4ThresholdQuestionForTts,
  isIncompleteMoment4ThresholdLeadSentence,
  looksLikeMoment4ThresholdParaphraseInProgress,
  looksLikeMoment4ThresholdQuestion,
} from '@features/aria/moment4ProbeLogic';
import { coerceMoment4SpecificityFollowUpForTts, looksLikeMoment4GrudgeElaborationFollowUp } from '@features/aria/moment4SpecificityFollowUp';
import { looksLikeMoment4GrudgePrompt } from '@features/aria/moment4ProbeLogic';
import {
  coerceScenarioCQ1PrescriptiveStripForTts,
  scenarioCQ1InterpretationSatisfiedInTranscript,
  shouldSuppressScenarioCQ1VerbatimReplay,
  coerceScenarioCNextProbeForStreamTts,
  resolveScenarioCNextProbeAfterSatisfiedQ1,
  looksLikeScenarioCDanielPrescriptiveQ1Paraphrase,
  coerceScenarioCRepairQuestionForTts,
  coerceScenarioCSophiePerspectiveQuestionForTts,
  stripScenarioCSophiePerspectiveStreamingEcho,
  isIncompleteScenarioCDanielComeBackLeadSentence,
  isIncompleteScenarioCSophiePerspectiveLeadSentence,
  isIncompleteScenarioCSophieReceiveLeadSentence,
  looksLikeScenarioCDanielComeBackMisparaphraseQuestion,
  looksLikeScenarioCDanielPrescriptiveBackInRoomQuestion,
  looksLikeScenarioCSophiePerspectiveQuestion,
  looksLikeScenarioCSophieRolePlayMisparaphraseQuestion,
  looksLikeScenarioCSophieReceiveMisparaphraseQuestion,
  looksLikeScenarioCNextStepsBetweenThemMisparaphraseQuestion,
  looksLikeScenarioCSophieSayToSophieMisparaphraseQuestion,
  isIncompleteScenarioCSophieSayToLeadSentence,
  isScenarioCRepairAssistantPrompt,
  isScenarioCBoundaryReflectionWithoutMoment4Handoff,
  scenarioCRepairConstructStillPending,
  scenarioCSophiePerspectiveAnsweredInTranscript,
  scenarioCSophiePerspectiveProbeAlreadyDelivered,
  shouldSuppressScenarioCRepairReplay,
  shouldSuppressScenarioCQ1UntilVignetteSetup,
  looksLikeScenarioCRepairWithUserAnswerEcho,
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
} from '@features/aria/scenarioCPromptDetection';
import { assistantTextIsPrematureMoment4HandoffDuringScenarioC } from '@features/aria/interviewMomentScenarioConfig';
import { transcriptContainsScenarioCRepairQuestion } from '@features/aria/scenarioFollowUpTranscriptGuard';
import {
  isScenarioHandoffTransitionPhraseOnly,
  shouldArmShowScenarioCardStreamMute,
  splitParallelBatchBeforeShowScenarioCardBody,
  resolveShowScenarioCardKindForInterview,
  isExactShowScenario3VignetteText,
} from '@features/aria/showScenarioCardCanonicalTts';
import {
  introBriefingSpeechEndsWithReadinessQuestion,
  isIntroBriefingReadinessOnlySentence,
} from '@features/aria/interviewPreambleBriefing';
import {
  isPrematureStandaloneM4PersonalTransitionLine,
  shouldRedirectPrematureMoment4ToScenario2To3Handoff,
} from '@features/aria/prematureMoment4HandoffPlaybackGuard';
import { isScenarioBoundaryPositiveAddressReflection } from '@features/aria/interviewReflectionTextStrips';
import {
  shouldDropScenarioBoundaryContentReflectionSentence,
  stripScenarioBoundaryContentReflection,
} from '@features/aria/stripScenarioBoundaryContentReflection';
import { INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS } from '@features/aria/interviewTransitionBundles';
import { resolveScenarioUserTextForBoundaryReflection } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import {
  extractScenarioBoundaryReflectionFromHandoff,
  extractedBoundaryReflectionIsUnsafeForUserCorpus,
} from '@features/aria/relationalPatternReflection';
import { resolveEffectiveActiveScenarioFromTranscript, textContainsScenarioBVignetteBody, textContainsScenarioCVignetteBody, looksLikeNonCanonicalScenarioCVignetteFiction } from '@features/aria/emotionScenarioTransitionInference';
import { hasScenarioBoundaryWrapPhrase } from '@features/aria/emotionModalTransitionOrchestration';
import type { ParallelStreamTtsBatchController } from './parallelStreamTtsBatchController';
import type { ParallelStreamTtsPlaybackContext } from './parallelStreamTtsRuntimeState';

/** Suppressions that skip TTS must still advance spokenCompleteText or tab-restore will replay them. */
function markParallelStreamSentenceConsumedAsSpoken(
  deps: ParallelStreamTtsPlaybackContext['deps'],
  spoken: string,
): void {
  const chunk = spoken.trim();
  if (!chunk) return;
  const prev = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
  if (prev.includes(chunk)) return;
  deps.parallelStreamingTtsRef.current.spokenCompleteText = prev ? `${prev} ${chunk}`.trim() : chunk;
}

export type MaybeQueueParallelStreamSentenceForTts = (
  sentence: string,
  allowDeferWarm?: boolean,
  bypassMoment5ClosingBuffer?: boolean,
  bufferAfterSentence?: string,
) => void;

export function createParallelStreamMaybeQueueSentenceForTts(
  ctx: ParallelStreamTtsPlaybackContext,
  batch: ParallelStreamTtsBatchController,
): MaybeQueueParallelStreamSentenceForTts {
  const { deps, params, state, closingAlreadyInTranscriptForStream } = ctx;
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
  const scenarioARepairAfterContemptAnswerDue = () =>
    params.allowScenarioARepairAfterContemptAnswer ||
    shouldAllowScenarioARepairAfterContemptAnswer({
      currentScenario: deps.currentScenarioRef.current,
      currentMoment: deps.currentInterviewMomentRef.current,
      scenarioAContemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
      scenarioARepairQuestionAsked: deps.scenarioARepairQuestionAskedRef.current,
      replyingToScenarioAQ1: false,
      specificEmmaLineAlreadyAddressed: params.specificEmmaLineAlreadyAddressed,
      shouldForceScenarioAContemptProbe: params.shouldForceScenarioAContemptProbe,
      messagesToUse: params.messagesToUse,
      lastDeliveredQuestionText: deps.lastQuestionTextRef.current,
    }) ||
    userIsAnsweringAfterStreamDeliveredScenarioAContemptProbe({
      scenarioAContemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
      scenarioARepairQuestionAsked: deps.scenarioARepairQuestionAskedRef.current,
      lastDeliveredQuestionText: deps.lastQuestionTextRef.current,
      messagesToUse: params.messagesToUse,
    });
  const maybeSuppressScenarioARepairFragment = (text: string): boolean => {
    if (params.allowScenarioARepairAfterContemptAnswer && looksLikeScenarioARepairStreamFragment(text)) {
      void remoteLog('[S1_REPAIR_AFTER_CONTEMPT_ALLOWED]', {
        preview: text.slice(0, 220),
        s1ContemptFixVersion: 23,
      });
      return false;
    }
    if (!suppressRepairBeforeContempt() || !looksLikeScenarioARepairStreamFragment(text)) {
      return false;
    }
    if (scenarioARepairAfterContemptAnswerDue()) {
      state.pendingScenarioARepairAfterContemptFlush = true;
    }
    void remoteLog('[S1_REPAIR_STREAM_SUPPRESSED_BEFORE_CONTEMPT]', {
      preview: text.slice(0, 220),
      s1ContemptFixVersion: 20,
    });
    return true;
  };
  return function maybeQueueSentenceForTts(
    sentence: string,
    allowDeferWarm = true,
    bypassMoment5ClosingBuffer = false,
    bufferAfterSentence = '',
  ) {
    const effectiveActiveScenario = resolveEffectiveActiveScenarioFromTranscript(
      deps.currentScenarioRef.current,
      deps.currentInterviewMomentRef.current,
      params.messagesToUse as MessageWithScenario[],
    );
    const fullStreamText = params.textToParallelStream.full;
        if (deps.parallelStreamingTtsRef.current.cancelRequested) {
          state.ttsCancelled = true;
          return;
        }
        let spoken = stripControlTokens(sentence).trim();
        if (!spoken || state.ttsCancelled) return;
        if (shouldDropScenarioBoundaryContentReflectionSentence(spoken)) {
          void remoteLog('[BOUNDARY_REFLECTION_STREAM_DROPPED]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: spoken.slice(0, 220),
          });
          return;
        }
        spoken = stripScenarioBoundaryContentReflection(spoken);
        if (!spoken) return;
        if (looksLikeCanonicalScenarioOpeningQuestion(spoken) && state.deferredScenarioVignetteTailForOpeningMerge) {
          spoken = `${state.deferredScenarioVignetteTailForOpeningMerge} ${spoken}`.trim();
          state.deferredScenarioVignetteTailForOpeningMerge = null;
        }
        if (
          !state.streamContemptProbeMuteActive &&
          deps.currentInterviewMomentRef.current === 1 &&
          deps.currentScenarioRef.current === 1 &&
          !deps.scenarioAContemptProbeAskedRef.current &&
          !state.scenarioAContemptProbeSpokenThisStream &&
          (looksLikeScenarioAContemptProbeQuestion(spoken) ||
            isIncompleteScenarioAContemptProbeLeadSentence(spoken))
        ) {
          state.streamContemptProbeMuteActive = true;
          void remoteLog('[S1_CONTEMPT_PROBE_STREAM_MUTE_ARMED_MIDSTREAM]', {
            preview: spoken.slice(0, 200),
            s1ContemptFixVersion: 8,
          });
        }
        if (
          state.streamContemptProbeMuteActive &&
          (deps.scenarioAContemptProbeAskedRef.current ||
            deps.scenarioARepairQuestionAskedRef.current)
        ) {
          state.streamContemptProbeMuteActive = false;
          void remoteLog('[S1_CONTEMPT_PROBE_STREAM_MUTE_CLEARED_ALREADY_DELIVERED]', {
            askedRef: deps.scenarioAContemptProbeAskedRef.current,
            repairAskedRef: deps.scenarioARepairQuestionAskedRef.current,
            s1ContemptFixVersion: 26,
          });
        }
        if (state.streamContemptProbeMuteActive) {
          state.scenarioAContemptProbeStreamBuffer = state.scenarioAContemptProbeStreamBuffer
            ? `${state.scenarioAContemptProbeStreamBuffer} ${spoken}`.trim()
            : spoken;
          void remoteLog('[S1_CONTEMPT_PROBE_STREAM_MUTED]', {
            preview: state.scenarioAContemptProbeStreamBuffer.slice(0, 240),
            s1ContemptFixVersion: 8,
          });
          return;
        }
        if (
          shouldArmShowScenarioCardStreamMute({
            sentence: spoken,
            fullStream: params.textToParallelStream.full,
            messagesToUse: params.messagesToUse,
            streamShowScenarioCardMuteActive: state.streamShowScenarioCardMuteActive,
            showScenarioCardCanonicalSpokenThisStream: state.showScenarioCardCanonicalSpokenThisStream,
            streamContemptProbeMuteActive: state.streamContemptProbeMuteActive,
            playbackConfirmedKinds: deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current,
            interviewMoment: deps.currentInterviewMomentRef.current,
            interviewScenario: deps.currentScenarioRef.current,
          })
        ) {
          const kind = resolveShowScenarioCardKindForInterview({
            fullStream: params.textToParallelStream.full,
            interviewMoment: deps.currentInterviewMomentRef.current,
            interviewScenario: deps.currentScenarioRef.current,
          });
          if (!kind) return;
          const batchBefore = state.parallelTtsBatchBuffer;
          state.parallelTtsBatchBuffer = '';
          state.parallelTtsBatchPrefetch = null;
          const { transitionPrefix, hadVignetteBody } = splitParallelBatchBeforeShowScenarioCardBody(
            batchBefore,
            kind,
          );
          /**
           * When boundary reflections are disabled, do not flush the model's wrap/reflection
           * prefix — canonical card TTS speaks the short client wrap only.
           */
          if (transitionPrefix && INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS) {
            batch.appendToParallelTtsBatch(transitionPrefix);
            batch.flushParallelTtsBatch(true);
          } else if (transitionPrefix) {
            void remoteLog('[SHOW_SCENARIO_CARD_TRANSITION_PREFIX_FLUSH_SKIPPED]', {
              interviewSessionId: deps.interviewSessionIdRef.current,
              reason: 'boundary_reflections_disabled',
              preview: transitionPrefix.slice(0, 180),
            });
          }
          state.streamShowScenarioCardMuteActive = true;
          state.showScenarioCardTransitionPrefixSpoken =
            INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS && !!transitionPrefix;
          state.showScenarioCardStreamBuffer = spoken;
          void remoteLog('[SHOW_SCENARIO_CARD_STREAM_MUTE_ARMED]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: spoken.slice(0, 200),
          });
          return;
        }
        if (state.streamShowScenarioCardMuteActive) {
          state.showScenarioCardStreamBuffer = state.showScenarioCardStreamBuffer
            ? `${state.showScenarioCardStreamBuffer} ${spoken}`.trim()
            : spoken;
          void remoteLog('[SHOW_SCENARIO_CARD_STREAM_MUTED]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: state.showScenarioCardStreamBuffer.slice(0, 240),
          });
          return;
        }
        const hadDeferredBefore = !!state.deferredWarmBoundarySentence;
        if (state.deferredWarmBoundarySentence) {
          spoken = `${state.deferredWarmBoundarySentence} ${spoken}`.trim();
          state.deferredWarmBoundarySentence = null;
          state.parallelTtsBatchPrefetch = null;
        }
        if (state.deferredScenarioARepairLeadSentence && !suppressRepairBeforeContempt()) {
          spoken = `${state.deferredScenarioARepairLeadSentence} ${spoken}`.trim();
          state.deferredScenarioARepairLeadSentence = null;
        } else if (state.deferredScenarioARepairLeadSentence && suppressRepairBeforeContempt()) {
          void remoteLog('[S1_DEFERRED_REPAIR_MERGE_DROPPED_BEFORE_CONTEMPT]', {
            preview: state.deferredScenarioARepairLeadSentence.slice(0, 220),
            s1ContemptFixVersion: 20,
          });
          state.deferredScenarioARepairLeadSentence = null;
        }
        if (state.deferredScenarioARepairShortAckSentence) {
          spoken = `${state.deferredScenarioARepairShortAckSentence} ${spoken}`.trim();
          state.deferredScenarioARepairShortAckSentence = null;
        }
        if (state.deferredScenarioCShortAckSentence) {
          spoken = `${state.deferredScenarioCShortAckSentence} ${spoken}`.trim();
          state.deferredScenarioCShortAckSentence = null;
        }
        if (state.deferredScenarioBJamesShortAckSentence) {
          spoken = `${state.deferredScenarioBJamesShortAckSentence} ${spoken}`.trim();
          state.deferredScenarioBJamesShortAckSentence = null;
        }
        if (state.deferredScenarioBJamesDifferentlyLeadSentence) {
          spoken = coerceScenarioBJamesDifferentlyQuestionForTts(
            `${state.deferredScenarioBJamesDifferentlyLeadSentence} ${spoken}`.trim(),
          );
          state.deferredScenarioBJamesDifferentlyLeadSentence = null;
        }
        if (state.deferredScenarioBJamesSayToJamesLeadSentence) {
          const mergedSayToJames = `${state.deferredScenarioBJamesSayToJamesLeadSentence} ${spoken}`.trim();
          spoken = coerceScenarioBJamesSayToJamesQuestionForTts(
            mergedSayToJames,
            params.shouldForceScenarioBJamesRepairProbe ||
              looksLikeScenarioBRepairAsJamesQuestion(spoken),
          );
          state.deferredScenarioBJamesSayToJamesLeadSentence = null;
        }
        if (state.deferredScenarioAContemptProbeLeadSentence) {
          spoken = mergeDeferredScenarioAContemptProbeLeadWithNextSentence(
            state.deferredScenarioAContemptProbeLeadSentence,
            spoken,
          );
          state.deferredScenarioAContemptProbeLeadSentence = null;
        }
        if (state.deferredInterviewClosingLeadSentence) {
          spoken = `${state.deferredInterviewClosingLeadSentence} ${spoken}`.trim();
          state.deferredInterviewClosingLeadSentence = null;
        }
        if (
          !state.streamMoveAckPrepended &&
          !params.textToParallelStream.spokenStarted &&
          !isApprovedElongatingProbeOnly(spoken) &&
          !isShortAckOnlySentence(spoken) &&
          !looksLikeCanonicalScenarioOpeningQuestion(spoken)
        ) {
          const recentAsst = recentAssistantMessagesForAck(
            params.messagesToUse as MessageWithScenario[],
          );
          const withAck = prependBriefAckIfMissingBeforeMove(
            spoken,
            params.trimmed,
            recentAsst,
            deps.currentInterviewMomentRef.current,
          );
          if (withAck !== spoken) {
            spoken = withAck;
          }
          state.streamMoveAckPrepended = true;
        }
        if (isInternalReflectionSchemaStreamFragment(spoken)) {
          void remoteLog('[M5_REFLECTION_SCHEMA_STREAM_SUPPRESSED]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: spoken.slice(0, 160),
          });
          return;
        }
        if (
          deps.currentInterviewMomentRef.current === 5 &&
          looksLikeMoment5ResolutionFollowUpPrompt(spoken)
        ) {
          markMoment5ResolutionFollowUpTtsDelivered(deps);
        }
        const isClosingStreamFragment = isInterviewClosingStreamFragment(spoken);
        const moment5CloseAllowedForStream =
          deps.currentInterviewMomentRef.current !== 5 || !isClosingStreamFragment
            ? true
            : computeMoment5InterviewCloseGate(params.messagesToUse ?? [], {
                moment5QuestionDelivered: deps.moment5QuestionDeliveredRef.current,
                moment5PrimaryAnchorSession: deps.moment5PrimaryAnchorDeliveredSessionRef.current,
                postM5UserTurnsRef: deps.moment5PostPromptUserTurnCountRef.current,
                accountabilityProbeFired: deps.moment5AccountabilityProbeFiredRef.current,
                currentInterviewMoment: deps.currentInterviewMomentRef.current,
                moment5ResolutionDelivered: deps.moment5ResolutionDeliveredRef.current,
              }).moment5CloseAllowed;
        if (
          !bypassMoment5ClosingBuffer &&
          deps.currentInterviewMomentRef.current === 5 &&
          isClosingStreamFragment &&
          !moment5CloseAllowedForStream
        ) {
          state.moment5StickyCloseBufferAll = true;
          state.moment5ClosingStreamBuffer = state.moment5ClosingStreamBuffer
            ? `${state.moment5ClosingStreamBuffer} ${spoken}`.trim()
            : spoken;
          void remoteLog('[M5_CLOSING_STREAM_SUPPRESSED_PRE_CLOSE_GATE]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: spoken.slice(0, 220),
            postM5UserTurns: deps.moment5PostPromptUserTurnCountRef.current,
            resolutionDelivered: deps.moment5ResolutionDeliveredRef.current,
          });
          return;
        }
        if (
          !bypassMoment5ClosingBuffer &&
          deps.currentInterviewMomentRef.current === 5 &&
          isClosingStreamFragment
        ) {
          state.moment5StickyCloseBufferAll = true;
        }
        if (!bypassMoment5ClosingBuffer && state.moment5StickyCloseBufferAll) {
          state.moment5ClosingStreamBuffer = state.moment5ClosingStreamBuffer
            ? `${state.moment5ClosingStreamBuffer} ${spoken}`.trim()
            : spoken;
          void remoteLog('[M5_CLOSING_STREAM_BUFFERED_ALL]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: state.moment5ClosingStreamBuffer.slice(0, 220),
            postM5UserTurns: deps.moment5PostPromptUserTurnCountRef.current,
            sticky: !params.bufferAllStreamTtsForMoment5Close,
          });
          return;
        }
        if (
          !bypassMoment5ClosingBuffer &&
          deps.currentInterviewMomentRef.current === 5 &&
          (state.moment5ClosingStreamBuffer.length > 0 || isClosingStreamFragment)
        ) {
          state.moment5StickyCloseBufferAll = true;
          state.moment5ClosingStreamBuffer = state.moment5ClosingStreamBuffer
            ? `${state.moment5ClosingStreamBuffer} ${spoken}`.trim()
            : spoken;
          void remoteLog('[M5_CLOSING_STREAM_BUFFERED]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: state.moment5ClosingStreamBuffer.slice(0, 220),
          });
          return;
        }
        if (
          looksLikeScenarioBRepairAsJamesQuestion(spoken) &&
          (deps.s2RepairProbeDeliveredRef.current ||
            deps.currentScenarioRef.current !== 2 ||
            shouldSkipScenarioBRepairAsJamesProbe(
              params.messagesToUse,
              spoken,
              deps.currentInterviewMomentRef.current,
            ) ||
            scenarioBJamesRepairProbeAlreadySatisfied(params.messagesToUse))
        ) {
          const satisfiedSkip =
            shouldSkipScenarioBRepairAsJamesProbe(
              params.messagesToUse,
              spoken,
              deps.currentInterviewMomentRef.current,
            ) || scenarioBJamesRepairProbeAlreadySatisfied(params.messagesToUse);
          if (satisfiedSkip) {
            void remoteLog('[S2_REPAIR_STREAM_SUPPRESSED_SATISFIED]', {
              preview: spoken.slice(0, 200),
            });
          }
          markParallelStreamSentenceConsumedAsSpoken(deps, spoken);
          return;
        }
        if (
          isScenarioCRepairAssistantPrompt(spoken) &&
          (deps.s3RepairProbeDeliveredRef.current ||
            deps.currentScenarioRef.current !== 3 ||
            transcriptContainsScenarioCRepairQuestion(params.messagesToUse) ||
            !scenarioCRepairConstructStillPending(params.messagesToUse))
        ) {
          void remoteLog('[S3_REPAIR_STREAM_SUPPRESSED_ALREADY_DELIVERED]', {
            delivered: deps.s3RepairProbeDeliveredRef.current,
            preview: spoken.slice(0, 200),
          });
          markParallelStreamSentenceConsumedAsSpoken(deps, spoken);
          return;
        }
        if (
          deps.currentScenarioRef.current === 2 &&
          looksLikeScenarioBJamesDifferentlyQuestion(spoken) &&
          scenarioBJamesRepairProbeAlreadySatisfied(params.messagesToUse)
        ) {
          void remoteLog('[S2_JAMES_Q2_STREAM_SUPPRESSED_REPAIR_SATISFIED]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: spoken.slice(0, 200),
          });
          markParallelStreamSentenceConsumedAsSpoken(deps, spoken);
          return;
        }
        if (
          params.shouldForceScenarioBJamesRepairProbe &&
          deps.currentScenarioRef.current === 2 &&
          (/\[SCENARIO_COMPLETE\s*:\s*2\]/i.test(spoken) ||
            (hasScenarioBoundaryWrapPhrase(spoken) && !looksLikeScenarioBRepairAsJamesQuestion(spoken)))
        ) {
          void remoteLog('[S2_BOUNDARY_STREAM_SUPPRESSED_BEFORE_REPAIR]', {
            preview: spoken.slice(0, 200),
          });
          return;
        }
        /**
         * Scenario A: when Q1 already covered Emma's closing line, post-processing strips the contempt probe
         * from the assistant turn — but parallel streaming would still speak the raw model sentence, so TTS
         * no longer matches the reference card (which shows the repair ask). Drop matching flushed sentences.
         */
        if (
          isActiveScenarioAConstructProbeTurn(
            deps.currentScenarioRef.current,
            deps.currentInterviewMomentRef.current,
          ) &&
          params.specificEmmaLineAlreadyAddressed &&
          (looksLikeScenarioAContemptProbeQuestion(spoken) ||
            scenarioAEmmaVeryClearContemptReask(spoken))
        ) {
          return;
        }
        {
          const repairCtx = findLastUserWithPriorScenarioARepairContext(params.messagesToUse);
          const lastUserContent = repairCtx.lastUserContent;
          const priorRepairAssistantContent =
            repairCtx.priorRepairAssistantContent ??
            findLastUserWithPriorAssistantContent(params.messagesToUse).priorAssistantContent;
          if (
            isActiveScenarioAConstructProbeTurn(
              deps.currentScenarioRef.current,
              deps.currentInterviewMomentRef.current,
            ) &&
            deps.scenarioARepairQuestionAskedRef.current &&
            lastUserContent &&
            priorRepairAssistantContent &&
            userAnswerSatisfiesScenarioARepairPrompt(lastUserContent, priorRepairAssistantContent) &&
            (looksLikeScenarioAContemptProbeQuestion(spoken) ||
              scenarioAEmmaVeryClearContemptReask(spoken) ||
              isIncompleteScenarioAContemptProbeLeadSentence(spoken) ||
              isScenarioModalFollowUpProbe(spoken) ||
              isScenarioANonScriptedModalParaphrase(spoken))
          ) {
            void remoteLog(
              isScenarioModalFollowUpProbe(spoken)
                ? '[S1_MODAL_FOLLOWUP_STREAM_SUPPRESSED_POST_REPAIR_SATISFIED]'
                : isScenarioANonScriptedModalParaphrase(spoken)
                  ? '[S1_UNAUTHORIZED_FOLLOWUP_STREAM_SUPPRESSED_POST_REPAIR_SATISFIED]'
                  : '[S1_POST_REPAIR_CONTEMPT_STREAM_SUPPRESSED]',
              {
                preview: spoken.slice(0, 200),
                s1ContemptFixVersion: 24,
              },
            );
            /** Stream already confirmed repair satisfaction — stream-end must speak S1→S2 handoff. */
            state.pendingS1RepairSatisfiedHandoff = true;
            return;
          }
        }
        /**
         * Model often skips ahead to the repair ask before the contempt probe; post-processing injects Emma's line.
         * Parallel streaming would still speak the repair sentence — suppress it so only the forced probe is heard.
         */
        if (
          isActiveScenarioAConstructProbeTurn(
            deps.currentScenarioRef.current,
            deps.currentInterviewMomentRef.current,
          ) &&
          params.shouldForceScenarioAContemptProbe &&
          looksLikeScenarioARepairQuestion(spoken)
        ) {
          void remoteLog('[S1_CONTEMPT_FORCE_SUPPRESS_REPAIR_STREAM]', { preview: spoken.slice(0, 200) });
          return;
        }
        if (deps.currentInterviewMomentRef.current === 4 && deps.moment4ClientSpecificityProbeInjectedRef.current) {
          const afterM4EchoStrip = stripMoment4SpecificityFollowUpStreamingEcho(
            spoken,
            deps.moment4ClientSpecificityProbeInjectedRef.current,
          );
          if (afterM4EchoStrip === null) {
            return;
          }
          spoken = afterM4EchoStrip;
          if (!spoken.trim()) {
            return;
          }
        }
        if (deps.currentInterviewMomentRef.current === 5 && deps.moment5SpecificityRedirectIssuedRef.current) {
          const afterEchoStrip = stripMoment5SpecificityRedirectStreamingEcho(
            spoken,
            deps.moment5SpecificityRedirectIssuedRef.current,
          );
          if (afterEchoStrip === null) {
            return;
          }
          spoken = afterEchoStrip;
          if (!spoken.trim()) {
            return;
          }
        }
        if (
          isActiveScenarioAConstructProbeTurn(
            deps.currentScenarioRef.current,
            deps.currentInterviewMomentRef.current,
          ) &&
          isScenarioANonScriptedModalParaphrase(spoken)
        ) {
          void remoteLog('[S1_MODAL_PARAPHRASE_STREAM_SUPPRESSED]', {
            preview: spoken.slice(0, 200),
            s1ContemptFixVersion: 19,
          });
          return;
        }
        if (isActiveScenarioAConstructProbeTurn(deps.currentScenarioRef.current, deps.currentInterviewMomentRef.current)) {
          if (deps.scenarioAContemptProbeAskedRef.current || state.scenarioAContemptProbeSpokenThisStream) {
            if (
              !deps.scenarioARepairQuestionAskedRef.current &&
              !looksLikeScenarioARepairQuestion(spoken) &&
              (isScenarioModalFollowUpProbe(spoken) || isScenarioANonScriptedModalParaphrase(spoken))
            ) {
              void remoteLog('[S1_CONTEMPT_PROBE_STREAM_SUPPRESS_COACHING]', {
                preview: spoken.slice(0, 200),
                s1ContemptFixVersion: 18,
              });
              return;
            }
            const afterContemptEchoStrip = stripScenarioAContemptProbeStreamingEcho(
              spoken,
              true,
            );
            if (afterContemptEchoStrip === null) {
              return;
            }
            spoken = afterContemptEchoStrip;
            if (!spoken.trim()) {
              return;
            }
          } else if (looksLikeScenarioAContemptProbeQuestion(spoken)) {
            state.streamContemptProbeMuteActive = true;
            state.scenarioAContemptProbeStreamBuffer = SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
            void remoteLog('[S1_CONTEMPT_PROBE_STREAM_MUTE_ARMED_LATE]', {
              preview: spoken.slice(0, 200),
              s1ContemptFixVersion: 14,
            });
            return;
          }
        }
        if (isActiveScenarioAConstructProbeTurn(deps.currentScenarioRef.current, deps.currentInterviewMomentRef.current)) {
          const scenarioARepairAlreadyDelivered =
            !shouldDeliverScenarioFollowUpQuestion(
              params.messagesToUse,
              SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
            ) || state.scenarioARepairQuestionSpokenThisStream;
          if (scenarioARepairAlreadyDelivered) {
            const afterRepairEchoStrip = stripScenarioARepairQuestionStreamingEcho(spoken, true);
            if (afterRepairEchoStrip === null) {
              return;
            }
            spoken = afterRepairEchoStrip;
            if (!spoken.trim()) {
              return;
            }
          } else if (
            looksLikeScenarioARepairQuestion(spoken) ||
            looksLikeScenarioARepairStreamFragment(spoken)
          ) {
            state.scenarioARepairQuestionSpokenThisStream = true;
          }
        }
        if (closingAlreadyInTranscriptForStream || state.interviewClosingSpokenThisStream) {
          const afterClosingEchoStrip = stripInterviewClosingStreamingEcho(spoken, true);
          if (afterClosingEchoStrip === null) {
            return;
          }
          spoken = afterClosingEchoStrip;
          if (!spoken.trim()) {
            return;
          }
        }
        if (
          isActiveScenarioAConstructProbeTurn(
            deps.currentScenarioRef.current,
            deps.currentInterviewMomentRef.current,
          ) &&
          isIncompleteScenarioAContemptProbeLeadSentence(spoken)
        ) {
          state.deferredScenarioAContemptProbeLeadSentence = spoken;
          return;
        }
        if (
          isActiveScenarioAConstructProbeTurn(
            deps.currentScenarioRef.current,
            deps.currentInterviewMomentRef.current,
          ) &&
          isIncompleteScenarioARepairLeadSentence(spoken)
        ) {
          if (suppressRepairBeforeContempt()) {
            void remoteLog('[S1_DEFERRED_REPAIR_LEAD_DROPPED_BEFORE_CONTEMPT]', {
              preview: spoken.slice(0, 220),
              s1ContemptFixVersion: 20,
            });
            return;
          }
          state.deferredScenarioARepairLeadSentence = spoken;
          return;
        }
        const s1RepairReadyForHandoff = scenarioAMinimumEngagementForHandoff(params.messagesToUse);
        const streamBoundaryReflection = extractScenarioBoundaryReflectionFromHandoff(spoken);
        if (streamBoundaryReflection) {
          const corpusScenario: 1 | 2 | 3 | null =
            effectiveActiveScenario === 1 && s1RepairReadyForHandoff
              ? 1
              : effectiveActiveScenario === 2 &&
                  deps.currentInterviewMomentRef.current === 2 &&
                  scenarioBMinimumEngagementForHandoff(params.messagesToUse)
                ? 2
                : deps.currentScenarioRef.current === 3 &&
                    deps.currentInterviewMomentRef.current === 3
                  ? 3
                  : null;
          if (corpusScenario) {
            const corpus = resolveScenarioUserTextForBoundaryReflection(
              params.messagesToUse,
              corpusScenario,
            );
            if (
              corpus.trim() &&
              extractedBoundaryReflectionIsUnsafeForUserCorpus(
                corpus,
                streamBoundaryReflection,
                corpusScenario,
              )
            ) {
              if (corpusScenario === 1) state.pendingS1RepairSatisfiedHandoff = true;
              if (corpusScenario === 2) state.pendingS2RepairSatisfiedHandoff = true;
              void remoteLog('[BOUNDARY_REFLECTION_UNGROUNDED_STREAM_SUPPRESSED]', {
                interviewSessionId: deps.interviewSessionIdRef.current,
                completedScenario: corpusScenario,
                preview: spoken.slice(0, 220),
                rejectedReflectionPreview: streamBoundaryReflection.slice(0, 200),
              });
              return;
            }
          }
        }
        const s1ToS2CanonicalHandoffPending =
          effectiveActiveScenario === 1 &&
          deps.currentInterviewMomentRef.current === 1 &&
          s1RepairReadyForHandoff &&
          (shouldAdvanceScenarioAAfterSatisfiedRepair(
            params.messagesToUse,
            fullStreamText,
            1,
          ) ||
            resolveShowScenarioCardKindForInterview({
              fullStream: fullStreamText,
              interviewMoment: deps.currentInterviewMomentRef.current,
              interviewScenario: deps.currentScenarioRef.current,
            }) === 'situation_2' ||
            hasScenarioBoundaryWrapPhrase(fullStreamText));
        if (
          s1ToS2CanonicalHandoffPending &&
          (isScenarioHandoffTransitionPhraseOnly(spoken) ||
            isScenarioABoundaryReflectionWithoutNextVignette(spoken) ||
            hasScenarioBoundaryWrapPhrase(spoken) ||
            isScenarioBoundaryPositiveAddressReflection(spoken) ||
            isShortAckOnlySentence(spoken)) &&
          !textContainsScenarioCVignetteBody(fullStreamText)
        ) {
          state.pendingS1RepairSatisfiedHandoff = true;
          void remoteLog('[S1_BOUNDARY_STREAM_SUPPRESSED_FOR_CANONICAL]', {
            preview: spoken.slice(0, 220),
          });
          return;
        }
        if (
          s1ToS2CanonicalHandoffPending &&
          !state.showScenarioCardCanonicalSpokenThisStream &&
          textContainsScenarioBVignetteBody(spoken) &&
          !/job hunting for four months/i.test(spoken)
        ) {
          state.pendingS1RepairSatisfiedHandoff = true;
          state.streamShowScenarioCardMuteActive = true;
          void remoteLog('[S1_NONCANONICAL_S2_STREAM_SUPPRESSED_FOR_CANONICAL]', {
            preview: spoken.slice(0, 220),
          });
          return;
        }
        const s2ToS3CanonicalHandoffPending =
          effectiveActiveScenario === 2 &&
          deps.currentInterviewMomentRef.current === 2 &&
          (shouldAdvanceScenarioBAfterSatisfiedRepair(
            params.messagesToUse,
            fullStreamText,
            2,
          ) ||
            resolveShowScenarioCardKindForInterview({
              fullStream: fullStreamText,
              interviewMoment: deps.currentInterviewMomentRef.current,
              interviewScenario: deps.currentScenarioRef.current,
            }) === 'situation_3');
        if (
          s2ToS3CanonicalHandoffPending &&
          (isScenarioHandoffTransitionPhraseOnly(spoken) ||
            isScenarioBBoundaryReflectionWithoutNextVignette(spoken) ||
            hasScenarioBoundaryWrapPhrase(spoken) ||
            isScenarioBoundaryPositiveAddressReflection(spoken) ||
            (shouldHoldBoundaryWarmStreamingLine(spoken, params.participantFirstNameForSpoken) &&
              !textContainsScenarioCVignetteBody(fullStreamText)) ||
            (deps.s2RepairProbeDeliveredRef.current && isShortAckOnlySentence(spoken))) &&
          !textContainsScenarioCVignetteBody(fullStreamText)
        ) {
          state.pendingS2RepairSatisfiedHandoff = true;
          void remoteLog('[S2_BOUNDARY_STREAM_SUPPRESSED_FOR_CANONICAL]', {
            preview: spoken.slice(0, 220),
          });
          return;
        }
        if (
          s2ToS3CanonicalHandoffPending &&
          !state.showScenarioCardCanonicalSpokenThisStream &&
          looksLikeNonCanonicalScenarioCVignetteFiction(spoken) &&
          !isExactShowScenario3VignetteText(spoken)
        ) {
          state.pendingS2RepairSatisfiedHandoff = true;
          /** Keep mute armed so multi-sentence invented Sophie fiction cannot leak mid-paragraph. */
          state.streamShowScenarioCardMuteActive = true;
          void remoteLog('[S2_NONCANONICAL_S3_STREAM_SUPPRESSED_FOR_CANONICAL]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: spoken.slice(0, 220),
          });
          return;
        }
        if (
          s2ToS3CanonicalHandoffPending &&
          state.streamShowScenarioCardMuteActive &&
          !state.showScenarioCardCanonicalSpokenThisStream &&
          !isExactShowScenario3VignetteText(spoken)
        ) {
          state.showScenarioCardStreamBuffer = state.showScenarioCardStreamBuffer
            ? `${state.showScenarioCardStreamBuffer} ${spoken}`.trim()
            : spoken;
          void remoteLog('[S2_NONCANONICAL_S3_STREAM_MUTED_CONTINUATION]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: spoken.slice(0, 220),
          });
          return;
        }
        if (
          shouldSuppressScenarioCQ1UntilVignetteSetup({
            spoken,
            fullStreamText,
            spokenCompleteText: deps.parallelStreamingTtsRef.current.spokenCompleteText,
            messages: params.messagesToUse,
          })
        ) {
          state.pendingS2RepairSatisfiedHandoff = true;
          void remoteLog('[S3_Q1_STREAM_SUPPRESSED_MISSING_SETUP]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: spoken.slice(0, 220),
            scenarioRef: deps.currentScenarioRef.current,
            momentRef: deps.currentInterviewMomentRef.current,
          });
          return;
        }
        const s3RepairSatisfiedForHandoff =
          effectiveActiveScenario === 3 &&
          deps.currentInterviewMomentRef.current === 3 &&
          !scenarioCRepairConstructStillPending(params.messagesToUse);
        const s3ToM4CanonicalHandoffPending =
          s3RepairSatisfiedForHandoff &&
          (shouldAdvanceScenarioCAfterSatisfiedDanielRepair(
            params.messagesToUse,
            fullStreamText,
            3,
          ) ||
            resolveShowScenarioCardKindForInterview({
              fullStream: fullStreamText,
              interviewMoment: deps.currentInterviewMomentRef.current,
              interviewScenario: deps.currentScenarioRef.current,
            }) === 'moment_4' ||
            isScenarioCBoundaryReflectionWithoutMoment4Handoff(fullStreamText) ||
            isPrematureStandaloneM4PersonalTransitionLine(fullStreamText));
        if (
          s3RepairSatisfiedForHandoff &&
          !state.showScenarioCardCanonicalSpokenThisStream &&
          isPrematureStandaloneM4PersonalTransitionLine(spoken) &&
          !looksLikeMoment4GrudgePrompt(spoken)
        ) {
          void remoteLog('[S3_BOUNDARY_STREAM_SUPPRESSED_FOR_CANONICAL]', {
            preview: spoken.slice(0, 220),
            reason: 'premature_standalone_m4_personal_bridge',
          });
          return;
        }
        if (
          s3ToM4CanonicalHandoffPending &&
          !state.showScenarioCardCanonicalSpokenThisStream &&
          (looksLikeMoment4GrudgePrompt(spoken) ||
            isScenarioCBoundaryReflectionWithoutMoment4Handoff(spoken) ||
            isPrematureStandaloneM4PersonalTransitionLine(spoken) ||
            (hasScenarioBoundaryWrapPhrase(spoken) &&
              /\b(?:two questions left|more personal|personal questions)\b/i.test(spoken)))
        ) {
          void remoteLog('[S3_BOUNDARY_STREAM_SUPPRESSED_FOR_CANONICAL]', {
            preview: spoken.slice(0, 220),
            reason: looksLikeMoment4GrudgePrompt(spoken)
              ? 'moment_4_grudge_before_boundary'
              : undefined,
          });
          return;
        }
        if (
          shouldRedirectPrematureMoment4ToScenario2To3Handoff({
            text: spoken,
            currentInterviewMoment: deps.currentInterviewMomentRef.current,
            messages: params.messagesToUse,
          })
        ) {
          void remoteLog('[S2_PREMATURE_M4_HANDOFF_STREAM_SUPPRESSED]', {
            preview: spoken.slice(0, 220),
          });
          return;
        }
        if (
          isActiveScenarioAConstructProbeTurn(
            deps.currentScenarioRef.current,
            deps.currentInterviewMomentRef.current,
          ) &&
          scenarioARepairAfterContemptAnswerDue() &&
          shouldDeliverScenarioFollowUpQuestion(
            params.messagesToUse,
            SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
          ) &&
          !state.scenarioARepairQuestionSpokenThisStream &&
          isShortAckOnlySentence(spoken) &&
          !looksLikeScenarioARepairQuestion(spoken)
        ) {
          state.deferredScenarioARepairShortAckSentence = spoken;
          void remoteLog('[S1_REPAIR_SHORT_ACK_DEFERRED]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: spoken.slice(0, 80),
            s1ContemptFixVersion: 24,
          });
          return;
        }
        if (
          deps.currentScenarioRef.current === 2 &&
          isShortAckOnlySentence(spoken) &&
          !looksLikeScenarioBRepairAsJamesQuestion(spoken)
        ) {
          state.deferredScenarioBJamesShortAckSentence = spoken;
          return;
        }
        if (
          deps.currentScenarioRef.current === 3 &&
          scenarioCRepairConstructStillPending(params.messagesToUse) &&
          isShortAckOnlySentence(spoken) &&
          !looksLikeScenarioCSophiePerspectiveQuestion(spoken) &&
          !isScenarioCRepairAssistantPrompt(spoken)
        ) {
          const nextProbe = resolveScenarioCNextProbeAfterSatisfiedQ1(params.messagesToUse);
          const sophieDue =
            looksLikeScenarioCSophiePerspectiveQuestion(nextProbe) &&
            !scenarioCSophiePerspectiveProbeAlreadyDelivered(params.messagesToUse);
          const repairConstructPending = scenarioCRepairConstructStillPending(params.messagesToUse);
          const repairDue =
            isScenarioCRepairAssistantPrompt(nextProbe) &&
            ((!deps.s3RepairProbeDeliveredRef.current && !state.scenarioCRepairQuestionSpokenThisStream) ||
              repairConstructPending);
          if (sophieDue || repairDue) {
            state.deferredScenarioCShortAckSentence = spoken;
            void remoteLog('[S3_Q1_SHORT_ACK_DEFERRED]', {
              interviewSessionId: deps.interviewSessionIdRef.current,
              preview: spoken.slice(0, 80),
            });
            return;
          }
        }
        if (
          deps.currentScenarioRef.current === 2 &&
          state.deferredScenarioBJamesSayToJamesLeadSentence &&
          looksLikeScenarioBRepairAsJamesQuestion(spoken)
        ) {
          void remoteLog('[S2_SAY_TO_JAMES_STREAM_SUPPRESSED_DUPLICATE_REPAIR]', {
            preview: spoken.slice(0, 200),
          });
          markParallelStreamSentenceConsumedAsSpoken(deps, spoken);
          return;
        }
        if (
          deps.currentScenarioRef.current === 2 &&
          (isIncompleteScenarioBJamesSayToJamesLeadSentence(spoken) ||
            (looksLikeScenarioBJamesSayToJamesRolePlayQuestion(spoken) &&
              !/\?\s*$/.test(spoken.trim())))
        ) {
          state.deferredScenarioBJamesSayToJamesLeadSentence = spoken;
          return;
        }
        if (
          deps.currentScenarioRef.current === 2 &&
          isIncompleteScenarioBJamesDifferentlyLeadSentence(spoken)
        ) {
          state.deferredScenarioBJamesDifferentlyLeadSentence = spoken;
          return;
        }
        if (deps.currentScenarioRef.current === 2 && !scenarioBJamesRepairProbeAlreadySatisfied(params.messagesToUse)) {
          const lastUserAnswer = lastScenarioBUserAnswerContent(
            params.messagesToUse as MessageWithScenario[],
          );
          if (!scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(lastUserAnswer)) {
          spoken = coerceScenarioBJamesSayToJamesQuestionForTts(
            spoken,
            params.shouldForceScenarioBJamesRepairProbe,
          );
          spoken = coerceScenarioBJamesDifferentlyQuestionForTts(spoken, {
            messages: params.messagesToUse as MessageWithScenario[],
            interviewMoment: deps.currentInterviewMomentRef.current,
          });
          spoken = coerceScenarioBJamesRepairQuestionForTts(spoken);
          }
        }
        if (
          deps.currentScenarioRef.current === 2 &&
          (looksLikeScenarioBRepairAsJamesQuestion(spoken) ||
            looksLikeScenarioBLegacyThirdPersonJamesRepairQuestion(spoken))
        ) {
          spoken = coerceScenarioBJamesRepairQuestionForTts(spoken);
          if (
            deps.s2RepairProbeDeliveredRef.current ||
            state.scenarioBJamesRepairQuestionSpokenThisStream
          ) {
            void remoteLog('[S2_JAMES_REPAIR_STREAM_SUPPRESSED_DUPLICATE]', {
              interviewSessionId: deps.interviewSessionIdRef.current,
              preview: spoken.slice(0, 220),
            });
            return;
          }
          state.scenarioBJamesRepairQuestionSpokenThisStream = true;
          deps.s2RepairProbeDeliveredRef.current = true;
        }
        if (deps.currentScenarioRef.current === 3) {
          const s3RepairSatisfied = !scenarioCRepairConstructStillPending(params.messagesToUse);
          if (state.scenarioCSophiePerspectiveProbeSpokenThisStream) {
            const afterSophieEchoStrip = stripScenarioCSophiePerspectiveStreamingEcho(spoken, true);
            if (afterSophieEchoStrip === null) {
              void remoteLog('[S3_SOPHIE_REPLAY_STREAM_SUPPRESSED_AFTER_SPOKEN]', {
                interviewSessionId: deps.interviewSessionIdRef.current,
                preview: spoken.slice(0, 200),
              });
              return;
            }
            spoken = afterSophieEchoStrip;
            if (!spoken.trim()) {
              return;
            }
          }
          if (
            shouldSuppressScenarioCQ1VerbatimReplay(
              params.messagesToUse as MessageWithScenario[],
              spoken,
            )
          ) {
            if (
              scenarioCSophiePerspectiveProbeAlreadyDelivered(params.messagesToUse) &&
              !transcriptContainsScenarioCRepairQuestion(params.messagesToUse) &&
              !deps.s3RepairProbeDeliveredRef.current &&
              !state.scenarioCRepairQuestionSpokenThisStream
            ) {
              spoken = coerceScenarioCRepairQuestionForTts(SCENARIO_C_REPAIR_QUESTION_CANONICAL);
              state.scenarioCRepairQuestionSpokenThisStream = true;
              markS3RepairProbeTtsDelivered(deps);
              void remoteLog('[S3_Q1_REPLAY_STREAM_REPLACED_WITH_REPAIR_AFTER_SOPHIE]', {
                interviewSessionId: deps.interviewSessionIdRef.current,
                preview: spoken.slice(0, 220),
              });
            } else if (scenarioCRepairConstructStillPending(params.messagesToUse)) {
              spoken = coerceScenarioCRepairQuestionForTts(SCENARIO_C_REPAIR_QUESTION_CANONICAL);
              state.scenarioCRepairQuestionSpokenThisStream = true;
              if (!deps.s3RepairProbeDeliveredRef.current) {
                markS3RepairProbeTtsDelivered(deps);
              }
              void remoteLog('[S3_Q1_REPLAY_STREAM_REPLACED_WITH_REPAIR_REASK]', {
                interviewSessionId: deps.interviewSessionIdRef.current,
                preview: spoken.slice(0, 220),
              });
            } else {
              void remoteLog('[S3_Q1_VERBATIM_REPLAY_STREAM_SUPPRESSED]', {
                interviewSessionId: deps.interviewSessionIdRef.current,
                preview: spoken.slice(0, 220),
              });
              return;
            }
          }
          if (
            scenarioCQ1InterpretationSatisfiedInTranscript(params.messagesToUse) &&
            !transcriptContainsScenarioCRepairQuestion(params.messagesToUse) &&
            looksLikeScenarioCDanielPrescriptiveQ1Paraphrase(spoken)
          ) {
            spoken = resolveScenarioCNextProbeAfterSatisfiedQ1(params.messagesToUse);
            if (looksLikeScenarioCSophiePerspectiveQuestion(spoken)) {
              state.scenarioCSophiePerspectiveProbeSpokenThisStream = true;
            } else if (isScenarioCRepairAssistantPrompt(spoken)) {
              state.scenarioCRepairQuestionSpokenThisStream = true;
              markS3RepairProbeTtsDelivered(deps);
            }
            void remoteLog('[S3_Q1_REPLAY_STREAM_REPLACED_AFTER_SATISFIED]', {
              interviewSessionId: deps.interviewSessionIdRef.current,
              preview: spoken.slice(0, 220),
            });
          }
          if (
            scenarioCQ1InterpretationSatisfiedInTranscript(params.messagesToUse) &&
            !transcriptContainsScenarioCRepairQuestion(params.messagesToUse) &&
            (looksLikeScenarioCNextStepsBetweenThemMisparaphraseQuestion(spoken) ||
              looksLikeScenarioCSophieSayToSophieMisparaphraseQuestion(spoken)) &&
            !scenarioCSophiePerspectiveProbeAlreadyDelivered(params.messagesToUse)
          ) {
            spoken = coerceScenarioCSophiePerspectiveQuestionForTts(spoken);
            state.scenarioCSophiePerspectiveProbeSpokenThisStream = true;
            void remoteLog('[S3_NEXT_STEPS_MISPARAPHRASE_STREAM_REPLACED]', {
              interviewSessionId: deps.interviewSessionIdRef.current,
              preview: spoken.slice(0, 220),
            });
          }
          if (
            looksLikeScenarioCSophiePerspectiveQuestion(spoken) &&
            (scenarioCSophiePerspectiveAnsweredInTranscript(params.messagesToUse) ||
              (state.scenarioCSophiePerspectiveProbeSpokenThisStream &&
                scenarioCSophiePerspectiveProbeAlreadyDelivered(params.messagesToUse)))
          ) {
            if (
              transcriptContainsScenarioCRepairQuestion(params.messagesToUse) ||
              state.scenarioCRepairQuestionSpokenThisStream ||
              deps.s3RepairProbeDeliveredRef.current
            ) {
              void remoteLog('[S3_SOPHIE_REPLAY_STREAM_SUPPRESSED_AFTER_ANSWER]', {
                interviewSessionId: deps.interviewSessionIdRef.current,
                preview: spoken.slice(0, 220),
              });
              return;
            }
            spoken = coerceScenarioCRepairQuestionForTts(SCENARIO_C_REPAIR_QUESTION_CANONICAL);
            state.scenarioCRepairQuestionSpokenThisStream = true;
            markS3RepairProbeTtsDelivered(deps);
            void remoteLog('[S3_SOPHIE_REPLAY_STREAM_REPLACED_WITH_REPAIR]', {
              interviewSessionId: deps.interviewSessionIdRef.current,
              preview: spoken.slice(0, 220),
            });
          }
          if (
            s3RepairSatisfied &&
            (looksLikeScenarioCSophiePerspectiveQuestion(spoken) ||
              isIncompleteScenarioCSophiePerspectiveLeadSentence(spoken) ||
              looksLikeScenarioCSophieRolePlayMisparaphraseQuestion(spoken))
          ) {
            void remoteLog('[S3_SOPHIE_REPLAY_STREAM_SUPPRESSED_AFTER_REPAIR]', {
              preview: spoken.slice(0, 200),
            });
            return;
          }
          if (
            s3RepairSatisfied &&
            !state.showScenarioCardCanonicalSpokenThisStream &&
            looksLikeMoment4GrudgePrompt(spoken) &&
            !isScenarioCBoundaryReflectionWithoutMoment4Handoff(spoken)
          ) {
            void remoteLog('[S3_M4_FRAGMENT_STREAM_SUPPRESSED_BEFORE_CANONICAL]', {
              preview: spoken.slice(0, 200),
            });
            return;
          }
          if (
            s3RepairSatisfied &&
            !state.showScenarioCardCanonicalSpokenThisStream &&
            assistantTextIsPrematureMoment4HandoffDuringScenarioC(spoken) &&
            !isScenarioCBoundaryReflectionWithoutMoment4Handoff(spoken) &&
            !/\bthere are only two questions left\b/i.test(spoken) &&
            !/\bsomething (?:a bit )?more personal\b/i.test(spoken)
          ) {
            void remoteLog('[S3_M4_FRAGMENT_STREAM_SUPPRESSED_BEFORE_CANONICAL]', {
              preview: spoken.slice(0, 200),
            });
            return;
          }
          if (
            scenarioCRepairConstructStillPending(params.messagesToUse) &&
            !looksLikeScenarioCSophiePerspectiveQuestion(spoken) &&
            !isIncompleteScenarioCSophiePerspectiveLeadSentence(spoken) &&
            !isScenarioCRepairAssistantPrompt(spoken) &&
            (isScenarioCBoundaryReflectionWithoutMoment4Handoff(spoken) ||
              assistantTextIsPrematureMoment4HandoffDuringScenarioC(spoken) ||
              /\bthere are only two questions left\b/i.test(spoken))
          ) {
            void remoteLog('[S3_PREMATURE_CLOSE_STREAM_SUPPRESSED]', {
              preview: spoken.slice(0, 220),
            });
            return;
          }
          if (
            isScenarioCRepairAssistantPrompt(spoken) ||
            looksLikeScenarioCRepairWithUserAnswerEcho(spoken)
          ) {
            const sophieSatisfied =
              scenarioCSophiePerspectiveProbeAlreadyDelivered(params.messagesToUse) ||
              scenarioCSophiePerspectiveAnsweredInTranscript(params.messagesToUse);
            if (
              !sophieSatisfied &&
              scenarioCQ1InterpretationSatisfiedInTranscript(params.messagesToUse)
            ) {
              spoken = coerceScenarioCSophiePerspectiveQuestionForTts(
                resolveScenarioCNextProbeAfterSatisfiedQ1(params.messagesToUse),
              );
              state.scenarioCSophiePerspectiveProbeSpokenThisStream = true;
              void remoteLog('[S3_REPAIR_BEFORE_SOPHIE_STREAM_REPLACED]', {
                interviewSessionId: deps.interviewSessionIdRef.current,
                preview: spoken.slice(0, 220),
              });
            } else if (
              shouldSuppressScenarioCRepairReplay(params.messagesToUse, spoken, {
                repairSpokenThisStream: state.scenarioCRepairQuestionSpokenThisStream,
                repairProbeDeliveredRef: deps.s3RepairProbeDeliveredRef.current,
              })
            ) {
              void remoteLog('[S3_REPAIR_VERBATIM_REPLAY_STREAM_SUPPRESSED]', {
                interviewSessionId: deps.interviewSessionIdRef.current,
                preview: spoken.slice(0, 220),
              });
              return;
            } else {
              spoken = coerceScenarioCRepairQuestionForTts(spoken);
              state.scenarioCRepairQuestionSpokenThisStream = true;
              markS3RepairProbeTtsDelivered(deps);
            }
          }
          if (
            params.shouldForceScenarioCSophiePerspectiveProbe &&
            !scenarioCSophiePerspectiveProbeAlreadyDelivered(params.messagesToUse) &&
            !looksLikeScenarioCSophiePerspectiveQuestion(spoken)
          ) {
            state.pendingScenarioCNextProbeFlush = true;
            void remoteLog('[S3_FORCED_SOPHIE_STREAM_SUPPRESSED]', {
              preview: spoken.slice(0, 200),
            });
            return;
          }
          if (
            params.shouldForceScenarioCRepairProbe &&
            !transcriptContainsScenarioCRepairQuestion(params.messagesToUse) &&
            !isScenarioCRepairAssistantPrompt(spoken)
          ) {
            state.pendingScenarioCNextProbeFlush = true;
            void remoteLog('[S3_FORCED_REPAIR_STREAM_SUPPRESSED]', {
              preview: spoken.slice(0, 200),
            });
            return;
          }
          const sophieReceiveMisparaphrase =
            looksLikeScenarioCSophieReceiveMisparaphraseQuestion(spoken) ||
            isIncompleteScenarioCSophieReceiveLeadSentence(spoken);
          if (sophieReceiveMisparaphrase) {
            const q1Satisfied = scenarioCQ1InterpretationSatisfiedInTranscript(params.messagesToUse);
            if (
              params.shouldForceScenarioCRepairProbe &&
              !transcriptContainsScenarioCRepairQuestion(params.messagesToUse)
            ) {
              spoken = coerceScenarioCRepairQuestionForTts(spoken);
              state.scenarioCRepairQuestionSpokenThisStream = true;
              markS3RepairProbeTtsDelivered(deps);
            } else if (
              q1Satisfied &&
              !transcriptContainsScenarioCRepairQuestion(params.messagesToUse)
            ) {
              spoken = coerceScenarioCNextProbeForStreamTts(params.messagesToUse);
              if (looksLikeScenarioCSophiePerspectiveQuestion(spoken)) {
                state.scenarioCSophiePerspectiveProbeSpokenThisStream = true;
              } else if (isScenarioCRepairAssistantPrompt(spoken)) {
                state.scenarioCRepairQuestionSpokenThisStream = true;
                markS3RepairProbeTtsDelivered(deps);
              }
              void remoteLog('[S3_SOPHIE_RECEIVE_MISPARAPHRASE_STREAM_REPLACED]', {
                interviewSessionId: deps.interviewSessionIdRef.current,
                preview: spoken.slice(0, 220),
              });
            } else {
              state.pendingScenarioCNextProbeFlush = true;
              void remoteLog('[S3_SOPHIE_RECEIVE_MISPARAPHRASE_STREAM_SUPPRESSED]', {
                preview: spoken.slice(0, 200),
              });
              return;
            }
          } else if (
            params.shouldForceScenarioCRepairProbe &&
            !transcriptContainsScenarioCRepairQuestion(params.messagesToUse) &&
            (looksLikeScenarioCDanielComeBackMisparaphraseQuestion(spoken) ||
              isIncompleteScenarioCDanielComeBackLeadSentence(spoken) ||
              looksLikeScenarioCDanielPrescriptiveBackInRoomQuestion(spoken))
          ) {
            spoken = coerceScenarioCRepairQuestionForTts(spoken);
            state.scenarioCRepairQuestionSpokenThisStream = true;
            markS3RepairProbeTtsDelivered(deps);
          } else if (looksLikeScenarioCDanielPrescriptiveQ1Paraphrase(spoken)) {
            spoken = coerceScenarioCQ1PrescriptiveStripForTts(
              spoken,
              params.messagesToUse as MessageWithScenario[],
            );
          }
          if (
            params.shouldForceScenarioCRepairProbe &&
            !transcriptContainsScenarioCRepairQuestion(params.messagesToUse) &&
            looksLikeScenarioCSophiePerspectiveQuestion(spoken)
          ) {
            void remoteLog('[S3_SOPHIE_STREAM_SUPPRESSED_BEFORE_REPAIR]', {
              preview: spoken.slice(0, 200),
            });
            return;
          }
          if (
            looksLikeScenarioCSophiePerspectiveQuestion(spoken) ||
            isIncompleteScenarioCSophiePerspectiveLeadSentence(spoken) ||
            looksLikeScenarioCSophieRolePlayMisparaphraseQuestion(spoken) ||
            looksLikeScenarioCNextStepsBetweenThemMisparaphraseQuestion(spoken) ||
            looksLikeScenarioCSophieSayToSophieMisparaphraseQuestion(spoken) ||
            isIncompleteScenarioCSophieSayToLeadSentence(spoken)
          ) {
            spoken = coerceScenarioCSophiePerspectiveQuestionForTts(spoken);
            if (looksLikeScenarioCSophiePerspectiveQuestion(spoken)) {
              state.scenarioCSophiePerspectiveProbeSpokenThisStream = true;
            }
          }
          if (
            params.shouldForceScenarioCRepairProbe &&
            looksLikeScenarioCDanielComeBackMisparaphraseQuestion(spoken) &&
            !isScenarioCRepairAssistantPrompt(spoken)
          ) {
            void remoteLog('[S3_DANIEL_MISPARAPHRASE_STREAM_SUPPRESSED]', {
              preview: spoken.slice(0, 200),
            });
            return;
          }
        }
        if (
          deps.currentInterviewMomentRef.current === 4 &&
          params.shouldForceMoment4ThresholdProbe &&
          (looksLikeMoment4ThresholdQuestion(spoken) ||
            isIncompleteMoment4ThresholdLeadSentence(spoken) ||
            looksLikeMoment4ThresholdParaphraseInProgress(spoken))
        ) {
          void remoteLog('[M4_THRESHOLD_STREAM_SUPPRESSED]', {
            preview: spoken.slice(0, 220),
          });
          return;
        }
        if (
          deps.currentInterviewMomentRef.current === 4 &&
          !params.shouldForceMoment4ThresholdProbe &&
          !deps.moment4ThresholdProbeAskedRef.current &&
          (looksLikeMoment4ThresholdQuestion(spoken) ||
            isIncompleteMoment4ThresholdLeadSentence(spoken) ||
            looksLikeMoment4ThresholdParaphraseInProgress(spoken))
        ) {
          void remoteLog('[M4_THRESHOLD_STREAM_SUPPRESSED_UNFORCED]', {
            preview: spoken.slice(0, 220),
          });
          return;
        }
        if (
          deps.currentInterviewMomentRef.current === 4 &&
          params.shouldForceMoment4ThresholdProbe &&
          (looksLikeMoment4GrudgeElaborationFollowUp(spoken) ||
            (/\?\s*$/.test(spoken.trim()) && spoken.trim().length > 10))
        ) {
          void remoteLog('[M4_GRUDGE_ELABORATION_STREAM_SUPPRESSED]', {
            preview: spoken.slice(0, 220),
          });
          return;
        }
        if (deps.currentInterviewMomentRef.current === 4) {
          spoken = coerceMoment4SpecificityFollowUpForTts(spoken);
          spoken = coerceMoment4ThresholdQuestionForTts(spoken);
        }
        if (
          isActiveScenarioAConstructProbeTurn(
            deps.currentScenarioRef.current,
            deps.currentInterviewMomentRef.current,
          )
        ) {
          if (looksLikeScenarioAContemptProbeQuestion(spoken)) {
            spoken = coerceScenarioAContemptProbeForTts(spoken);
          } else if (
            looksLikeScenarioARepairQuestion(spoken) ||
            isIncompleteScenarioARepairLeadSentence(spoken) ||
            looksLikeScenarioARepairStreamFragment(spoken)
          ) {
            const beforeRepairCoerce = spoken;
            spoken = coerceScenarioARepairQuestionForTts(spoken);
            if (spoken !== beforeRepairCoerce) {
              void remoteLog('[S1_REPAIR_QUESTION_COERCED_FOR_TTS]', {
                interviewSessionId: deps.interviewSessionIdRef.current,
                before: beforeRepairCoerce.slice(0, 220),
                after: spoken.slice(0, 220),
                s1ContemptFixVersion: 24,
              });
            }
          }
        }
        if (isIncompleteInterviewClosingLeadSentence(spoken)) {
          const normalizedClosingLead = spoken.replace(/\s+/g, ' ').trim().toLowerCase();
          if (
            deps.currentInterviewMomentRef.current === 5 &&
            /^thanks for sticking with (this|it|all of this)[.!?…]*$/i.test(normalizedClosingLead)
          ) {
            return;
          }
          state.deferredInterviewClosingLeadSentence = spoken;
          if (deps.currentInterviewMomentRef.current === 5) {
            state.moment5StickyCloseBufferAll = true;
          }
          return;
        }
        const elongatingBlockReason = elongatingProbePlaybackBlockReason({
          spokenSentence: spoken,
          suppressForUserTurn: params.elongatingSuppressedForUserTurn,
          elongatingProbeAlreadyFired: deps.elongatingProbeFiredRef.current,
        });
        if (elongatingBlockReason) {
          void remoteLog('[ELONGATING_PROBE_STREAM_SUPPRESSED]', {
            reason: elongatingBlockReason,
            preview: spoken,
            wordCount: params.trimmed.split(/\s+/).filter(Boolean).length,
          });
          return;
        }
        if (isApprovedElongatingProbeOnly(spoken)) {
          deps.elongatingProbeFiredRef.current = true;
        }
        if (deps.currentInterviewMomentRef.current === 5) {
          if (deps.moment5AccountabilityProbeFiredRef.current) {
            const afterProbeEchoStrip = stripMoment5AccountabilityProbeStreamingEcho(
              spoken,
              true,
            );
            if (afterProbeEchoStrip === null) {
              return;
            }
            spoken = afterProbeEchoStrip;
            if (!spoken.trim()) {
              return;
            }
          } else if (looksLikeMoment5AccountabilityProbeAssistantPrompt(spoken)) {
            deps.moment5AccountabilityProbeFiredRef.current = true;
            deps.moment5ClientScoringMetaRef.current = {
              ...(deps.moment5ClientScoringMetaRef.current ?? {}),
              accountabilityProbeFired: true,
              warmAckBeforeAccountabilityProbe:
                deps.moment5ClientScoringMetaRef.current?.warmAckBeforeAccountabilityProbe === true ||
                /\bappreciate you getting vulnerable\b/i.test(spoken),
            };
          }
        }
        const willDefer =
          allowDeferWarm &&
          shouldHoldBoundaryWarmStreamingLine(spoken, params.participantFirstNameForSpoken);
        if (willDefer) {
          state.deferredWarmBoundarySentence = spoken;
          return;
        }
        if (
          shouldDeferScenarioVignetteTailForOpeningMerge(
            spoken,
            bufferAfterSentence,
            params.textToParallelStream.full,
          )
        ) {
          state.deferredScenarioVignetteTailForOpeningMerge = spoken;
          return;
        }
        const streamSentenceDedup = applyConsecutiveStreamSentenceDedup(
          spoken,
          state.lastParallelStreamSentenceNorm,
        );
        state.lastParallelStreamSentenceNorm = streamSentenceDedup.lastSentenceNorm;
        spoken = streamSentenceDedup.text;
        if (!spoken.trim()) {
          void remoteLog('[STREAM_TTS_CONSECUTIVE_DUPLICATE_SUPPRESSED]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: sentence.slice(0, 160),
          });
          return;
        }
        if (
          isIntroBriefingReadinessOnlySentence(spoken) &&
          state.introBriefingReadinessQueuedThisStream
        ) {
          void remoteLog('[INTRO_BRIEFING_READINESS_DUPLICATE_SUPPRESSED]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: spoken.slice(0, 80),
          });
          return;
        }
        if (
          introBriefingSpeechEndsWithReadinessQuestion(spoken) ||
          isIntroBriefingReadinessOnlySentence(spoken)
        ) {
          state.introBriefingReadinessQueuedThisStream = true;
        }
        if (maybeSuppressScenarioARepairFragment(spoken)) {
          return;
        }
        batch.appendToParallelTtsBatch(spoken);
      };
}
