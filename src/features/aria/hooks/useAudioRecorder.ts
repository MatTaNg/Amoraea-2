import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import {
  getLastAppliedAudioModeLabel,
  setRecordingMode,
  transitionFromRecordingToPlaybackNative,
} from '@features/aria/utils/audioModeHelpers';
import {
  getAudioMaxRecordingDurationMs,
  getAudioMeteringPollIntervalMs,
  getAudioMinRecordingDurationMs,
  logAudioInterviewConfigOnce,
} from '@features/aria/config/audioInterviewConfig';
import {
  logNativeMicRecordingStopped,
  logWebMicRecordingStopped,
} from '@features/aria/telemetry/tsAutoplayTelemetry';
import { remoteLog } from '@utilities/remoteLog';
import {
  getLastPreInitTriggerDuring,
  rearmWebMicPreInitAfterRecordingStop,
  tryConsumeWebPreInitRecorder,
} from '@features/aria/utils/webInterviewMicPreInit';

function isWebMicStreamLive(stream: MediaStream | null): boolean {
  if (!stream?.active) return false;
  const t = stream.getAudioTracks()[0];
  return !!t && t.readyState === 'live';
}

/** Do not top-level import expo-av — it breaks web lazy-load of the interview screen. */
function getExpoAvAudio(): typeof import('expo-av').Audio {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-av').Audio;
}

