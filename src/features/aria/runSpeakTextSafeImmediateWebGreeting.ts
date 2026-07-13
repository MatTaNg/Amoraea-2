import type { MutableRefObject } from 'react';

import { normalizeTtsTextForConsecutiveDedup, stripControlTokens } from '@features/aria/interviewControlTokens';
import { looksLikeScenarioAContemptProbeQuestion } from '@features/aria/scenarioAContemptProbeLogic';
import type { SpeakTextSafeDeps, SpeakTextSafeOptions } from '@features/aria/speakTextSafeDeps';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import {
  consumeTtsBufferCompleteBeforePlaybackFlag,
  consumeTtsPlaybackStrategyForNextPlayback,
  prepareTtsPlaybackTelemetryState,
} from '@features/aria/telemetry/ttsBufferTelemetry';
import { prepareInterviewTtsPlayback } from '@features/aria/utils/audioModeHelpers';
import {
  ensureWebHtmlAudioElementMaxVolume,
  waitForWebHtmlAudioElementReady,
} from '@features/aria/utils/webInterviewHtmlAudioVolume';
import { isWebInterviewMidUtteranceTabResumeActive } from '@features/aria/utils/webInterviewHtmlAudioTabResume';
import { ensureWebInterviewTtsOutputVolumePrimed } from '@features/aria/utils/webInterviewTtsOutputVolume';
import { isPreAuthorizedAudioPendingForNextTts } from '@features/aria/utils/webPreAuthorizedTtsAudio';
import { waitForPrefetchedGreetingPlaybackEnd } from '@features/aria/utils/webInterviewGreetingAudio';
import { finalizeInterviewMicAmbientOnTtsEnd } from '@features/aria/utils/webInterviewMicPreInit';
import { readWebTtsGestureContextTelemetry } from '@features/aria/speakTextSafeWebGestureGate';
import { gatherTtsPlaybackTelemetry } from '@utilities/sessionLogging/sessionAudioTelemetry';
import {
  getSessionLogRuntime,
  markLastAudioSessionEventType,
  setTtsPlaybackActive,
} from '@utilities/sessionLogging';
import { writeAudioSessionLog } from '@utilities/sessionLogging/audioSessionLogEnvelope';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';

export type SpeakTextSafeTtsTriggerSource =
  | 'gesture_handler'
  | 'effect'
  | 'callback'
  | 'timeout'
  | 'preauthorized_element';

export function resolveImmediateWebGreetingTtsTriggerSource(
  ttsTriggerSource: SpeakTextSafeTtsTriggerSource,
): SpeakTextSafeTtsTriggerSource {
  return isPreAuthorizedAudioPendingForNextTts() ? 'preauthorized_element' : ttsTriggerSource;
}

export function markSpeakTextSafeSuccessfulDelivery(args: {
  text: string;
  silent: boolean;
  lastSuccessfulTtsTextNormalizedRef: MutableRefObject<string | null>;
  lastSuccessfulTtsDeliveredPreviewRef: MutableRefObject<string>;
  scenarioAContemptProbeTtsDeliveredSessionRef: MutableRefObject<boolean>;
  scenarioAContemptProbePlaybackConfirmedRef: MutableRefObject<boolean>;
}): void {
  if (args.silent) return;
  const nOk = normalizeTtsTextForConsecutiveDedup(args.text);
  if (nOk.length > 0) {
    args.lastSuccessfulTtsTextNormalizedRef.current = nOk;
    args.lastSuccessfulTtsDeliveredPreviewRef.current = stripControlTokens(args.text).trim().slice(0, 100);
  }
  if (looksLikeScenarioAContemptProbeQuestion(stripControlTokens(args.text).trim())) {
    args.scenarioAContemptProbeTtsDeliveredSessionRef.current = true;
    args.scenarioAContemptProbePlaybackConfirmedRef.current = true;
  }
}

