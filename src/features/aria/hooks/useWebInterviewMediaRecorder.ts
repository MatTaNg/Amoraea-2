import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import {
  getAudioMaxRecordingDurationMs,
  getAudioMinRecordingDurationMs,
} from '@features/aria/config/audioInterviewConfig';
import { logWebMicRecordingStopped } from '@features/aria/telemetry/tsAutoplayTelemetry';
import { remoteLog } from '@utilities/remoteLog';
import {
  getLastPreInitTriggerDuring,
  rearmWebMicPreInitAfterRecordingStop,
  tryConsumeWebPreInitRecorder,
  replaceWebInterviewMicPreInitWithDefaultIdealDevice,
  getPreInitAudioInputDeviceId,
} from '@features/aria/utils/webInterviewMicPreInit';
import {
  buildWebMicGetUserMediaConstraints,
  isDefaultOrCommunicationsDeviceId,
} from '@features/aria/utils/webMicDeviceConstraints';
import {
  seedCachedWebMicTrackSettings,
  syncWebAudioRouteSessionEnvelopeFromCache,
} from '@utilities/sessionLogging/webMediaDeviceAudioRoute';

import type {
  AudioRecorderPermissionStatus,
  AudioRecorderSharedControls,
  UseAudioRecorderParams,
  WebRecordingTiming,
} from './audioRecorderTypes';
import { WEB_RECORDING_PREROLL_MS } from './audioRecorderTypes';

function isWebMicStreamLive(stream: MediaStream | null): boolean {
  if (!stream?.active) return false;
  const t = stream.getAudioTracks()[0];
  return !!t && t.readyState === 'live';
}

export type UseWebInterviewMediaRecorderParams = Pick<
  UseAudioRecorderParams,
  | 'onRecordingComplete'
  | 'onError'
  | 'onBeforeWebRecorderStop'
  | 'onRecordingEnginePrimed'
  | 'onRecordingTapIntent'
> &
  AudioRecorderSharedControls & {
    setPermissionStatus: React.Dispatch<React.SetStateAction<AudioRecorderPermissionStatus>>;
  };

