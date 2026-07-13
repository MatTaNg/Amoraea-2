import { Platform } from 'react-native';

import { isActiveScenarioAConstructProbeTurn, isActiveScenarioBConstructProbeTurn, isActiveScenarioCConstructProbeTurn } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import {
  isInterviewClosingReflectiveAckFragment,
  isInterviewClosingThanksFragment,
  looksLikeInterviewClosingAssistantMessage,
} from '@features/aria/elongatingProbe';
import { dedupeAdjacentBoundaryValidationsBeforeParticipantName } from '@features/aria/interviewerFrameworkPrompt';
import {
  hasInterviewClosingTtsDeliveredForSession,
  markInterviewClosingTtsDelivered,
  releaseInterviewClosingSpeak,
  shouldSuppressDuplicateInterviewClosingTts,
  tryAcquireInterviewClosingSpeak,
} from '@features/aria/interviewClosingTtsSession';
import { getLastSubstantiveScenarioModalQuestion } from '@features/aria/interviewLanguageGate';
import {
  isScenarioANonScriptedModalParaphrase,
  resolveSituation1ExactModalPrompt,
} from '@features/aria/situation1ExactModalPrompt';
import { resolveSituation2ExactModalPrompt } from '@features/aria/situation2ExactModalPrompt';
import { applySituation3ExactModalPrompt, readSituation3DeliveryState } from '@features/aria/situation3ExactModalPrompt';
import { sanitizeAssistantInterviewerCharacterNames } from '@/constants/interviewCharacterNames';
import { ensureCanonicalIntroBriefingForTts } from '@features/aria/interviewPreambleBriefing';
import { substituteCanonicalInterviewScenarioBodiesForTts } from '@features/aria/substituteCanonicalInterviewScenarioBodiesForTts';
import {
  looksLikeScenarioAContemptProbeQuestion,
  isScenarioCRepairAssistantPrompt,
} from '@features/aria/probeAndScoringUtils';
import { markMoment5ResolutionFollowUpTtsDelivered } from '@features/aria/moment5DeliveryReconcile';
import { markS3RepairProbeTtsDelivered } from '@features/aria/scenarioCDeliveryReconcile';
import { looksLikeMoment5ResolutionFollowUpPrompt } from '@features/aria/moment5SpecificityRedirect';
import { isIncompleteScenarioAContemptProbeLeadSentence } from '@features/aria/scenarioAContemptProbeLogic';
import {
  coerceScenarioARepairQuestionForTts,
  looksLikeScenarioARepairQuestion,
} from '@features/aria/scenarioARepairQuestionHelpers';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from '@features/aria/probeAndScoringUtils';
import {
  looksLikeScenarioARepairStreamFragment,
  shouldSuppressScenarioARepairBeforeContemptAnswer,
} from '@features/aria/interviewDisengagementProbes';
import {
  isScenarioBScriptedProbeForTts,
  looksLikeScenarioBRepairAsJamesQuestion,
  looksLikeScenarioBJamesDifferentlyQuestion,
} from '@features/aria/scenarioBProbeLogic';
import {
  shouldSuppressParallelStreamNonExactShowScenarioCardSpeech,
  isShowScenarioCardFollowUpProbeSentence,
} from '@features/aria/showScenarioCardCanonicalTts';
import { speakWithElevenLabs } from '@features/aria/utils/speakWithElevenLabsCore';
import { getActiveWebHtmlAudioVolumeForTelemetry } from '@features/aria/utils/webInterviewActiveHtmlAudio';
import { isWebInterviewPlaybackSurfaceActive } from '@features/aria/utils/webInterviewPlaybackSurface';
import { looksLikeScenarioHandoffOrVignetteBundle } from '@features/aria/computeParallelStreamTabRestoreText';
import { gatherParallelStreamingTtsPlaybackTelemetry } from '@utilities/sessionLogging/sessionAudioTelemetry';
import {
  getSessionLogRuntime,
  markLastAudioSessionEventType,
  setTtsPlaybackActive,
  writeSessionLog,
} from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';