export async function playImmediateWebGreetingHtmlAudioElement(args: {
  element: HTMLAudioElement;
  greetingAlreadyAudible: boolean;
  onReferenceCard: () => void;
}): Promise<void> {
  const el = args.element;
  const elementIsActivelyPlaying =
    !el.ended &&
    ((!el.paused && el.currentTime > 0) ||
      (!el.paused && el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA));

  if (args.greetingAlreadyAudible && elementIsActivelyPlaying) {
    await waitForPrefetchedGreetingPlaybackEnd(el);
    finalizeInterviewMicAmbientOnTtsEnd();
    args.onReferenceCard();
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const el = args.element;
    const done = () => {
      finalizeInterviewMicAmbientOnTtsEnd();
      resolve();
    };
    el.addEventListener('ended', done, { once: true });
    el.addEventListener('error', () => reject(new Error('greeting_audio_error')), { once: true });
    if (el.ended) {
      done();
      return;
    }
    void (async () => {
      try {
        const alreadyAudible = !el.paused && el.currentTime > 0;
        if (!alreadyAudible) {
          if (el.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
            await el.play();
          } else {
            await waitForWebHtmlAudioElementReady(el);
            await el.play();
          }
        }
        args.onReferenceCard();
        if (el.ended) done();
      } catch {
        reject(new Error('greeting_audio_error'));
      }
    })();
  });
}

function resolveImmediateTelemetrySource(
  telemetrySourceOpt: TtsTelemetrySource | undefined,
  interviewSpeechRole: SpeakTextSafeOptions['interviewSpeechRole'],
): TtsTelemetrySource {
  return telemetrySourceOpt ?? (interviewSpeechRole === 'assistant_response' ? 'turn' : 'other');
}

/**
 * Web-only path: play prefetched greeting audio from an HTMLAudioElement created in the user-gesture stack.
 * Returns true when this path handled the speak call (caller should return).
 */
