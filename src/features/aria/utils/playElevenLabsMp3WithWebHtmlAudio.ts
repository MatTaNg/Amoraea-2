import { Platform } from 'react-native';

import { logTtsAutoplayPlayOutcome, type TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import {
  finalizeInterviewMicAmbientOnTtsEnd,
  type PreInitTriggerDuring,
} from '@features/aria/utils/webInterviewMicPreInit';
import { takePreAuthorizedAudioElementForTts } from '@features/aria/utils/webPreAuthorizedTtsAudio';
import type { ElevenLabsSpeakOptions } from './elevenLabsSpeakTypes';
import { speakWithWebSpeechSynthesis } from './interviewWebSpeechSynthesis';
import { webSpeechShouldDeferToUserGesture } from './webSpeechDeferPolicy';
import {
  applyTabStashedHtmlAudioVolume,
  getTabHtmlAudioResumeSnapshot,
  hasWebInterviewHtmlAudioTabResumePending,
  isHtmlAudioPausedForTabResume,
} from './webInterviewHtmlAudioTabResume';
import { clearHtmlAudioTabResumeState } from './webInterviewHtmlAudioTabRestoreOrchestration';
import {
  assignAbortActiveWebHtmlAudioPlayback,
  assignActiveWebHtmlAudioPlaybackHandoff,
  clearAbortActiveWebHtmlAudioPlaybackIfMatches,
  clearActiveWebHtmlAudioPlaybackHandoffIfObjectUrl,
} from './webInterviewHtmlAudioPlaybackHooks';
import {
  ensureWebHtmlAudioElementMaxVolume,
  waitForWebHtmlAudioElementReady,
} from './webInterviewHtmlAudioVolume';
import {
  ensureSharedHtmlAudioElementForInterviewTts,
  getSharedHtmlAudioForMobileTts,
  hasSharedHtmlAudioForInterviewTts,
} from './webInterviewSharedHtmlAudio';
import { ensureSharedWebAudioContextResumedForPlayback } from './webInterviewWebAudioContext';
import {
  assignActiveWebHtmlAudio,
  assignActiveWebHtmlAudioObjectUrl,
  clearActiveWebHtmlAudio,
  clearActiveWebHtmlAudioObjectUrlIfMatches,
} from './webInterviewActiveHtmlAudio';
import { createWebInterviewHtmlAudioSafetyTimeoutScheduler } from './webInterviewHtmlAudioSafetyTimeout';
import { assignPendingWebGestureBlobUrl } from './webInterviewPendingGestureBlob';
import { kickInterviewMicPreInitForTtsPlayback } from './webInterviewMicPreInitKick';
import { isWebAudioAutoplayBlockedError } from './webTtsAutoplayPolicy';
import {
  WebInterviewTtsTabHiddenAbortError,
  WebTtsRequiresUserGestureError,
} from './webTtsGestureErrors';

export type PlayElevenLabsWebHtmlAudioParams = {
  arrayBuffer: ArrayBuffer;
  spokenText: string;
  telemetrySource: TtsTelemetrySource;
  preInitTriggerDuring: PreInitTriggerDuring;
  playbackRateMultiplier: number;
  preferTabResumableHtmlAudio: boolean;
  onPlaybackStarted?: () => void;
  options?: Pick<
    ElevenLabsSpeakOptions,
    'chainHtmlAudioPlayback' | 'skipWebPlaybackPriming' | 'skipMicPreInitDuringPlayback' | 'prefetchedMpegArrayBuffer'
  >;
};

type PreparedWebHtmlAudio = {
  htmlAudio: HTMLAudioElement;
  url: string;
  preAuthorizedEl: HTMLAudioElement | null;
  ownsObjectUrl: boolean;
};

function revokeObjectUrlIfOwned(url: string, ownsObjectUrl: boolean): void {
  if (!ownsObjectUrl) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
}

function prepareElevenLabsWebHtmlAudioElement(
  arrayBuffer: ArrayBuffer,
  playbackRateMultiplier: number,
  options: PlayElevenLabsWebHtmlAudioParams['options']
): PreparedWebHtmlAudio | null {
  const blob = new Blob([arrayBuffer.slice(0)], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  const AudioCtor =
    typeof (globalThis as unknown as { Audio?: new (src?: string) => HTMLAudioElement }).Audio !== 'undefined'
      ? (globalThis as unknown as { Audio: new (src?: string) => HTMLAudioElement }).Audio
      : undefined;
  if (!AudioCtor) {
    URL.revokeObjectURL(url);
    return null;
  }

  const preAuthorizedEl = takePreAuthorizedAudioElementForTts();
  const chainHtmlAudioPlayback = options?.chainHtmlAudioPlayback === true;
  const chainedContinuation = chainHtmlAudioPlayback && options?.skipWebPlaybackPriming === true;
  const useSharedPrimed =
    !preAuthorizedEl &&
    !chainHtmlAudioPlayback &&
    webSpeechShouldDeferToUserGesture() &&
    hasSharedHtmlAudioForInterviewTts();

  let htmlAudio: HTMLAudioElement;
  if (chainHtmlAudioPlayback) {
    const shared = ensureSharedHtmlAudioElementForInterviewTts();
    if (!shared) {
      URL.revokeObjectURL(url);
      return null;
    }
    htmlAudio = shared;
    try {
      if (!htmlAudio.paused && !htmlAudio.ended) {
        htmlAudio.pause();
      }
      if (!chainedContinuation) {
        htmlAudio.currentTime = 0;
      }
    } catch {
      /* ignore */
    }
    htmlAudio.muted = false;
    htmlAudio.src = url;
    ensureWebHtmlAudioElementMaxVolume(htmlAudio);
    htmlAudio.playbackRate = playbackRateMultiplier;
  } else if (preAuthorizedEl) {
    htmlAudio = preAuthorizedEl;
    try {
      htmlAudio.pause();
      htmlAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
    htmlAudio.src = url;
    ensureWebHtmlAudioElementMaxVolume(htmlAudio);
    htmlAudio.playbackRate = playbackRateMultiplier;
  } else if (useSharedPrimed) {
    const sharedPrimed = getSharedHtmlAudioForMobileTts();
    if (!sharedPrimed) {
      URL.revokeObjectURL(url);
      return null;
    }
    htmlAudio = sharedPrimed;
    htmlAudio.src = url;
    ensureWebHtmlAudioElementMaxVolume(htmlAudio);
    htmlAudio.playbackRate = playbackRateMultiplier;
  } else {
    const audio = new AudioCtor(url);
    htmlAudio = audio as HTMLAudioElement;
    htmlAudio.setAttribute('playsinline', '');
    if ('playsInline' in htmlAudio) {
      (htmlAudio as { playsInline: boolean }).playsInline = true;
    }
    htmlAudio.preload = 'auto';
    ensureWebHtmlAudioElementMaxVolume(htmlAudio);
    htmlAudio.playbackRate = playbackRateMultiplier;
  }

  return { htmlAudio, url, preAuthorizedEl, ownsObjectUrl: true };
}

/**
 * ElevenLabs MP3 via HTML `<audio>` (tab-resumable path, mobile web, autoplay-blocked fallbacks).
 */
export async function playElevenLabsMp3WithWebHtmlAudio(
  params: PlayElevenLabsWebHtmlAudioParams
): Promise<void> {
  if (Platform.OS !== 'web') {
    throw new Error('playElevenLabsMp3WithWebHtmlAudio: web only');
  }

  const prepared = prepareElevenLabsWebHtmlAudioElement(
    params.arrayBuffer,
    params.playbackRateMultiplier,
    params.options
  );
  if (!prepared) {
    throw new Error('web_html_audio_prepare_failed');
  }

  const { htmlAudio, url, preAuthorizedEl } = prepared;
  assignActiveWebHtmlAudio(htmlAudio);
  assignActiveWebHtmlAudioObjectUrl(url);

  /** HTML `<audio>` does not require a running shared AudioContext — only Web Audio decode does. */
  if (
    !params.preferTabResumableHtmlAudio &&
    !(await ensureSharedWebAudioContextResumedForPlayback(params.telemetrySource))
  ) {
    clearActiveWebHtmlAudio();
    revokeObjectUrlIfOwned(url, prepared.ownsObjectUrl);
    throw new Error('web_html_audio_context_resume_failed');
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (action: 'resolve' | 'reject', err?: Error) => {
      if (settled) return;
      settled = true;
      clearAbortActiveWebHtmlAudioPlaybackIfMatches(abortThisPlayback);
      clearActiveWebHtmlAudioPlaybackHandoffIfObjectUrl(url);
      safetyTimeout.clearSafetyTimeout();
      if (action === 'resolve') resolve();
      else reject(err ?? new Error('Audio playback failed'));
    };
    const safetyTimeout = createWebInterviewHtmlAudioSafetyTimeoutScheduler({
      htmlAudio,
      objectUrl: url,
      telemetrySource: params.telemetrySource,
      isSettled: () => settled,
      onSafetyTimeoutResolve: () => finish('resolve'),
      clearTabResumeState: clearHtmlAudioTabResumeState,
    });
    assignActiveWebHtmlAudioPlaybackHandoff({
      clearSafetyTimeout: safetyTimeout.clearSafetyTimeout,
      completePlayback: () => finish('resolve'),
      objectUrl: url,
    });
    const abortThisPlayback = () => {
      try {
        if (!htmlAudio.ended) htmlAudio.pause();
      } catch {
        /* ignore */
      }
      finish('reject', new WebInterviewTtsTabHiddenAbortError());
    };
    assignAbortActiveWebHtmlAudioPlayback(abortThisPlayback);
    safetyTimeout.attachMetadataListeners();
    htmlAudio.onended = () => {
      finalizeInterviewMicAmbientOnTtsEnd();
      clearActiveWebHtmlAudio();
      clearActiveWebHtmlAudioObjectUrlIfMatches(url);
      clearHtmlAudioTabResumeState();
      revokeObjectUrlIfOwned(url, prepared.ownsObjectUrl);
      finish('resolve');
    };
    htmlAudio.onerror = () => {
      clearActiveWebHtmlAudio();
      clearActiveWebHtmlAudioObjectUrlIfMatches(url);
      revokeObjectUrlIfOwned(url, prepared.ownsObjectUrl);
      finish('reject', new Error('Audio playback failed'));
    };
    void (async () => {
      try {
        const tabResumeSameElement =
          getTabHtmlAudioResumeSnapshot()?.element === htmlAudio &&
          (isHtmlAudioPausedForTabResume() || hasWebInterviewHtmlAudioTabResumePending());
        if (tabResumeSameElement && !htmlAudio.paused && !htmlAudio.ended) {
          applyTabStashedHtmlAudioVolume(htmlAudio);
          params.onPlaybackStarted?.();
          logTtsAutoplayPlayOutcome({
            pipeline: 'elevenlabs_web_html_audio',
            outcome: 'play_ok',
            telemetrySource: params.telemetrySource,
            html_audio_volume: htmlAudio.volume,
            errorMessagePreview: `tab_resume_already_audible_at_s=${htmlAudio.currentTime}`,
          });
          return;
        }
        await waitForWebHtmlAudioElementReady(htmlAudio, 8000, {
          skipExplicitLoad: params.options?.skipWebPlaybackPriming,
          preservePlaybackPosition: tabResumeSameElement,
        });
        await htmlAudio.play();
        params.onPlaybackStarted?.();
        if (!params.options?.skipWebPlaybackPriming && !params.options?.skipMicPreInitDuringPlayback) {
          void kickInterviewMicPreInitForTtsPlayback(params.preInitTriggerDuring);
        }
        logTtsAutoplayPlayOutcome({
          pipeline: 'elevenlabs_web_html_audio',
          outcome: 'play_ok',
          telemetrySource: params.telemetrySource,
          html_audio_volume: htmlAudio.volume,
        });
      } catch (playErr: unknown) {
        if (isWebAudioAutoplayBlockedError(playErr)) {
          assignPendingWebGestureBlobUrl(url);
          assignActiveWebHtmlAudio(htmlAudio);
          logTtsAutoplayPlayOutcome({
            pipeline: 'elevenlabs_web_html_audio',
            outcome: 'play_blocked_autoplay',
            telemetrySource: params.telemetrySource,
          });
          if (
            (params.telemetrySource === 'turn' || params.telemetrySource === 'replay') &&
            (preAuthorizedEl || (params.options?.prefetchedMpegArrayBuffer?.byteLength ?? 0) > 0)
          ) {
            try {
              ensureWebHtmlAudioElementMaxVolume(htmlAudio);
              await waitForWebHtmlAudioElementReady(htmlAudio, 8000, {
                skipExplicitLoad: params.options?.skipWebPlaybackPriming,
              });
              await htmlAudio.play();
              params.onPlaybackStarted?.();
              logTtsAutoplayPlayOutcome({
                pipeline: 'elevenlabs_web_html_audio',
                outcome: 'play_ok',
                telemetrySource: params.telemetrySource,
                html_audio_volume: htmlAudio.volume,
                errorMessagePreview: 'autoplay_retry_play_ok_await_ended',
              });
              /** Do not finish here — same as the primary play path: wait for onended/safety. */
              return;
            } catch {
              /* fall through to web speech */
            }
          }
          clearActiveWebHtmlAudio();
          try {
            const webRes = await speakWithWebSpeechSynthesis(
              params.spokenText,
              params.onPlaybackStarted,
              params.preInitTriggerDuring
            );
            if (webRes.ok) {
              try {
                htmlAudio.pause();
              } catch {
                /* ignore */
              }
              revokeObjectUrlIfOwned(url, prepared.ownsObjectUrl);
              assignPendingWebGestureBlobUrl(null);
              logTtsAutoplayPlayOutcome({
                pipeline: 'web_speech_after_mp3_blocked',
                outcome: 'play_ok',
                telemetrySource: params.telemetrySource,
              });
              finish('resolve');
              return;
            }
          } catch {
            /* fall through to gesture error */
          }
          finish('reject', new WebTtsRequiresUserGestureError(params.spokenText));
          return;
        }
        const err = playErr instanceof Error ? playErr : new Error(String(playErr));
        logTtsAutoplayPlayOutcome({
          pipeline: 'elevenlabs_web_html_audio',
          outcome: 'play_error',
          telemetrySource: params.telemetrySource,
          errorName: err.name,
          errorMessagePreview: err.message?.slice(0, 120),
        });
        finish('reject', err);
      }
    })();
  });
}