function buildRecordingPreset(Audio: ReturnType<typeof getExpoAvAudio>) {
  return {
    isMeteringEnabled: true,
    android: {
      extension: '.m4a',
      outputFormat: Audio.AndroidOutputFormat.MPEG_4,
      audioEncoder: Audio.AndroidAudioEncoder.AAC,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    ios: {
      extension: '.m4a',
      outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: 'audio/webm',
      bitsPerSecond: 128000,
    },
  } as const;
}

/** Web: wall-clock offset for min/max timers so warm-up audio is included; `onRecordingEnginePrimed` fires after this. */
const WEB_RECORDING_PREROLL_MS = 100;

export type AudioRecorderPermissionStatus = 'granted' | 'denied' | null;

type RecordingStatusLike = {
  isRecording?: boolean;
  metering?: number;
  mediaServicesDidReset?: boolean;
};

/**
 * useAudioRecorder
 *
 * Unified audio recording hook:
 * - expo-av for native iOS/Android (reliable, native stack)
 * - MediaRecorder for web (where it works)
 */
export function useAudioRecorder({
  onRecordingComplete,
  onError,
  onBeforeWebRecorderStop,
  onMediaServicesReset,
  onRecordingEnginePrimed,
}: {
  onRecordingComplete?: (
    blob: Blob,
    nativeUri: string | null,
    meta?: {
      peakMeteringDb: number | null;
      recordingCapped?: boolean;
      /** Web: wall-clock timing for telemetry (tap → MediaRecorder.start). */
      webRecordingTiming?: {
        tapIntentAtMs: number;
        mediaRecorderStartAtMs: number;
        recorderPreInitialized: boolean;
        recorderStartCalledMs: number;
        /** Wall time when `MediaRecorder.stop()` completed (blob assembled). */
        recorderStopCalledMs?: number;
        firstChunkReceivedMs: number | null;
        chunkLatencyMs: number | null;
        preInitFallbackReason: string | null;
        streamReactivated: boolean;
        preInitTriggeredDuring: ReturnType<typeof getLastPreInitTriggerDuring>;
      };
    }
  ) => void | Promise<void>;
  onError?: (err: Error) => void;
  /** Web: run synchronously in the same user-gesture stack as `MediaRecorder.stop()` (e.g. resume AudioContext for later TTS). */
  onBeforeWebRecorderStop?: () => void;
  /** iOS: media services reset (e.g. route change) — caller should prompt reconnect. */
  onMediaServicesReset?: () => void;
  /** After audio session (native) or stream acquisition (web) is ready, post-delay, when recording engine is initialized. */
  onRecordingEnginePrimed?: (info: {
    modeCompleteAtMs: number;
    recordingInitializedAtMs: number;
  }) => void;
}) {
  logAudioInterviewConfigOnce();

  const sleep = useCallback((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)), []);

  const [isRecording, setIsRecording] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<AudioRecorderPermissionStatus>(null);
  /** 0–1 UI level (native: expo metering; web: analyser RMS). */
  const [inputMeterLevel, setInputMeterLevel] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordingRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);
  const webMimeRef = useRef<string>('audio/webm');
  const maxMeteringDbRef = useRef<number | null>(null);
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
  const lastWebRecordingTimingRef = useRef<{
    tapIntentAtMs: number;
    mediaRecorderStartAtMs: number;
    recorderPreInitialized: boolean;
    recorderStartCalledMs: number;
    recorderStopCalledMs?: number;
    firstChunkReceivedMs: number | null;
    chunkLatencyMs: number | null;
    preInitFallbackReason: string | null;
    streamReactivated: boolean;
    preInitTriggeredDuring: ReturnType<typeof getLastPreInitTriggerDuring>;
  } | null>(null);
  /** Web: `MediaRecorder` constructed during TTS (inactive) — tap only calls `start(100)`. */
  const webMediaRecorderPreparedRef = useRef<MediaRecorder | null>(null);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingCappedThisTurnRef = useRef(false);

  const clearMaxDurationTimer = useCallback(() => {
    if (maxDurationTimerRef.current != null) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
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

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setPermissionStatus('granted');
        return true;
      } catch {
        setPermissionStatus('denied');
        return false;
      }
    }
    const Audio = getExpoAvAudio();
    const { status } = await Audio.requestPermissionsAsync();
    setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
    return status === 'granted';
  }, []);

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
    // #region agent log
    void remoteLog('[MEDIARECORDER] mime_priority', {
      hypothesisId: 'H_prefer_webm_opus_mobile',
      isMobileWebKit,
      chosen,
      supportedListed: supported,
    });
    // #endregion
    return chosen;
  }, []);

  const stopNativeRecording = useCallback(async () => {
    clearMaxDurationTimer();
    const recording = recordingRef.current;
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      if (Platform.OS !== 'web') {
        await transitionFromRecordingToPlaybackNative('native_recording_stop');
      }

      const uri = recording.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      setInputMeterLevel(0);

      if (uri) {
        const response = await fetch(uri);
        const blob = await response.blob();
        logNativeMicRecordingStopped({ blobBytes: blob.size, platformOs: Platform.OS });
        await onRecordingComplete?.(blob, uri, {
          peakMeteringDb: maxMeteringDbRef.current,
          recordingCapped: recordingCappedThisTurnRef.current,
        });
        recordingCappedThisTurnRef.current = false;
      }
    } catch (err) {
      if (__DEV__) console.error('Native recording stop failed:', err);
      setIsRecording(false);
      setInputMeterLevel(0);
      if (Platform.OS !== 'web') {
        await transitionFromRecordingToPlaybackNative('native_recording_stop_error').catch(() => {});
      }
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, [onRecordingComplete, onError, clearMaxDurationTimer]);

  const startNativeRecording = useCallback(
    async (opts?: { postAudioSessionDelayMs?: number }) => {
    try {
      maxMeteringDbRef.current = null;
      recordingCappedThisTurnRef.current = false;
      clearMaxDurationTimer();
      await setRecordingMode();
      const modeCompleteAtMs = Date.now();
      if (getLastAppliedAudioModeLabel() !== 'recording') {
        if (__DEV__) {
          console.warn('[useAudioRecorder] expected recording audio mode after setRecordingMode');
        }
      }
      const delayMs = Math.max(0, opts?.postAudioSessionDelayMs ?? 500);
      await sleep(delayMs);

      const Audio = getExpoAvAudio();
      const pollMs = getAudioMeteringPollIntervalMs();
      const onStatus = (status: RecordingStatusLike) => {
        if (status.mediaServicesDidReset) {
          onMediaServicesReset?.();
        }
        const m = status.metering;
        if (typeof m === 'number' && Number.isFinite(m)) {
          if (maxMeteringDbRef.current == null || m > maxMeteringDbRef.current) {
            maxMeteringDbRef.current = m;
          }
          const n = Math.max(0, Math.min(1, (m + 160) / 160));
          setInputMeterLevel(n);
        }
      };

      const { recording } = await Audio.Recording.createAsync(buildRecordingPreset(Audio), onStatus, pollMs);
      const recordingInitializedAtMs = Date.now();
      onRecordingEnginePrimed?.({ modeCompleteAtMs, recordingInitializedAtMs });

      recordingRef.current = recording;
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
      const capMs = getAudioMaxRecordingDurationMs();
      maxDurationTimerRef.current = setTimeout(() => {
        maxDurationTimerRef.current = null;
        recordingCappedThisTurnRef.current = true;
        void stopNativeRecording();
      }, capMs);
    } catch (err) {
      if (__DEV__) console.error('Native recording failed:', err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  },
    [onError, onMediaServicesReset, onRecordingEnginePrimed, clearMaxDurationTimer, stopNativeRecording, sleep]
  );

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

  /**
   * Web: mic pre-init is driven by `webInterviewMicPreInit` during TTS + rearm after recording.
   * Kept as a no-op for API compatibility with AriaScreen.
   */
  const prepareWebRecordingSession = useCallback(async () => {
    if (Platform.OS !== 'web') return;
  }, []);

  /** Web: legacy abandon — optional cleanup when idle (module owns pre-init stream). */
  const abandonPreparedWebRecording = useCallback(async () => {
    if (Platform.OS !== 'web') return;
    if (mediaRecorderRef.current?.state === 'recording') return;
  }, []);

  const startWebRecording = useCallback(
    async (opts?: { postAudioSessionDelayMs?: number; tapIntentAtMs?: number }) => {
      try {
        recordingCappedThisTurnRef.current = false;
        clearMaxDurationTimer();
        clearWebPrerollTimer();
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
            stream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
              },
            });
            webStreamRef.current = stream;
            webMicPipelinePrimedRef.current = true;
            ensureWebAudioAnalyserForStream(stream);
            webPrepareCompleteAtMsRef.current = Date.now();
            modeCompleteAtMs = webPrepareCompleteAtMsRef.current;
          }
        }

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
              // #region agent log
              fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
                body: JSON.stringify({
                  sessionId: 'c61a43',
                  location: 'useAudioRecorder.ts:ondataavailable:first',
                  message: 'first_media_chunk',
                  data: {
                    hypothesisId: 'H5',
                    ms_since_tap: Date.now() - tapIntentAtMs,
                    chunk_bytes: e.data.size,
                    micPrimedBeforeTap: streamWasPrimedFromTts,
                    recorder_pre_initialized: recorderPreInitialized,
                    chunk_latency_ms: timing?.chunkLatencyMs ?? null,
                  },
                  timestamp: Date.now(),
                  runId: 'post-fix',
                }),
              }).catch(() => {});
              // #endregion
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
          rearmWebMicPreInitAfterRecordingStop().catch(() => {});
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
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            location: 'useAudioRecorder.ts:startWebRecording:afterStart',
            message: 'mediarecorder_started_sync_meter',
            data: {
              hypothesisId: 'H1',
              ms_since_tap: recorderStartCalledMs - tapIntentAtMs,
              micPrimedBeforeTap: streamWasPrimedFromTts,
              recorder_pre_initialized: recorderPreInitialized,
              delay_ms_applied: delayMs,
            },
            timestamp: Date.now(),
            runId: 'post-fix',
          }),
        }).catch(() => {});
        // #endregion

        meterOnce();
        const firstMeterAt = Date.now();
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            location: 'useAudioRecorder.ts:startWebRecording:first_meter',
            message: 'first_meter_sample_after_start',
            data: {
              hypothesisId: 'H3',
              ms_after_mediarecorder_start: firstMeterAt - recorderStartCalledMs,
              ms_since_tap: firstMeterAt - tapIntentAtMs,
            },
            timestamp: Date.now(),
            runId: 'post-fix',
          }),
        }).catch(() => {});
        // #endregion
        webMeterRafRef.current = requestAnimationFrame(runMeterLoop);

        setIsRecording(true);
        const prerollEndWallMs = Date.now() + WEB_RECORDING_PREROLL_MS;
        recordingStartTimeRef.current = prerollEndWallMs;

        webPrerollTimerRef.current = setTimeout(() => {
          webPrerollTimerRef.current = null;
          if (mediaRecorderRef.current?.state !== 'recording') return;
          const recordingInitializedAtMs = Date.now();
          onRecordingEnginePrimed?.({
            modeCompleteAtMs,
            recordingInitializedAtMs,
          });
        }, WEB_RECORDING_PREROLL_MS);

        const capMs = getAudioMaxRecordingDurationMs();
        maxDurationTimerRef.current = setTimeout(() => {
          maxDurationTimerRef.current = null;
          recordingCappedThisTurnRef.current = true;
          clearMaxDurationTimer();
          onBeforeWebRecorderStop?.();
          const rec = mediaRecorderRef.current;
          if (rec?.state !== 'inactive') rec?.stop();
        }, capMs + WEB_RECORDING_PREROLL_MS);
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
      clearMaxDurationTimer,
      clearWebPrerollTimer,
      sleep,
      ensureWebAudioAnalyserForStream,
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
    [onBeforeWebRecorderStop, clearMaxDurationTimer, clearWebPrerollTimer]
  );

  useEffect(
    () => () => {
      stopWebMetering();
    },
    [stopWebMetering]
  );

  const releaseRecordingInstance = useCallback(
    async (opts?: { momentNumber?: number; logCleanupFailed?: (payload: { message: string; moment_number?: number }) => void }) => {
      clearMaxDurationTimer();
      clearWebPrerollTimer();
      if (Platform.OS === 'web') {
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
        return;
      }
      const rec = recordingRef.current;
      if (rec) {
        try {
          await rec.stopAndUnloadAsync();
        } catch (e) {
          opts?.logCleanupFailed?.({
            message: e instanceof Error ? e.message : String(e),
            moment_number: opts.momentNumber,
          });
        }
        recordingRef.current = null;
      }
      setIsRecording(false);
      setInputMeterLevel(0);
    },
    [clearMaxDurationTimer, stopWebMetering]
  );

  const startRecording = useCallback(
    async (opts?: { postAudioSessionDelayMs?: number; tapIntentAtMs?: number }) => {
      const granted = permissionStatus === 'granted' || (await requestPermission());
      if (!granted) {
        onError?.(new Error('Microphone permission denied'));
        return;
      }

      if (Platform.OS === 'web') {
        await startWebRecording(opts);
      } else {
        await startNativeRecording(opts);
      }
    },
    [permissionStatus, requestPermission, startWebRecording, startNativeRecording, onError]
  );

  const stopRecording = useCallback((opts?: { bypassMinDuration?: boolean }) => {
    if (Platform.OS === 'web') {
      stopWebRecording(opts);
    } else {
      void stopNativeRecording();
    }
  }, [stopWebRecording, stopNativeRecording]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  /** Re-run session + permission after OS interruption / backgrounding. */
  const reinitializeMicrophoneSession = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      const ok = await requestPermission();
      return ok;
    }
    await setRecordingMode();
    const ok = await requestPermission();
    return ok;
  }, [requestPermission]);

  return {
    isRecording,
    permissionStatus,
    toggleRecording,
    startRecording,
    stopRecording,
    /** Ensures native `Recording` / web `MediaRecorder` is fully released (call before next turn). */
    releaseRecordingInstance,
    requestPermission,
    /** Smoothed 0–1 for UI meter */
    inputMeterLevel,
    /** Native: max peak metering (dBFS) for last completed recording; web: null (use blob RMS in transcribe). */
    lastRecordingPeakMeteringDb: maxMeteringDbRef,
    reinitializeMicrophoneSession,
    /** Web: warm mic + analyser during TTS so tap does not pay getUserMedia latency. */
    prepareWebRecordingSession,
    abandonPreparedWebRecording,
  };
}