export function useWebInterviewMediaRecorder(params: UseWebInterviewMediaRecorderParams) {
  const {
    onRecordingComplete,
    onError,
    onBeforeWebRecorderStop,
    onRecordingEnginePrimed,
    onRecordingTapIntent,
    setIsRecording,
    setInputMeterLevel,
    recordingCappedThisTurnRef,
    maxDurationTimerRef,
    clearMaxDurationTimer,
    sleep,
    setPermissionStatus,
  } = params;

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);
  const webMimeRef = useRef<string>('audio/webm');
  const webStreamRef = useRef<MediaStream | null>(null);
  const webAudioCtxRef = useRef<AudioContext | null>(null);
  const webAnalyserRef = useRef<AnalyserNode | null>(null);
  const webMeterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Web: rAF loop for live meter — started in the same synchronous turn as `MediaRecorder.start()`. */
  const webMeterRafRef = useRef<number | null>(null);
  /** Web: mic stream + AudioContext + analyser acquired before tap (TTS) — MediaRecorder is created on tap only. */
  const webMicPipelinePrimedRef = useRef(false);
  const webPrepareCompleteAtMsRef = useRef<number | null>(null);
  const webPrerollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastWebRecordingTimingRef = useRef<WebRecordingTiming | null>(null);
  /** Web: `MediaRecorder` constructed during TTS (inactive) — tap only calls `start(100)`. */
  const webMediaRecorderPreparedRef = useRef<MediaRecorder | null>(null);
  /** Web: last captured `getSettings().deviceId` from the active mic stream (for default-device fallback). */
  const lastWebMicDeviceIdRef = useRef<string | undefined>(undefined);
  /** Web: at most one `ideal: 'default'` fallback switch per interview session (see Amoraea `resetWebMicInputFallbackState`). */
  const webMicFallbackSwitchConsumedRef = useRef(false);

  const captureWebMicDeviceIdFromStream = useCallback((stream: MediaStream | null) => {
    const t = stream?.getAudioTracks?.()[0];
    const settings = t?.getSettings?.();
    if (settings) {
      seedCachedWebMicTrackSettings(settings);
    }
    const id = settings?.deviceId;
    lastWebMicDeviceIdRef.current = typeof id === 'string' && id.length > 0 ? id : lastWebMicDeviceIdRef.current;
  }, []);

  const clearWebPrerollTimer = useCallback(() => {
    if (webPrerollTimerRef.current != null) {
      clearTimeout(webPrerollTimerRef.current);
      webPrerollTimerRef.current = null;
    }
  }, []);

  const stopWebMeterLoop = useCallback(() => {
    if (webMeterRafRef.current != null) {
      cancelAnimationFrame(webMeterRafRef.current);
      webMeterRafRef.current = null;
    }
  }, []);

  const stopWebMetering = useCallback(() => {
    stopWebMeterLoop();
    if (webMeterIntervalRef.current != null) {
      clearInterval(webMeterIntervalRef.current);
      webMeterIntervalRef.current = null;
    }
    clearWebPrerollTimer();
    try {
      webAnalyserRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    webAnalyserRef.current = null;
    try {
      void webAudioCtxRef.current?.close();
    } catch {
      /* ignore */
    }
    webAudioCtxRef.current = null;
    webStreamRef.current?.getTracks().forEach((t) => t.stop());
    webStreamRef.current = null;
    webMicPipelinePrimedRef.current = false;
    webPrepareCompleteAtMsRef.current = null;
    webMediaRecorderPreparedRef.current = null;
    setInputMeterLevel(0);
  }, [clearWebPrerollTimer, stopWebMeterLoop]);
  const getSupportedMimeType = useCallback((): string | null => {
    if (typeof MediaRecorder === 'undefined') return null;
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    /** Prefer WebM/Opus whenever the browser supports it (including iOS Safari/Brave). MP4/AAC from mobile MediaRecorder can be undecodable by Web Audio + rejected by Whisper (400 invalid format); WebM is more reliable for Whisper + buffer analysis. */
    const isMobileWebKit = /iPhone|iPad|iPod/i.test(ua);
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    const supported = types.filter((t) => MediaRecorder.isTypeSupported(t));
    const chosen = supported[0] ?? null;
    return chosen;
  }, []);
  const ensureWebAudioAnalyserForStream = useCallback((stream: MediaStream) => {
    const Ctx =
      typeof window !== 'undefined' && window.AudioContext
        ? window.AudioContext
        : typeof window !== 'undefined' &&
            (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
          ? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          : null;
    if (!Ctx) return;
    const ctx = new Ctx();
    webAudioCtxRef.current = ctx;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.5;
    source.connect(analyser);
    webAnalyserRef.current = analyser;
    void ctx.resume().catch(() => {});
  }, []);

  const prepareWebRecordingSession = useCallback(async () => {}, []);

  const abandonPreparedWebRecording = useCallback(async () => {
    if (mediaRecorderRef.current?.state === 'recording') return;
  }, []);

  const startWebRecording = useCallback(
    async (opts?: { postAudioSessionDelayMs?: number; tapIntentAtMs?: number }) => {
      try {
        recordingCappedThisTurnRef.current = false;
        clearMaxDurationTimer();
        clearWebPrerollTimer();
        onRecordingTapIntent?.();
        const tapIntentAtMs = opts?.tapIntentAtMs ?? Date.now();

        const consumedResult = tryConsumeWebPreInitRecorder();
        const usedWebModulePreInit = consumedResult != null;

        let stream: MediaStream | null = webStreamRef.current;
        let modeCompleteAtMs = webPrepareCompleteAtMsRef.current ?? Date.now();
        let streamWasPrimedFromTts = false;
        let streamReactivated = false;
        let preInitFallbackReason: string | null = null;

        if (usedWebModulePreInit && consumedResult) {
          stream = consumedResult.stream;
          captureWebMicDeviceIdFromStream(stream);
          webStreamRef.current = stream;
          ensureWebAudioAnalyserForStream(stream);
          webMicPipelinePrimedRef.current = true;
          webPrepareCompleteAtMsRef.current = Date.now();
          modeCompleteAtMs = webPrepareCompleteAtMsRef.current;
          streamWasPrimedFromTts = true;
        } else {
          streamWasPrimedFromTts = !!(
            webMicPipelinePrimedRef.current &&
            stream &&
            webAnalyserRef.current
          );

          if (stream && !isWebMicStreamLive(stream)) {
            stopWebMetering();
            stream = null;
            streamWasPrimedFromTts = false;
            streamReactivated = true;
            preInitFallbackReason = 'stream_inactive_before_start';
          }

          if (!streamWasPrimedFromTts || !stream) {
            const constraints = await buildWebMicGetUserMediaConstraints();
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            captureWebMicDeviceIdFromStream(stream);
            webStreamRef.current = stream;
            webMicPipelinePrimedRef.current = true;
            ensureWebAudioAnalyserForStream(stream);
            webPrepareCompleteAtMsRef.current = Date.now();
            modeCompleteAtMs = webPrepareCompleteAtMsRef.current;
          }
        }

        /** Mic stream settings were just seeded — avoid enumerateDevices (Android speaker snap). */
        syncWebAudioRouteSessionEnvelopeFromCache();

        const delayMs =
          usedWebModulePreInit || streamWasPrimedFromTts
            ? 0
            : Math.max(0, opts?.postAudioSessionDelayMs ?? 500);
        await sleep(delayMs);

        const ctx = webAudioCtxRef.current;
        if (ctx?.state === 'suspended') {
          await ctx.resume().catch(() => {});
        }

        audioChunksRef.current = [];
        const mimeType = getSupportedMimeType();
        webMimeRef.current = mimeType ?? 'audio/webm';

        let mediaRecorder: MediaRecorder;
        let recorderPreInitialized = false;
        if (usedWebModulePreInit && consumedResult) {
          mediaRecorder = consumedResult.recorder;
          recorderPreInitialized = true;
        } else {
          const preparedMr = webMediaRecorderPreparedRef.current;
          const streamMatchesPrepared =
            preparedMr &&
            preparedMr.state === 'inactive' &&
            webStreamRef.current === stream;

          if (streamWasPrimedFromTts && streamMatchesPrepared && preparedMr) {
            webMediaRecorderPreparedRef.current = null;
            mediaRecorder = preparedMr;
            recorderPreInitialized = true;
          } else {
            webMediaRecorderPreparedRef.current = null;
            if (streamWasPrimedFromTts && !streamReactivated) {
              if (!preparedMr) {
                preInitFallbackReason = preInitFallbackReason ?? 'missing_prepared_mediarecorder';
              } else if (!streamMatchesPrepared) {
                preInitFallbackReason = preInitFallbackReason ?? 'prepared_mediarecorder_mismatch';
              }
            }
            mediaRecorder = mimeType
              ? new MediaRecorder(stream, { mimeType })
              : new MediaRecorder(stream);
          }
        }

        if (!recorderPreInitialized && preInitFallbackReason == null) {
          preInitFallbackReason = 'no_preinit_before_tap';
        }
        if (
          __DEV__ &&
          !recorderPreInitialized &&
          preInitFallbackReason != null &&
          preInitFallbackReason !== 'no_preinit_before_tap'
        ) {
          console.error('PRE_INIT_FAILED: recorder was not ready at recording start');
        }

        mediaRecorderRef.current = mediaRecorder;

        let firstChunkLogged = false;
        mediaRecorder.ondataavailable = (e) => {
          if (e.data?.size > 0) {
            audioChunksRef.current.push(e.data);
            if (!firstChunkLogged) {
              firstChunkLogged = true;
              const firstChunkReceivedMs = Date.now();
              const timing = lastWebRecordingTimingRef.current;
              if (timing) {
                timing.firstChunkReceivedMs = firstChunkReceivedMs;
                timing.chunkLatencyMs = firstChunkReceivedMs - timing.recorderStartCalledMs;
              }
            }
          }
        };

        mediaRecorder.onstop = async () => {
          stopWebMeterLoop();
          const timing = lastWebRecordingTimingRef.current;
          const recorderStopCalledMs = Date.now();
          if (timing) {
            timing.recorderStopCalledMs = recorderStopCalledMs;
          }
          const blob = new Blob(audioChunksRef.current, {
            type: webMimeRef.current,
          });
          const wallStart = timing?.mediaRecorderStartAtMs;
          const elapsedMs = wallStart != null ? Date.now() - wallStart : undefined;
          logWebMicRecordingStopped({
            blobBytes: blob.size,
            mime: webMimeRef.current,
            elapsedMs,
          });
          stopWebMetering();
          mediaRecorderRef.current = null;
          setIsRecording(false);
          await onRecordingComplete?.(blob, null, {
            peakMeteringDb: null,
            recordingCapped: recordingCappedThisTurnRef.current,
            webRecordingTiming: timing ?? undefined,
          });
          if (Platform.OS !== 'web') {
            rearmWebMicPreInitAfterRecordingStop().catch(() => {});
          }
          lastWebRecordingTimingRef.current = null;
          recordingCappedThisTurnRef.current = false;
        };

        const meterOnce = () => {
          const analyser = webAnalyserRef.current;
          if (!analyser) return;
          const data = new Uint8Array(analyser.fftSize);
          analyser.getByteTimeDomainData(data);
          let peak = 0;
          for (let i = 0; i < data.length; i++) {
            const v = (data[i] - 128) / 128;
            const a = Math.abs(v);
            if (a > peak) peak = a;
          }
          setInputMeterLevel(Math.min(1, peak * 2.2));
        };

        const runMeterLoop = () => {
          if (!webAnalyserRef.current || !mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
            webMeterRafRef.current = null;
            return;
          }
          try {
            meterOnce();
          } catch {
            /* ignore */
          }
          webMeterRafRef.current = requestAnimationFrame(runMeterLoop);
        };

        const recorderStartCalledMs = Date.now();
        lastWebRecordingTimingRef.current = {
          tapIntentAtMs,
          mediaRecorderStartAtMs: recorderStartCalledMs,
          recorderPreInitialized,
          recorderStartCalledMs,
          firstChunkReceivedMs: null,
          chunkLatencyMs: null,
          preInitFallbackReason,
          streamReactivated,
          preInitTriggeredDuring: getLastPreInitTriggerDuring(),
        };

        mediaRecorder.start(100);

        meterOnce();
        const firstMeterAt = Date.now();
        webMeterRafRef.current = requestAnimationFrame(runMeterLoop);

        setIsRecording(true);
        const recordingInitializedAtMs = Date.now();
        if (usedWebModulePreInit) {
          recordingStartTimeRef.current = recordingInitializedAtMs;
          onRecordingEnginePrimed?.({
            modeCompleteAtMs,
            recordingInitializedAtMs,
          });
        } else {
          const prerollEndWallMs = recordingInitializedAtMs + WEB_RECORDING_PREROLL_MS;
          recordingStartTimeRef.current = prerollEndWallMs;
          webPrerollTimerRef.current = setTimeout(() => {
            webPrerollTimerRef.current = null;
            if (mediaRecorderRef.current?.state !== 'recording') return;
            onRecordingEnginePrimed?.({
              modeCompleteAtMs,
              recordingInitializedAtMs: Date.now(),
            });
          }, WEB_RECORDING_PREROLL_MS);
        }

        const capMs = getAudioMaxRecordingDurationMs();
        maxDurationTimerRef.current = setTimeout(() => {
          maxDurationTimerRef.current = null;
          recordingCappedThisTurnRef.current = true;
          clearMaxDurationTimer();
          onBeforeWebRecorderStop?.();
          const rec = mediaRecorderRef.current;
          if (rec?.state !== 'inactive') rec?.stop();
        }, capMs + (usedWebModulePreInit ? 0 : WEB_RECORDING_PREROLL_MS));
      } catch (err) {
        stopWebMetering();
        if (__DEV__) console.error('Web recording failed:', err);
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [
      getSupportedMimeType,
      onRecordingComplete,
      onError,
      stopWebMetering,
      stopWebMeterLoop,
      onRecordingEnginePrimed,
      onBeforeWebRecorderStop,
      onRecordingTapIntent,
      clearMaxDurationTimer,
      clearWebPrerollTimer,
      sleep,
      ensureWebAudioAnalyserForStream,
      captureWebMicDeviceIdFromStream,
    ]
  );

  const stopWebRecording = useCallback(
    (opts?: { bypassMinDuration?: boolean }) => {
      const bypass = opts?.bypassMinDuration === true;
      clearMaxDurationTimer();
      clearWebPrerollTimer();
      const minMs = getAudioMinRecordingDurationMs();
      const now = Date.now();
      const effectiveStart = recordingStartTimeRef.current ?? now;
      /** Web pre-roll: `recordingStartTimeRef` is wall time when min-duration counting begins (after warm-up). */
      const elapsed = now < effectiveStart ? 0 : now - effectiveStart;
      const stop = () => {
        onBeforeWebRecorderStop?.();
        const rec = mediaRecorderRef.current;
        if (rec?.state !== 'inactive') rec?.stop();
      };
      if (!bypass && elapsed < minMs) {
        setTimeout(stop, minMs - elapsed);
      } else {
        stop();
      }
    },
    [onBeforeWebRecorderStop, clearMaxDurationTimer, clearWebPrerollTimer],
  );

  const releaseWebRecording = useCallback(
    async (opts?: {
      momentNumber?: number;
      logCleanupFailed?: (payload: { message: string; moment_number?: number }) => void;
    }) => {
      clearMaxDurationTimer();
      clearWebPrerollTimer();
      try {
        const rec = mediaRecorderRef.current;
        if (rec && rec.state !== 'inactive') {
          rec.stop();
        }
      } catch (e) {
        opts?.logCleanupFailed?.({
          message: e instanceof Error ? e.message : String(e),
          moment_number: opts.momentNumber,
        });
      }
      stopWebMetering();
      mediaRecorderRef.current = null;
      setIsRecording(false);
      setInputMeterLevel(0);
    },
    [clearMaxDurationTimer, clearWebPrerollTimer, stopWebMetering, setIsRecording, setInputMeterLevel],
  );

  const resetWebMicInputFallbackState = useCallback(() => {
    webMicFallbackSwitchConsumedRef.current = false;
    lastWebMicDeviceIdRef.current = undefined;
  }, []);

  const switchWebInputToDefaultDevice = useCallback(async (): Promise<boolean> => {
    if (webMicFallbackSwitchConsumedRef.current) return false;
    if (isDefaultOrCommunicationsDeviceId(lastWebMicDeviceIdRef.current)) return false;
    webMicFallbackSwitchConsumedRef.current = true;
    const ok = await replaceWebInterviewMicPreInitWithDefaultIdealDevice();
    if (ok) {
      const id = getPreInitAudioInputDeviceId();
      if (id) lastWebMicDeviceIdRef.current = id;
    }
    return ok;
  }, []);

  const getLastWebMicCaptureDeviceId = useCallback((): string | undefined => lastWebMicDeviceIdRef.current, []);

  const markWebMicPermissionGranted = useCallback(() => {
    setPermissionStatus('granted');
  }, [setPermissionStatus]);

  const requestWebPermission = useCallback(async (): Promise<boolean> => {
    try {
      const constraints = await buildWebMicGetUserMediaConstraints();
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      captureWebMicDeviceIdFromStream(stream);
      stream.getTracks().forEach((t) => t.stop());
      setPermissionStatus('granted');
      return true;
    } catch {
      setPermissionStatus('denied');
      return false;
    }
  }, [captureWebMicDeviceIdFromStream, setPermissionStatus]);

  useEffect(
    () => () => {
      stopWebMetering();
    },
    [stopWebMetering],
  );

  return {
    startWebRecording,
    stopWebRecording,
    releaseWebRecording,
    requestWebPermission,
    prepareWebRecordingSession,
    abandonPreparedWebRecording,
    resetWebMicInputFallbackState,
    switchWebInputToDefaultDevice,
    getLastWebMicCaptureDeviceId,
    markWebMicPermissionGranted,
  };
}
