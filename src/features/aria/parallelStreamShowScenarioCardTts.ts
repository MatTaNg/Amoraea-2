import { persistScenarioOpeningDeliveredAfterPlayback } from '@features/aria/scenarioDeliveryResumeCheckpoint';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { getLastSubstantiveScenarioModalQuestion } from '@features/aria/interviewLanguageGate';
import { SHOW_SCENARIO_2_VIGNETTE_EXACT, SHOW_SCENARIO_3_VIGNETTE_EXACT } from '@features/aria/interviewShowScenarioExactCopy';
import { SCENARIO_3_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';
import {
  applySituation3ExactModalPrompt,
  isSituation3ModalAdvancedPastOpening,
  readSituation3DeliveryState,
} from '@features/aria/situation3ExactModalPrompt';
import { SCENARIO_1_OPENING, SCENARIO_2_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';
import {
  isSituation1ModalAdvancedPastOpening,
  resolveSituation1ExactModalPrompt,
} from '@features/aria/situation1ExactModalPrompt';
import {
  isSituation2ModalAdvancedPastOpening,
  resolveSituation2ExactModalPrompt,
} from '@features/aria/situation2ExactModalPrompt';
import { SHOW_SCENARIO_CARD_CANONICAL_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import {
  buildCanonicalShowScenarioCardTtsBody,
  buildLockedShowScenarioCardTtsText,
  composeShowScenarioCardTtsWithTransitionPrefix,
  detectShowScenarioCardKind,
  extractShowScenarioCardTransitionPrefix,
  resolveClientScenarioBoundaryPrefixForCanonicalTts,
  resolveCanonicalShowScenarioCardTransitionSpeakDecision,
  streamAlreadySpokeScenarioBoundaryClosingLead,
  isShowScenarioCardCanonicalPlaybackConfirmed,
  resolveShowScenarioCardKindForInterview,
  shouldSkipPersonalMomentCanonicalReplay,
  shouldSkipSituation1CanonicalReplay,
  shouldTreatShowScenarioCardCanonicalAsAlreadyDelivered,
  streamSpokenTextAlreadyMatchesCanonicalCard,
  completedScenarioForShowScenarioCardKind,
} from '@features/aria/showScenarioCardCanonicalTts';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/moment5ProbeCopy';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { triggerCompletedScenarioScoringIfNeeded } from '@features/aria/runScenarioBoundaryScoring';
import { advanceInterviewScenarioRefsAfterCanonicalShowScenarioCard } from '@features/aria/interviewScenarioRefSync';
import { scenarioAMinimumEngagementForHandoff } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { scenarioBJamesRepairProbeAlreadySatisfied } from '@features/aria/scenarioBProbeLogic';
import { remoteLog } from '@utilities/remoteLog';
import { scenarioCRepairConstructStillPending } from '@features/aria/scenarioCPromptDetection';
import { setTtsPlaybackActive } from '@utilities/sessionLogging';
import type { ParallelStreamTtsBatchController } from './parallelStreamTtsBatchController';
import type { ParallelStreamTtsPlaybackContext } from './parallelStreamTtsRuntimeState';

/** Parallel sentences can chain onto `ttsChain` while we await — drain until stable. */
async function awaitSettledParallelStreamTtsChain(
  state: ParallelStreamTtsPlaybackContext['state'],
  deps: ParallelStreamTtsPlaybackContext['deps'],
): Promise<void> {
  for (let i = 0; i < 24; i++) {
    const chain = state.ttsChain;
    await chain;
    const stillChaining = state.ttsChain !== chain;
    const lineBusy = deps.ttsLineInFlightRef.current === true;
    const parallelBusy = deps.parallelStreamingTtsRef.current.active === true;
    if (!stillChaining && !lineBusy && !parallelBusy) return;
  }
}

export function createParallelStreamSpeakShowScenarioCardOnce(
  ctx: ParallelStreamTtsPlaybackContext,
  batch: ParallelStreamTtsBatchController,
) {
  const { deps, params, state } = ctx;

  return async function speakShowScenarioCardStreamOnce(): Promise<void> {
    if (state.showScenarioCardCanonicalSpokenThisStream) return;

    const fullStream = stripControlTokens(params.textToParallelStream.full).trim();
    const kind =
      resolveShowScenarioCardKindForInterview({
        fullStream,
        interviewMoment: deps.currentInterviewMomentRef.current,
        interviewScenario: deps.currentScenarioRef.current,
      }) ?? detectShowScenarioCardKind(fullStream);
    if (!kind) return;

    if (
      kind === 'moment_4' &&
      deps.currentInterviewMomentRef.current === 3 &&
      (deps.currentScenarioRef.current ?? 1) === 3 &&
      scenarioCRepairConstructStillPending(params.messagesToUse)
    ) {
      void remoteLog('[SHOW_SCENARIO_CARD_CANONICAL_SPEAK_SKIPPED]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        kind,
        reason: 's3_repair_q2_still_pending',
      });
      return;
    }

    if (
      kind === 'situation_2' &&
      !scenarioAMinimumEngagementForHandoff(params.messagesToUse)
    ) {
      void remoteLog('[SHOW_SCENARIO_CARD_CANONICAL_SPEAK_SKIPPED]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        kind,
        reason: 's1_repair_engagement_incomplete',
      });
      return;
    }

    if (
      kind === 'situation_3' &&
      !scenarioBJamesRepairProbeAlreadySatisfied(params.messagesToUse)
    ) {
      void remoteLog('[SHOW_SCENARIO_CARD_CANONICAL_SPEAK_SKIPPED]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        kind,
        reason: 's2_james_repair_incomplete',
      });
      return;
    }

    if (kind === 'situation_1') {
      const s1Delivery = {
        contemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
        repairQuestionAsked: deps.scenarioARepairQuestionAskedRef.current,
      };
      if (
        shouldSkipSituation1CanonicalReplay({
          playbackConfirmedKinds: deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current ?? {},
          delivery: s1Delivery,
          lastQuestionText: deps.lastQuestionTextRef?.current ?? null,
          contemptSpokeThisStream: state.scenarioAContemptProbeSpokenThisStream,
        })
      ) {
        void remoteLog('[SHOW_SCENARIO_CARD_CANONICAL_SPEAK_SKIPPED]', {
          interviewSessionId: deps.interviewSessionIdRef.current,
          kind,
          reason: state.scenarioAContemptProbeSpokenThisStream
            ? 'contempt_spoke_this_stream'
            : deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current?.situation_1
              ? 's1_playback_confirmed'
              : 's1_follow_up_phase',
        });
        state.showScenarioCardCanonicalSpokenThisStream = true;
        return;
      }
    }

    if (
      shouldTreatShowScenarioCardCanonicalAsAlreadyDelivered({
        messages: params.messagesToUse,
        kind,
        playbackConfirmedKinds: deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current ?? {},
      })
    ) {
      void remoteLog('[SHOW_SCENARIO_CARD_CANONICAL_SPEAK_SKIPPED]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        kind,
        reason: 'transcript_and_playback_confirmed',
      });
      state.showScenarioCardCanonicalSpokenThisStream = true;
      return;
    }

    state.showScenarioCardCanonicalSpokenThisStream = true;
    batch.flushParallelTtsBatch(true);
    /**
     * Drain the live chain (not a snapshot). Parallel stream often queues the coerced
     * Moment 5 question onto `ttsChain` while this card path is waiting on the lead-in —
     * awaiting a single hop then canceling caused the conflict question to play twice.
     */
    await awaitSettledParallelStreamTtsChain(state, deps);

    const spokenSoFar = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
    const streamMatchesCanonical = streamSpokenTextAlreadyMatchesCanonicalCard(
      spokenSoFar,
      fullStream,
      kind,
    );
    if (
      streamMatchesCanonical &&
      (isShowScenarioCardCanonicalPlaybackConfirmed(
        deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current ?? {},
        kind,
      ) ||
        shouldSkipPersonalMomentCanonicalReplay({
          kind,
          spokenCompleteText: spokenSoFar,
          fullStream,
          playbackConfirmedKinds: deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current ?? {},
        }))
    ) {
      if (deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef) {
        deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current = {
          ...deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current,
          [kind]: true,
        };
      }
      if (kind === 'moment_5') {
        deps.moment5QuestionDeliveredRef.current = true;
        deps.moment5PrimaryAnchorDeliveredSessionRef.current = true;
        if (deps.currentInterviewMomentRef.current < 5) {
          deps.currentInterviewMomentRef.current = 5;
        }
        deps.lastQuestionTextRef.current = MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT;
      } else if (kind === 'moment_4') {
        deps.lastQuestionTextRef.current = MOMENT_4_GRUDGE_QUESTION_TEXT;
      }
      void remoteLog('[SHOW_SCENARIO_CARD_CANONICAL_SPEAK_SKIPPED]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        kind,
        reason: 'stream_spoken_canonical_body',
      });
      return;
    }

    /**
     * Cancel any in-flight parallel batch (often the model wrap lead) before replacing with the
     * locked card. Text already queued into spokenCompleteText must NOT count as "transition
     * already spoken" — that audio was stopped and the user never heard it.
     */
    let cancelledParallelPrefixForCanonical = false;
    const spokenBeforeCancel = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
    const completedForKind =
      kind === 'moment_4' ? 3 : kind === 'situation_3' ? 2 : kind === 'situation_2' ? 1 : null;
    const boundaryLeadAlreadyAudible =
      completedForKind != null &&
      streamAlreadySpokeScenarioBoundaryClosingLead(spokenBeforeCancel, completedForKind);
    if (
      spokenBeforeCancel &&
      !streamSpokenTextAlreadyMatchesCanonicalCard(spokenBeforeCancel, fullStream, kind) &&
      !boundaryLeadAlreadyAudible
    ) {
      deps.parallelStreamingTtsRef.current.cancelRequested = true;
      state.ttsCancelled = true;
      cancelledParallelPrefixForCanonical = true;
      await deps.stopElevenLabsPlayback();
      state.parallelTtsBatchBuffer = '';
      state.parallelTtsBatchPrefetch = null;
      state.showScenarioCardTransitionPrefixSpoken = false;
      deps.parallelStreamingTtsRef.current.spokenCompleteText = '';
    }

    const canonicalBody = buildLockedShowScenarioCardTtsText(kind) ?? buildCanonicalShowScenarioCardTtsBody(kind);
    const prefix = extractShowScenarioCardTransitionPrefix(fullStream, kind);
    const effectivePrefix = resolveClientScenarioBoundaryPrefixForCanonicalTts({
      kind,
      messages: params.messagesToUse,
      firstName: params.participantFirstNameForSpoken,
      extractedPrefix: prefix,
    });
    const spokenLiveAfterCancelGate = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
    const { transitionAlreadySpoken, spokenSoFarForCompose } =
      resolveCanonicalShowScenarioCardTransitionSpeakDecision({
        kind,
        effectivePrefix,
        spokenLive: spokenLiveAfterCancelGate,
        cancelledParallelPlayback: cancelledParallelPrefixForCanonical,
      });
    const canonicalText = buildLockedShowScenarioCardTtsText(kind) ?? canonicalBody;

    if (!canonicalText) {
      state.showScenarioCardCanonicalSpokenThisStream = false;
      return;
    }

    const textToSpeak = composeShowScenarioCardTtsWithTransitionPrefix({
      prefix: effectivePrefix,
      canonicalText,
      spokenSoFar: spokenSoFarForCompose,
      transitionAlreadySpoken,
    });

    void remoteLog('[SHOW_SCENARIO_CARD_CANONICAL_SPEAK]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      kind,
      transitionAlreadySpoken,
      cancelledParallelPrefixForCanonical,
      includesTransitionPrefix: textToSpeak !== canonicalText,
      preview: textToSpeak.slice(0, 220),
    });

    /**
     * Arm utterance text only for tab-hide restore. Do not pre-set line-in-flight or
     * playback-active — speakTextSafe drains prior playback first and would stall ~8s.
     */
    if (deps.ttsUtteranceInFlightRef) {
      deps.ttsUtteranceInFlightRef.current = textToSpeak;
    }
    deps.parallelStreamingTtsRef.current.accumulatedFullText = textToSpeak;
    if (kind === 'situation_3' && deps.lastQuestionTextRef) {
      deps.lastQuestionTextRef.current = SCENARIO_3_OPENING;
    } else if (kind === 'situation_2' && deps.lastQuestionTextRef) {
      deps.lastQuestionTextRef.current = SCENARIO_2_OPENING;
    } else if (kind === 'situation_1' && deps.lastQuestionTextRef) {
      deps.lastQuestionTextRef.current = SCENARIO_1_OPENING;
    } else if (kind === 'moment_4' && deps.lastQuestionTextRef) {
      deps.lastQuestionTextRef.current = MOMENT_4_GRUDGE_QUESTION_TEXT;
    } else if (kind === 'moment_5' && deps.lastQuestionTextRef) {
      deps.lastQuestionTextRef.current = MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT;
    }

    try {
      await deps.speakTextSafe(textToSpeak, SHOW_SCENARIO_CARD_CANONICAL_SPEECH);
    } finally {
      if (deps.ttsUtteranceInFlightRef) {
        deps.ttsUtteranceInFlightRef.current = null;
      }
      deps.ttsLineInFlightRef.current = false;
      if (deps.userId && !deps.parallelStreamingTtsRef.current.active) {
        setTtsPlaybackActive(false);
      }
    }
    const playbackConfirmed = isShowScenarioCardCanonicalPlaybackConfirmed(
      deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current,
      kind,
    );
    if (!playbackConfirmed) {
      state.showScenarioCardCanonicalSpokenThisStream = false;
      // S3→M4: still advance moment so a TTS crash cannot leave resume stuck replaying Situation 3.
      if (kind === 'moment_4') {
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
      }
      return;
    }
    if (
      deps.userId &&
      (kind === 'situation_1' || kind === 'situation_2' || kind === 'situation_3')
    ) {
      void persistScenarioOpeningDeliveredAfterPlayback({
        userId: deps.userId,
        kind,
        lastQuestionText: deps.lastQuestionTextRef?.current ?? null,
        sessionAttemptId: deps.interviewSessionAttemptIdRef?.current ?? null,
        currentScenario: deps.currentScenarioRef?.current as 1 | 2 | 3 | null | undefined,
        resumeActiveScenario: deps.resumeActiveScenarioRef?.current ?? null,
      });
    }
    if (kind === 'situation_2' || kind === 'situation_3' || kind === 'moment_4') {
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
    }
    deps.parallelStreamingTtsRef.current.spokenCompleteText = textToSpeak;
    params.textToParallelStream.full = textToSpeak;
    params.textToParallelStream.spokenStarted = true;
    deps.recordInterviewAssistantDeliveryForMetaExemptionRef?.current?.(textToSpeak);
    const completedScenario = completedScenarioForShowScenarioCardKind(kind);
    if (
      completedScenario !== 1 ||
      scenarioAMinimumEngagementForHandoff(params.messagesToUse)
    ) {
      triggerCompletedScenarioScoringIfNeeded({
        completedScenario,
        messagesForScoring: params.messagesToUse,
        trigger: `show_scenario_card_canonical_${kind}`,
        ensureCompletedScenarioScored: deps.ensureCompletedScenarioScored,
      });
    }
    const s1Delivery = {
      contemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
      repairQuestionAsked: deps.scenarioARepairQuestionAskedRef.current,
    };
    const s1AdvancedPastOpening = isSituation1ModalAdvancedPastOpening(
      s1Delivery,
      deps.lastQuestionTextRef?.current ?? null,
    );
    if (kind === 'situation_1') {
      if (!s1AdvancedPastOpening) {
        if (deps.lastQuestionTextRef) {
          deps.lastQuestionTextRef.current = SCENARIO_1_OPENING;
        }
        deps.setReferenceCardPrompt(SCENARIO_1_OPENING);
      } else {
        const exact = resolveSituation1ExactModalPrompt([], null, s1Delivery);
        deps.setReferenceCardPrompt(exact);
        if (deps.lastQuestionTextRef) {
          deps.lastQuestionTextRef.current = exact;
        }
      }
    } else if (kind === 'situation_2') {
      const s2Scenario = { label: 'Situation 2', text: SHOW_SCENARIO_2_VIGNETTE_EXACT };
      if (deps.committedScenarioRef) {
        deps.committedScenarioRef.current = s2Scenario;
      }
      deps.setReferenceCardScenario(s2Scenario);
      deps.setInterviewUiPhase('scenario_active');
      const s2Delivery = {
        jamesDifferentlyAsked: false,
        repairQuestionAsked: deps.s2RepairProbeDeliveredRef.current,
      };
      const s2AdvancedPastOpening = isSituation2ModalAdvancedPastOpening(
        s2Delivery,
        deps.lastQuestionTextRef?.current ?? null,
      );
      if (!s2AdvancedPastOpening) {
        if (deps.lastQuestionTextRef) {
          deps.lastQuestionTextRef.current = SCENARIO_2_OPENING;
        }
        deps.setReferenceCardPrompt(SCENARIO_2_OPENING);
      } else {
        const exact = resolveSituation2ExactModalPrompt([], null, s2Delivery);
        deps.setReferenceCardPrompt(exact);
        if (deps.lastQuestionTextRef) {
          deps.lastQuestionTextRef.current = exact;
        }
      }
    } else if (kind === 'situation_3') {
      const s3Scenario = { label: 'Situation 3', text: SHOW_SCENARIO_3_VIGNETTE_EXACT };
      if (deps.committedScenarioRef) {
        deps.committedScenarioRef.current = s3Scenario;
      }
      deps.setReferenceCardScenario(s3Scenario);
      deps.setInterviewUiPhase('scenario_active');
      const s3Delivery = readSituation3DeliveryState(
        params.messagesToUse.map((m) => ({
          role: m.role,
          content: stripControlTokens(m.content ?? '').trim(),
        })),
      );
      const s3AdvancedPastOpening = isSituation3ModalAdvancedPastOpening(
        s3Delivery,
        deps.lastQuestionTextRef?.current ?? null,
      );
      if (!s3AdvancedPastOpening) {
        if (deps.lastQuestionTextRef) {
          deps.lastQuestionTextRef.current = SCENARIO_3_OPENING;
        }
        deps.setReferenceCardPrompt(SCENARIO_3_OPENING);
      } else {
        applySituation3ExactModalPrompt(
          deps,
          params.messagesToUse.map((m) => ({
            role: m.role,
            content: stripControlTokens(m.content ?? '').trim(),
          })),
          null,
          s3Delivery,
        );
      }
    } else {
      const modalQuestion = getLastSubstantiveScenarioModalQuestion([
        { role: 'assistant', content: canonicalText },
      ]);
      if (modalQuestion) {
        if (deps.lastQuestionTextRef) {
          deps.lastQuestionTextRef.current = modalQuestion;
        }
        deps.setReferenceCardPrompt(modalQuestion);
      }
    }
    if (
      !(kind === 'situation_1' && s1AdvancedPastOpening) &&
      deps.referenceCardShouldUpdateOnPlaybackStart(textToSpeak)
    ) {
      deps.applyReferenceCardFromAssistantSpeechRef?.current?.(textToSpeak);
    }
    state.showScenarioCardStreamBuffer = '';
    state.streamShowScenarioCardMuteActive = false;
  };
}
