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
  __showScenarioCardCanonicalTtsTest,
  buildCanonicalShowScenarioCardTtsBody,
  buildLockedShowScenarioCardTtsText,
  composeShowScenarioCardTtsWithTransitionPrefix,
  detectShowScenarioCardKind,
  extractShowScenarioCardTransitionPrefix,
  resolveClientScenarioBoundaryPrefixForCanonicalTts,
  resolveShowScenarioCardTransitionAlreadySpoken,
  isShowScenarioCardCanonicalPlaybackConfirmed,
  resolveShowScenarioCardKindForInterview,
  shouldSkipSituation1CanonicalReplay,
  shouldTreatShowScenarioCardCanonicalAsAlreadyDelivered,
  streamSpokenTextAlreadyMatchesCanonicalCard,
} from '@features/aria/showScenarioCardCanonicalTts';
import { triggerCompletedScenarioScoringIfNeeded } from '@features/aria/runScenarioBoundaryScoring';
import { completedScenarioForShowScenarioCardKind } from '@features/aria/showScenarioCardCanonicalTts';
import { scenarioAMinimumEngagementForHandoff } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { remoteLog } from '@utilities/remoteLog';
import { scenarioCRepairConstructStillPending } from '@features/aria/scenarioCPromptDetection';
import { fetchElevenLabsMpegArrayBuffer } from '@features/aria/utils/elevenLabsTtsFetch';
import { speakLongFormInterviewHtmlMp3 } from '@features/aria/utils/speakLongFormInterviewHtmlMp3';
import { setTtsPlaybackActive } from '@utilities/sessionLogging';
import type { ParallelStreamTtsBatchController } from './parallelStreamTtsBatchController';
import type { ParallelStreamTtsPlaybackContext } from './parallelStreamTtsRuntimeState';