import type { ParallelStreamTtsPlaybackContext } from './parallelStreamTtsRuntimeState';

export type EnqueueParallelStreamTtsUtterance = (
  spoken: string,
  prefetched?: Promise<ArrayBuffer | null> | null,
) => void;

export function createParallelStreamEnqueueTtsUtterance(
  ctx: ParallelStreamTtsPlaybackContext,
): EnqueueParallelStreamTtsUtterance {
  const { deps, params, state, postRecordingSettleForThisParallelStream } = ctx;

  return (spoken: string, prefetched?: Promise<ArrayBuffer | null> | null) => {
    const speakGenAtEnqueue = deps.webTtsSpeakGenerationRef.current;
    state.ttsChain = state.ttsChain.then(async () => {
      if (state.ttsCancelled || deps.parallelStreamingTtsRef.current.cancelRequested) {
        return;
      }
      if (Platform.OS === 'web' && speakGenAtEnqueue !== deps.webTtsSpeakGenerationRef.current) {
        void remoteLog('[parallel_stream] utterance_skipped_speak_generation', {
          preview: spoken.slice(0, 120),
        });
        return;
      }
      deps.parallelStreamingTtsRef.current.active = true;
      let closingSpeakLooksFinal = false;
      let closingTtsSessionKey =
        deps.interviewSessionAttemptIdRef.current ?? deps.interviewSessionIdRef.current;
      try {
        const spokenBeforeCanonical = spoken;
        const spokenForTts = ensureCanonicalIntroBriefingForTts(
          substituteCanonicalInterviewScenarioBodiesForTts(
            dedupeAdjacentBoundaryValidationsBeforeParticipantName(
              sanitizeAssistantInterviewerCharacterNames(spoken),
              params.participantFirstNameForSpoken,
            ),
          ),
          params.participantFirstNameForSpoken,
        );
        if (
          !isScenarioBScriptedProbeForTts(spokenForTts) &&
          shouldSuppressParallelStreamNonExactShowScenarioCardSpeech({
            spokenForTts,
            interviewMoment: deps.currentInterviewMomentRef.current,
            interviewScenario: deps.currentScenarioRef.current,
            showScenarioCardCanonicalSpokenThisStream: state.showScenarioCardCanonicalSpokenThisStream,
            fullStream: params.textToParallelStream.full,
          })
        ) {
          void remoteLog('[SHOW_SCENARIO_CARD_PARALLEL_SUPPRESSED_NON_EXACT]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: spokenForTts.slice(0, 220),
          });
          return;
        }
        if (
          deps.currentInterviewMomentRef.current === 1 &&
          (looksLikeScenarioAContemptProbeQuestion(spokenForTts) ||
            isIncompleteScenarioAContemptProbeLeadSentence(spokenForTts))
        ) {
          void remoteLog('[S1_CONTEMPT_PROBE_PARALLEL_SUPPRESSED]', {
            preview: spokenForTts.slice(0, 200),
            s1ContemptFixVersion: 15,
          });
          return;
        }
        if (
          deps.currentInterviewMomentRef.current === 1 &&
          shouldSuppressScenarioARepairBeforeContemptAnswer({
            currentScenario: deps.currentScenarioRef.current,
            currentMoment: deps.currentInterviewMomentRef.current,
            shouldForceScenarioAContemptProbe: params.shouldForceScenarioAContemptProbe,
            scenarioAContemptProbeSpokenThisStream: state.scenarioAContemptProbeSpokenThisStream,
            scenarioAContemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
            specificEmmaLineAlreadyAddressed: params.specificEmmaLineAlreadyAddressed,
            scenarioARepairQuestionAsked: deps.scenarioARepairQuestionAskedRef.current,
            allowScenarioARepairAfterContemptAnswer: params.allowScenarioARepairAfterContemptAnswer,
          }) &&
          looksLikeScenarioARepairStreamFragment(spokenForTts)
        ) {
          void remoteLog('[S1_REPAIR_PARALLEL_SUPPRESSED_BEFORE_CONTEMPT]', {
            preview: spokenForTts.slice(0, 220),
            s1ContemptFixVersion: 21,
          });
          return;
        }
        closingTtsSessionKey =
          deps.interviewSessionAttemptIdRef.current ?? deps.interviewSessionIdRef.current;
        closingSpeakLooksFinal = looksLikeInterviewClosingAssistantMessage(
          stripControlTokens(spokenForTts).trim(),
        );
        if (
          shouldSuppressDuplicateInterviewClosingTts(closingTtsSessionKey, spokenForTts) &&
          hasInterviewClosingTtsDeliveredForSession(closingTtsSessionKey)
        ) {
          void remoteLog('[M5_CLOSING_TTS_SUPPRESSED_DUPLICATE]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            source: 'parallel_stream',
            preview: spokenForTts.slice(0, 220),
          });
          return;
        }
        if (
          shouldSuppressDuplicateInterviewClosingTts(closingTtsSessionKey, spokenForTts) &&
          !hasInterviewClosingTtsDeliveredForSession(closingTtsSessionKey)
        ) {
          void remoteLog('[M5_CLOSING_TTS_SUPPRESSED_DUPLICATE]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            source: 'parallel_stream_stale_in_flight',
            preview: spokenForTts.slice(0, 220),
          });
          releaseInterviewClosingSpeak(closingTtsSessionKey);
        }
        if (closingSpeakLooksFinal && !tryAcquireInterviewClosingSpeak(closingTtsSessionKey)) {
          void remoteLog('[M5_CLOSING_SPEAK_SUPPRESSED_IN_FLIGHT]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            source: 'parallel_stream_acquire',
            preview: spokenForTts.slice(0, 220),
          });
          if (hasInterviewClosingTtsDeliveredForSession(closingTtsSessionKey)) {
            return;
          }
          releaseInterviewClosingSpeak(closingTtsSessionKey);
          if (!tryAcquireInterviewClosingSpeak(closingTtsSessionKey)) {
            return;
          }
        }
        if (deps.userId) {
          const rtd = getSessionLogRuntime();
          const freshNameFromProfile = deps.interviewNameRef.current ?? '';
          writeSessionLog({
            userId: deps.userId,
            attemptId: rtd.attemptId,
            eventType: 'name_source_debug',
            eventData: {
              stage: 'parallel_sentence',
              participant_first_name_present: !!params.participantFirstNameForSpoken,
              participant_first_name_length: params.participantFirstNameForSpoken.length,
              fresh_name_present: !!freshNameFromProfile,
              fresh_name_length: freshNameFromProfile.length,
            },
            platform: rtd.platform,
          });
        }
        if (deps.userId) {
          const rtd = getSessionLogRuntime();
          writeSessionLog({
            userId: deps.userId,
            attemptId: rtd.attemptId,
            eventType: 'name_injection_debug',
            eventData: {
              stage: 'parallel_sentence',
              moment_number: deps.currentInterviewMomentRef.current,
              scenario_number: deps.currentScenarioRef.current,
              raw_has_name: params.participantFirstNameForSpoken
                ? spoken.toLowerCase().includes(params.participantFirstNameForSpoken.toLowerCase())
                : null,
              injected_has_name: params.participantFirstNameForSpoken
                ? spokenForTts.toLowerCase().includes(params.participantFirstNameForSpoken.toLowerCase())
                : null,
              raw_preview: spoken.slice(0, 140),
              injected_preview: spokenForTts.slice(0, 140),
            },
            platform: rtd.platform,
          });
        }
        await deps.awaitTtsScreenReadyGate('parallel_streaming_sentence');
        const parallelStreamContinuation = state.parallelStreamSentenceIndex > 0;
        const afterRecordingTelemetry =
          postRecordingSettleForThisParallelStream && state.parallelStreamSentenceIndex === 0;
        state.parallelStreamSentenceIndex += 1;
        deps.webTtsUtteranceInFlightRef.current = spokenForTts;
        deps.webTtsUtteranceInFlightOptionsRef.current = {
          interviewSpeechRole: 'assistant_response',
          telemetrySource: 'turn',
          skipInterviewSpeechAdvance: false,
          skipQuestionDeliveredTelemetry: false,
          skipLastQuestionRef: false,
          allowDuplicateConsecutiveTts: false,
          silent: false,
          skipGestureGate: false,
          ttsTriggerSource: 'callback',
        };
        const ttsPlaybackActiveImmediatelyPrior = getSessionLogRuntime().ttsPlaybackActive;
        const parallelTtsStartMs = Date.now();
        const PARALLEL_STREAM_PREFETCH_TIMEOUT_MS = 45_000;
        const canonicalSubstituteChangedText = spokenForTts.trim() !== spokenBeforeCanonical.trim();
        const prefetchedBuf =
          prefetched && !canonicalSubstituteChangedText
            ? await Promise.race([
                prefetched,
                new Promise<ArrayBuffer | null>((resolve) => {
                  setTimeout(() => {
                    void remoteLog('[parallel_stream] prefetch_timeout', {
                      preview: spokenForTts.slice(0, 120),
                    });
                    resolve(null);
                  }, PARALLEL_STREAM_PREFETCH_TIMEOUT_MS);
                }),
              ])
            : null;
        if (deps.userId) {
          setTtsPlaybackActive(true);
          deps.ttsLineInFlightRef.current = true;
          const rtdPlayback = getSessionLogRuntime();
          writeSessionLog({
            userId: deps.userId,
            attemptId: rtdPlayback.attemptId,
            eventType: 'tts_playback_start',
            eventData: gatherParallelStreamingTtsPlaybackTelemetry({
              ttsPlaybackActiveImmediatelyPrior,
              afterRecording: afterRecordingTelemetry,
              parallelStreamContinuation,
              charCount: stripControlTokens(spokenForTts).trim().length,
              momentNumber: deps.currentInterviewMomentRef.current,
              scenarioNumber: deps.currentScenarioRef.current,
              prefetchedMpeg: !!(prefetchedBuf?.byteLength),
              htmlAudioVolume: getActiveWebHtmlAudioVolumeForTelemetry(),
            }),
            platform: rtdPlayback.platform,
          });
        } else {
          deps.ttsLineInFlightRef.current = true;
        }
        try {
          await speakWithElevenLabs(spokenForTts, undefined, {
            skipStopElevenLabsPlaybackBeforeStart: true,
            skipWebPlaybackPriming: parallelStreamContinuation,
            skipSilentWebPlaybackReprime: afterRecordingTelemetry || parallelStreamContinuation,
            skipMicPreInitDuringPlayback: true,
            chainHtmlAudioPlayback: true,
            telemetry: { source: 'turn' },
            preInitTriggerDuring: 'tts_playback',
            skipPcmStream: true,
            prefetchedMpegArrayBuffer: prefetchedBuf?.byteLength ? prefetchedBuf : undefined,
            onPlaybackStarted: () => {
              if (
                Platform.OS === 'web' &&
                (deps.webTtsTabInterruptPendingReplayRef.current ||
                  deps.parallelStreamingTtsRef.current.cancelRequested ||
                  (typeof document !== 'undefined' && document.visibilityState === 'hidden'))
              ) {
                return;
              }
              deps.setVoiceState('speaking');
              params.textToParallelStream.spokenStarted = true;
              deps.recordInterviewAssistantDeliveryForMetaExemptionRef.current(
                stripControlTokens(spokenForTts).trim(),
              );
              if (deps.referenceCardShouldUpdateOnPlaybackStart(spokenForTts)) {
                const s1OpeningPending =
                  isActiveScenarioAConstructProbeTurn(
                    deps.currentScenarioRef.current,
                    deps.currentInterviewMomentRef.current,
                  ) &&
                  !deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current.situation_1;
                const skipModalForPrematureS1FollowUp =
                  s1OpeningPending &&
                  !deps.scenarioAContemptProbeAskedRef.current &&
                  (isShowScenarioCardFollowUpProbeSentence(spokenForTts) ||
                    /\b(if you were ryan|you were ryan)\b/i.test(spokenForTts));
                if (!skipModalForPrematureS1FollowUp) {
                  const cleanedSpoken = stripControlTokens(spokenForTts).trim();
                  if (
                    isActiveScenarioAConstructProbeTurn(
                      deps.currentScenarioRef.current,
                      deps.currentInterviewMomentRef.current,
                    )
                  ) {
                    if (
                      looksLikeScenarioARepairQuestion(cleanedSpoken) ||
                      looksLikeScenarioARepairStreamFragment(cleanedSpoken)
                    ) {
                      deps.scenarioARepairQuestionAskedRef.current = true;
                    }
                    const s1Delivery = {
                      contemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
                      repairQuestionAsked: deps.scenarioARepairQuestionAskedRef.current,
                    };
                    const exact = resolveSituation1ExactModalPrompt(
                      params.messagesToUse.map((m) => ({
                        role: m.role,
                        content: stripControlTokens(m.content ?? '').trim(),
                      })),
                      isScenarioANonScriptedModalParaphrase(cleanedSpoken) ? null : cleanedSpoken,
                      s1Delivery,
                    );
                    deps.setReferenceCardPrompt(exact);
                    if (deps.lastQuestionTextRef) {
                      deps.lastQuestionTextRef.current = exact;
                    }
                  } else if (
                    isActiveScenarioBConstructProbeTurn(
                      deps.currentScenarioRef.current,
                      deps.currentInterviewMomentRef.current,
                    ) &&
                    deps.committedScenarioRef?.current?.label !== 'Situation 3'
                  ) {
                    if (looksLikeScenarioBRepairAsJamesQuestion(cleanedSpoken)) {
                      deps.s2RepairProbeDeliveredRef.current = true;
                    }
                    const transcriptForModal = params.messagesToUse.map((m) => ({
                      role: m.role,
                      content: stripControlTokens(m.content ?? '').trim(),
                    }));
                    const s2Delivery = {
                      jamesDifferentlyAsked: transcriptForModal.some(
                        (m) =>
                          m.role === 'assistant' &&
                          looksLikeScenarioBJamesDifferentlyQuestion(m.content ?? ''),
                      ),
                      repairQuestionAsked: deps.s2RepairProbeDeliveredRef.current,
                    };
                    const exact = resolveSituation2ExactModalPrompt(
                      transcriptForModal,
                      cleanedSpoken,
                      s2Delivery,
                    );
                    deps.setReferenceCardPrompt(exact);
                    if (deps.lastQuestionTextRef) {
                      deps.lastQuestionTextRef.current = exact;
                    }
                  } else if (
                    isActiveScenarioCConstructProbeTurn(
                      deps.currentScenarioRef.current,
                      deps.currentInterviewMomentRef.current,
                    )
                  ) {
                    const transcriptForModal = params.messagesToUse.map((m) => ({
                      role: m.role,
                      content: stripControlTokens(m.content ?? '').trim(),
                    }));
                    applySituation3ExactModalPrompt(
                      deps,
                      transcriptForModal,
                      cleanedSpoken,
                      readSituation3DeliveryState(transcriptForModal),
                    );
                  } else {
                    const modalQ = getLastSubstantiveScenarioModalQuestion([
                      { role: 'assistant', content: cleanedSpoken },
                    ]);
                    if (modalQ) {
                      deps.setReferenceCardPrompt(modalQ);
                    }
                    deps.applyReferenceCardFromAssistantSpeechRef.current(spokenForTts);
                  }
                }
              }
              if (
                deps.currentInterviewMomentRef.current === 2 &&
                deps.currentScenarioRef.current === 2 &&
                looksLikeScenarioBRepairAsJamesQuestion(spokenForTts)
              ) {
                deps.s2RepairProbeDeliveredRef.current = true;
              }
              if (
                deps.currentInterviewMomentRef.current === 3 &&
                deps.currentScenarioRef.current === 3 &&
                isScenarioCRepairAssistantPrompt(stripControlTokens(spokenForTts).trim())
              ) {
                markS3RepairProbeTtsDelivered(deps);
              }
              if (
                deps.currentInterviewMomentRef.current === 5 &&
                looksLikeMoment5ResolutionFollowUpPrompt(spokenForTts)
              ) {
                markMoment5ResolutionFollowUpTtsDelivered(deps);
              }
              if (!state.firstSentenceLogged && deps.userId) {
                state.firstSentenceLogged = true;
                const rtd = getSessionLogRuntime();
                const cleanedForLog = stripControlTokens(spokenForTts).trim();
                const s1RepairDelivery =
                  isActiveScenarioAConstructProbeTurn(
                    deps.currentScenarioRef.current,
                    deps.currentInterviewMomentRef.current,
                  ) &&
                  (looksLikeScenarioARepairQuestion(cleanedForLog) ||
                    looksLikeScenarioARepairStreamFragment(cleanedForLog));
                const questionTextForLog = s1RepairDelivery
                  ? coerceScenarioARepairQuestionForTts(cleanedForLog).slice(0, 2000)
                  : cleanedForLog.slice(0, 2000);
                writeSessionLog({
                  userId: deps.userId,
                  attemptId: rtd.attemptId,
                  eventType: 'question_delivered',
                  eventData: {
                    moment_number: deps.currentInterviewMomentRef.current,
                    scenario_number: deps.currentScenarioRef.current,
                    question_text: questionTextForLog,
                    delivered_at: new Date().toISOString(),
                    tts_pipeline: 'parallel_streaming',
                    ...(s1RepairDelivery ? { s1_repair_question: true } : {}),
                  },
                  platform: rtd.platform,
                });
              }
            },
          });
          if (deps.userId) {
            const rtdComplete = getSessionLogRuntime();
            markLastAudioSessionEventType('tts_playback_complete');
            writeSessionLog({
              userId: deps.userId,
              attemptId: rtdComplete.attemptId,
              eventType: 'tts_playback_complete',
              eventData: {
                telemetry_source: 'turn',
                tts_pipeline: 'parallel_streaming',
                html_audio_volume: getActiveWebHtmlAudioVolumeForTelemetry(),
              },
              durationMs: Date.now() - parallelTtsStartMs,
              platform: rtdComplete.platform,
            });
          }
          if (
            !deps.webTtsTabInterruptPendingReplayRef.current &&
            !deps.parallelStreamingTtsRef.current.cancelRequested
          ) {
            const chunk = stripControlTokens(spokenForTts).trim();
            if (chunk.length > 0) {
              const prev = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
              deps.parallelStreamingTtsRef.current.spokenCompleteText = prev
                ? `${prev} ${chunk}`.trim()
                : chunk;
            }
            if (closingSpeakLooksFinal) {
              markInterviewClosingTtsDelivered(closingTtsSessionKey, spokenForTts);
              state.interviewClosingSpokenThisStream = true;
              params.textToParallelStream.closingSpoken = true;
            }
          } else if (closingSpeakLooksFinal) {
            releaseInterviewClosingSpeak(closingTtsSessionKey);
          }
        } finally {
          if (!deps.webTtsTabInterruptPendingReplayRef.current) {
            const inFlight = (deps.webTtsUtteranceInFlightRef.current ?? '').trim();
            const scenarioHandoffHtmlSpeakActive =
              inFlight.length >= 12 &&
              looksLikeScenarioHandoffOrVignetteBundle(inFlight) &&
              isWebInterviewPlaybackSurfaceActive();
            if (!scenarioHandoffHtmlSpeakActive) {
              deps.ttsLineInFlightRef.current = false;
            }
            /** Keep session TTS active between parallel-stream chunks (avoids mic pre-init / route churn). */
            if (deps.userId && !deps.parallelStreamingTtsRef.current.active) {
              setTtsPlaybackActive(false);
            }
          }
        }
      } catch (err) {
        if (closingSpeakLooksFinal) {
          releaseInterviewClosingSpeak(closingTtsSessionKey);
        }
      }
    });
  };
}
