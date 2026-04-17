import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import {
  setRecordingMode,
  transitionFromRecordingToPlaybackNative,
} from '@features/aria/utils/audioModeHelpers';
import {
  getAudioMeteringPollIntervalMs,
  getAudioMinRecordingDurationMs,
  logAudioInterviewConfigOnce,
} from '@features/aria/config/audioInterviewConfig';
import {
  logNativeMicRecordingStopped,
  logWebMicRecordingStopped,
} from '@features/aria/telemetry/tsAutoplayTelemetry';

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
}: {
  onRecordingComplete?: (
    blob: Blob,
    nativeUri: string | null,
    meta?: { peakMeteringDb: number | null }
  ) => void | Promise<void>;
  onError?: (err: Error) => void;
  /** Web: run synchronously in the same user-gesture stack as `MediaRecorder.stop()` (e.g. resume AudioContext for later TTS). */
  onBeforeWebRecorderStop?: () => void;
  /** iOS: media services reset (e.g. route change) — caller should prompt reconnect. */
  onMediaServicesReset?: () => void;
}) {
  logAudioInterviewConfigOnce();

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

  const stopWebMetering = useCallback(() => {
    if (webMeterIntervalRef.current != null) {
      clearInterval(webMeterIntervalRef.current);
      webMeterIntervalRef.current = null;
    }
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
    webStreamRef.current = null;
    setInputMeterLevel(0);
  }, []);

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
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
  }, []);

  const startNativeRecording = useCallback(async () => {
    try {
      maxMeteringDbRef.current = null;
      await setRecordingMode();

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

      recordingRef.current = recording;
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (err) {
      if (__DEV__) console.error('Native recording failed:', err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, [onError, onMediaServicesReset]);

  const stopNativeRecording = useCallback(async () => {
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
        await onRecordingComplete?.(blob, uri, { peakMeteringDb: maxMeteringDbRef.current });
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
  }, [onRecordingComplete, onError]);

  const startWebRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      webStreamRef.current = stream;

      try {
        const Ctx =
          typeof window !== 'undefined' && window.AudioContext
            ? window.AudioContext
            : typeof window !== 'undefined' && (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
              ? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
              : null;
        if (Ctx) {
          const ctx = new Ctx();
          webAudioCtxRef.current = ctx;
          const source = ctx.createMediaStreamSource(stream);
          const analyser = ctx.createAnalyser();
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.5;
          source.connect(analyser);
          webAnalyserRef.current = analyser;
          const data = new Uint8Array(analyser.fftSize);
          webMeterIntervalRef.current = setInterval(() => {
            try {
              analyser.getByteTimeDomainData(data);
              let peak = 0;
              for (let i = 0; i < data.length; i++) {
                const v = (data[i] - 128) / 128;
                const a = Math.abs(v);
                if (a > peak) peak = a;
              }
              setInputMeterLevel(Math.min(1, peak * 2.2));
            } catch {
              /* ignore */
            }
          }, 80);
        }
      } catch {
        /* metering optional */
      }

      audioChunksRef.current = [];
      const mimeType = getSupportedMimeType();
      webMimeRef.current = mimeType ?? 'audio/webm';
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data?.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stopWebMetering();
        const blob = new Blob(audioChunksRef.current, {
          type: webMimeRef.current,
        });
        const start = recordingStartTimeRef.current;
        const elapsedMs = start != null ? Date.now() - start : undefined;
        logWebMicRecordingStopped({
          blobBytes: blob.size,
          mime: webMimeRef.current,
          elapsedMs,
        });
        stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
        setIsRecording(false);
        await onRecordingComplete?.(blob, null, { peakMeteringDb: null });
      };

      mediaRecorder.start(100);
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (err) {
      stopWebMetering();
      if (__DEV__) console.error('Web recording failed:', err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, [getSupportedMimeType, onRecordingComplete, onError, stopWebMetering]);

  const stopWebRecording = useCallback(() => {
    const minMs = getAudioMinRecordingDurationMs();
    const elapsed = Date.now() - (recordingStartTimeRef.current ?? 0);
    const stop = () => {
      onBeforeWebRecorderStop?.();
      const rec = mediaRecorderRef.current;
      if (rec?.state !== 'inactive') rec?.stop();
    };
    if (elapsed < minMs) {
      setTimeout(stop, minMs - elapsed);
    } else {
      stop();
    }
  }, [onBeforeWebRecorderStop]);

  useEffect(
    () => () => {
      stopWebMetering();
    },
    [stopWebMetering]
  );

  const startRecording = useCallback(async () => {
    const granted = permissionStatus === 'granted' || (await requestPermission());
    if (!granted) {
      onError?.(new Error('Microphone permission denied'));
      return;
    }

    if (Platform.OS === 'web') {
      await startWebRecording();
    } else {
      await startNativeRecording();
    }
  }, [permissionStatus, requestPermission, startWebRecording, startNativeRecording, onError]);

  const stopRecording = useCallback(() => {
    if (Platform.OS === 'web') {
      stopWebRecording();
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
    requestPermission,
    /** Smoothed 0–1 for UI meter */
    inputMeterLevel,
    /** Native: max peak metering (dBFS) for last completed recording; web: null (use blob RMS in transcribe). */
    lastRecordingPeakMeteringDb: maxMeteringDbRef,
    reinitializeMicrophoneSession,
  };
}
