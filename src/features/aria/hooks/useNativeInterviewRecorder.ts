import { useCallback, useRef } from 'react';
import { Platform } from 'react-native';

import {
  getAudioMaxRecordingDurationMs,
  getAudioMeteringPollIntervalMs,
  getAudioPostSessionRecordingDelayMs,
} from '@features/aria/config/audioInterviewConfig';
import { logNativeMicRecordingStopped } from '@features/aria/telemetry/tsAutoplayTelemetry';
import {
  getLastAppliedAudioModeLabel,
  setRecordingMode,
  transitionFromRecordingToPlaybackNative,
} from '@features/aria/utils/audioModeHelpers';

import type {
  AudioRecorderPermissionStatus,
  AudioRecorderSharedControls,
  RecordingStatusLike,
  UseAudioRecorderParams,
} from './audioRecorderTypes';
import { buildRecordingPreset, getExpoAvAudio } from './nativeInterviewRecorderPreset';

export type UseNativeInterviewRecorderParams = Pick<
  UseAudioRecorderParams,
  'onRecordingComplete' | 'onError' | 'onMediaServicesReset' | 'onRecordingEnginePrimed' | 'onRecordingTapIntent'
> &
  AudioRecorderSharedControls & {
    setPermissionStatus: React.Dispatch<React.SetStateAction<AudioRecorderPermissionStatus>>;
  };

export function useNativeInterviewRecorder(params: UseNativeInterviewRecorderParams) {
  const {
    onRecordingComplete,
    onError,
    onMediaServicesReset,
    onRecordingEnginePrimed,
    onRecordingTapIntent,
    setIsRecording,
    setInputMeterLevel,
    maxMeteringDbRef,
    recordingCappedThisTurnRef,
    maxDurationTimerRef,
    clearMaxDurationTimer,
    sleep,
    setPermissionStatus,
  } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recordingRef = useRef<any>(null);
  const recordingStartTimeRef = useRef<number | null>(null);

  const requestNativePermission = useCallback(async (): Promise<boolean> => {
    const Audio = getExpoAvAudio();
    const { status } = await Audio.requestPermissionsAsync();
    setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
    return status === 'granted';
  }, [setPermissionStatus]);

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
  }, [
    onRecordingComplete,
    onError,
    clearMaxDurationTimer,
    setIsRecording,
    setInputMeterLevel,
    maxMeteringDbRef,
    recordingCappedThisTurnRef,
  ]);

  const startNativeRecording = useCallback(
    async (opts?: { postAudioSessionDelayMs?: number }) => {
      try {
        maxMeteringDbRef.current = null;
        recordingCappedThisTurnRef.current = false;
        clearMaxDurationTimer();
        onRecordingTapIntent?.();
        await setRecordingMode();
        const modeCompleteAtMs = Date.now();
        if (getLastAppliedAudioModeLabel() !== 'recording') {
          if (__DEV__) {
            console.warn('[useAudioRecorder] expected recording audio mode after setRecordingMode');
          }
        }
        const delayMs = Math.max(
          0,
          opts?.postAudioSessionDelayMs ?? getAudioPostSessionRecordingDelayMs(),
        );
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
    [
      onError,
      onMediaServicesReset,
      onRecordingEnginePrimed,
      onRecordingTapIntent,
      clearMaxDurationTimer,
      stopNativeRecording,
      sleep,
      setIsRecording,
      setInputMeterLevel,
      maxMeteringDbRef,
      recordingCappedThisTurnRef,
      maxDurationTimerRef,
    ],
  );

  const releaseNativeRecording = useCallback(
    async (opts?: {
      momentNumber?: number;
      logCleanupFailed?: (payload: { message: string; moment_number?: number }) => void;
    }) => {
      clearMaxDurationTimer();
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
    [clearMaxDurationTimer, setIsRecording, setInputMeterLevel],
  );

  const reinitializeNativeMicrophoneSession = useCallback(async (): Promise<boolean> => {
    await setRecordingMode();
    return requestNativePermission();
  }, [requestNativePermission]);

  return {
    startNativeRecording,
    stopNativeRecording,
    releaseNativeRecording,
    requestNativePermission,
    reinitializeNativeMicrophoneSession,
  };
}