export function createParallelStreamSpeakShowScenarioCardOnce(
  ctx: ParallelStreamTtsPlaybackContext,
  batch: ParallelStreamTtsBatchController,
) {
  const { deps, params, state } = ctx;
  const { normalizeForCompare } = __showScenarioCardCanonicalTtsTest;

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

    if (kind === 'situation_1') {
      const s1Delivery = {
        contemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
        repairQuestionAsked: deps.scenarioARepairQuestionAskedRef.current,
      };
      if (
        shouldSkipSituation1CanonicalReplay({
          playbackConfirmedKinds: deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current,
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
            : deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current.situation_1
              ? 's1_playback_confirmed'
              : 's1_follow_up_phase',
        });
        state.showScenarioCardCanonicalSpokenThisStream = true;
        return;
      }
    }

    const lockedExact = buildLockedShowScenarioCardTtsText(kind);
    const earlyCanonicalBody = lockedExact ?? buildCanonicalShowScenarioCardTtsBody(kind);
    const canonicalPrefetchPromise = earlyCanonicalBody
      ? fetchElevenLabsMpegArrayBuffer(earlyCanonicalBody)
      : Promise.resolve(null as ArrayBuffer | null);

    if (
      shouldTreatShowScenarioCardCanonicalAsAlreadyDelivered({
        messages: params.messagesToUse,
        kind,
        playbackConfirmedKinds: deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current,
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

    const spokenSoFar = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
    if (
      spokenSoFar &&
      streamSpokenTextAlreadyMatchesCanonicalCard(spokenSoFar, fullStream) &&
      isShowScenarioCardCanonicalPlaybackConfirmed(
        deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current,
        kind,
      )
    ) {
      void remoteLog('[SHOW_SCENARIO_CARD_CANONICAL_SPEAK_SKIPPED]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        kind,
        reason: 'stream_spoken_playback_confirmed',
      });
      state.showScenarioCardCanonicalSpokenThisStream = true;
      return;
    }

    state.showScenarioCardCanonicalSpokenThisStream = true;
    batch.flushParallelTtsBatch(true);
    await state.ttsChain;

    if (spokenSoFar && !streamSpokenTextAlreadyMatchesCanonicalCard(spokenSoFar, fullStream)) {
      deps.parallelStreamingTtsRef.current.cancelRequested = true;
      state.ttsCancelled = true;
      await deps.stopElevenLabsPlayback();
      state.parallelTtsBatchBuffer = '';
      state.parallelTtsBatchPrefetch = null;
    }

    const canonicalBody = lockedExact ?? buildCanonicalShowScenarioCardTtsBody(kind);
    const prefix = extractShowScenarioCardTransitionPrefix(fullStream, kind);
    const effectivePrefix = resolveClientScenarioBoundaryPrefixForCanonicalTts({
      kind,
      messages: params.messagesToUse,
      firstName: params.participantFirstNameForSpoken,
      extractedPrefix: prefix,
    });
    const transitionAlreadySpoken = resolveShowScenarioCardTransitionAlreadySpoken({
      prefix: effectivePrefix,
      spokenSoFar,
      scenarioJustCompleted:
        kind === 'moment_4' ? 3 : kind === 'situation_3' ? 2 : kind === 'situation_2' ? 1 : undefined,
    });
    const canonicalText = lockedExact ?? canonicalBody;

    if (!canonicalText) {
      state.showScenarioCardCanonicalSpokenThisStream = false;
      return;
    }

    const textToSpeak = composeShowScenarioCardTtsWithTransitionPrefix({
      prefix: effectivePrefix,
      canonicalText,
      spokenSoFar,
      transitionAlreadySpoken,
    });

    void remoteLog('[SHOW_SCENARIO_CARD_CANONICAL_SPEAK]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      kind,
      transitionAlreadySpoken,
      includesTransitionPrefix: textToSpeak !== canonicalText,
      preview: textToSpeak.slice(0, 220),
    });

    /**
     * HTML long-form speak does not go through speakTextSafe, so without this tab-hide
     * restore falls back to a stale lastQuestion (e.g. S2 James repair during S3 open).
     */
    if (deps.webTtsUtteranceInFlightRef) {
      deps.webTtsUtteranceInFlightRef.current = textToSpeak;
    }
    deps.ttsLineInFlightRef.current = true;
    if (deps.userId) {
      setTtsPlaybackActive(true);
    }
    deps.parallelStreamingTtsRef.current.accumulatedFullText = textToSpeak;
    if (kind === 'situation_3' && deps.lastQuestionTextRef) {
      deps.lastQuestionTextRef.current = SCENARIO_3_OPENING;
    } else if (kind === 'situation_2' && deps.lastQuestionTextRef) {
      deps.lastQuestionTextRef.current = SCENARIO_2_OPENING;
    } else if (kind === 'situation_1' && deps.lastQuestionTextRef) {
      deps.lastQuestionTextRef.current = SCENARIO_1_OPENING;
    }

    const prefetchedBuffer =
      (await canonicalPrefetchPromise.catch(() => null)) ?? null;
    const prefetchMatches =
      !prefetchedBuffer?.byteLength ||
      normalizeForCompare(textToSpeak).includes(normalizeForCompare(earlyCanonicalBody ?? ''));
    let htmlMp3Played = false;
    try {
      try {
        htmlMp3Played = await speakLongFormInterviewHtmlMp3({
          text: textToSpeak,
          telemetrySource: 'turn',
          prefetchedBuffer: prefetchMatches ? prefetchedBuffer : null,
          onPlaybackStarted: () => deps.setVoiceState('speaking'),
        });
      } catch {
        htmlMp3Played = false;
      }

      if (htmlMp3Played) {
        deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current = {
          ...deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current,
          [kind]: true,
        };
        deps.setVoiceState('idle');
      } else {
        await deps.speakTextSafe(textToSpeak, SHOW_SCENARIO_CARD_CANONICAL_SPEECH);
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
    const playbackConfirmed = isShowScenarioCardCanonicalPlaybackConfirmed(
      deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current,
      kind,
    );
    if (!playbackConfirmed) {
      state.showScenarioCardCanonicalSpokenThisStream = false;
      return;
    }
    deps.parallelStreamingTtsRef.current.spokenCompleteText = textToSpeak;
    params.textToParallelStream.full = textToSpeak;
    params.textToParallelStream.spokenStarted = true;
    deps.recordInterviewAssistantDeliveryForMetaExemptionRef.current(textToSpeak);
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
      deps.committedScenarioRef.current = s2Scenario;
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
      deps.committedScenarioRef.current = s3Scenario;
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
      deps.applyReferenceCardFromAssistantSpeechRef.current(textToSpeak);
    }
    state.showScenarioCardStreamBuffer = '';
    state.streamShowScenarioCardMuteActive = false;
  };
}