export async function runSpeakTextSafeImmediateWebGreetingPlayback(
  deps: Pick<
    SpeakTextSafeDeps,
    | 'setVoiceState'
    | 'setLastTtsCompletionCallbackMs'
    | 'lastQuestionTextRef'
    | 'lastSuccessfulTtsTextNormalizedRef'
    | 'lastSuccessfulTtsDeliveredPreviewRef'
    | 'scenarioAContemptProbeTtsDeliveredSessionRef'
    | 'scenarioAContemptProbePlaybackConfirmedRef'
    | 'ttsLineInFlightRef'
    | 'applyReferenceCardFromAssistantSpeechRef'
    | 'scheduleWebMicPreInitRefreshAfterTtsCompletes'
  >,
  args: {
    userId: string;
    text: string;
    options: SpeakTextSafeOptions;
    mobileWebTapToBeginDone: boolean;
    immediateWebPlaybackElement: HTMLAudioElement;
  },
): Promise<boolean> {
  const { userId, text, options, mobileWebTapToBeginDone, immediateWebPlaybackElement } = args;
  const {
    silent = false,
    interviewSpeechRole,
    telemetrySource: telemetrySourceOpt,
    skipLastQuestionRef = false,
    ttsTriggerSource = 'callback',
    greetingAlreadyAudible = false,
  } = options;

  if (!skipLastQuestionRef) {
    deps.lastQuestionTextRef.current = text;
  }

  const telemetrySourceImmediate = resolveImmediateTelemetrySource(telemetrySourceOpt, interviewSpeechRole);
  const effectiveImmediateTtsTrigger = resolveImmediateWebGreetingTtsTriggerSource(ttsTriggerSource);

  prepareTtsPlaybackTelemetryState({
    charCount: stripControlTokens(text).trim().length,
    telemetryIsGreeting: telemetrySourceImmediate === 'greeting',
    isWeb: true,
  });

  if (!greetingAlreadyAudible) {
    await prepareInterviewTtsPlayback('greeting_immediate_element');
  } else if (!isWebInterviewMidUtteranceTabResumeActive()) {
    ensureWebInterviewTtsOutputVolumePrimed();
    ensureWebHtmlAudioElementMaxVolume(immediateWebPlaybackElement);
  }

  const rtImmediate = getSessionLogRuntime();
  const ttsPlaybackActiveImmediatelyPriorIm = rtImmediate.ttsPlaybackActive;
  setTtsPlaybackActive(true);
  deps.ttsLineInFlightRef.current = true;

  const { gestureContextActive, webTtsGestureErrorPrevented } = readWebTtsGestureContextTelemetry({
    isWeb: true,
    mobileWebTapToBeginDone,
  });

  writeSessionLog({
    userId,
    attemptId: rtImmediate.attemptId,
    eventType: 'tts_playback_start',
    eventData: {
      ...gatherTtsPlaybackTelemetry({ ttsPlaybackActiveImmediatelyPrior: ttsPlaybackActiveImmediatelyPriorIm }),
      telemetry_source: telemetrySourceImmediate,
      tts_buffer_complete_before_playback: greetingAlreadyAudible
        ? true
        : consumeTtsBufferCompleteBeforePlaybackFlag(),
      playback_strategy: greetingAlreadyAudible
        ? 'buffered_complete'
        : consumeTtsPlaybackStrategyForNextPlayback(),
      gesture_context_active: gestureContextActive,
      web_tts_gesture_error_prevented: webTtsGestureErrorPrevented,
      tts_trigger_source: effectiveImmediateTtsTrigger,
      ...(greetingAlreadyAudible ? { greeting_sync_play_already_audible: true } : {}),
    },
    platform: rtImmediate.platform,
  });

  const ttsStart = Date.now();
  let playbackSucceeded = false;
  try {
    deps.setVoiceState('speaking');
    await playImmediateWebGreetingHtmlAudioElement({
      element: immediateWebPlaybackElement,
      greetingAlreadyAudible,
      onReferenceCard: () => deps.applyReferenceCardFromAssistantSpeechRef.current(text),
    });
    playbackSucceeded = true;
    markSpeakTextSafeSuccessfulDelivery({
      text,
      silent,
      lastSuccessfulTtsTextNormalizedRef: deps.lastSuccessfulTtsTextNormalizedRef,
      lastSuccessfulTtsDeliveredPreviewRef: deps.lastSuccessfulTtsDeliveredPreviewRef,
      scenarioAContemptProbeTtsDeliveredSessionRef: deps.scenarioAContemptProbeTtsDeliveredSessionRef,
      scenarioAContemptProbePlaybackConfirmedRef: deps.scenarioAContemptProbePlaybackConfirmedRef,
    });
    const rtp = getSessionLogRuntime();
    markLastAudioSessionEventType('tts_playback_complete');
    writeSessionLog({
      userId,
      attemptId: rtp.attemptId,
      eventType: 'tts_playback_complete',
      eventData: { telemetry_source: telemetrySourceImmediate },
      durationMs: Date.now() - ttsStart,
      platform: rtp.platform,
    });
  } catch {
    return false;
  } finally {
    setTtsPlaybackActive(false);
    deps.ttsLineInFlightRef.current = false;
    deps.setVoiceState('idle');
    const ttsResolvedAt = Date.now();
    deps.setLastTtsCompletionCallbackMs(ttsResolvedAt);
    const r = getSessionLogRuntime();
    markLastAudioSessionEventType('audio_session_deactivation_confirmed');
    writeAudioSessionLog({
      userId,
      attemptId: r.attemptId,
      eventType: 'audio_session_deactivation_confirmed',
      eventData: {
        deactivation_succeeded: true,
        deactivation_timestamp: ttsResolvedAt,
        time_since_tts_completion_ms: 0,
        recording_session_active: r.recordingSessionActive,
      },
      platform: r.platform,
    });
    deps.scheduleWebMicPreInitRefreshAfterTtsCompletes();
  }

  return playbackSucceeded;
}
