import { useState, useRef, useCallback } from 'react';

import { logAudioInterviewConfigOnce } from '@features/aria/config/audioInterviewConfig';

import type { AudioRecorderPermissionStatus, UseAudioRecorderParams } from './audioRecorderTypes';
export type { AudioRecorderPermissionStatus } from './audioRecorderTypes';
import { useNativeInterviewRecorder } from './useNativeInterviewRecorder';

/**
 * Audio recording for native iOS/Android (expo-av).
 * Browser MediaRecorder path removed.
 */
export function useAudioRecorder({
  onRecordingComplete,
  onError,
  onMediaServicesReset,
  onRecordingEnginePrimed,
  onRecordingTapIntent,
}: UseAudioRecorderParams) {
  logAudioInterviewConfigOnce();

  const sleep = useCallback((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)), []);

  const [isRecording, setIsRecording] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<AudioRecorderPermissionStatus>(null);
  const [inputMeterLevel, setInputMeterLevel] = useState(0);

  const maxMeteringDbRef = useRef<number | null>(null);
  const recordingCappedThisTurnRef = useRef(false);
  const maxDurationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMaxDurationTimer = useCallback(() => {
    if (maxDurationTimerRef.current != null) {
      clearTimeout(maxDurationTimerRef.current);
      maxDurationTimerRef.current = null;
    }
  }, []);

  const sharedControls = {
    setIsRecording,
    setInputMeterLevel,
    maxMeteringDbRef,
    recordingCappedThisTurnRef,
    maxDurationTimerRef,
    clearMaxDurationTimer,
    sleep,
  };

  const native = useNativeInterviewRecorder({
    onRecordingComplete,
    onError,
    onMediaServicesReset,
    onRecordingEnginePrimed,
    onRecordingTapIntent,
    setPermissionStatus,
    ...sharedControls,
  });

  const requestPermission = useCallback(async (): Promise<boolean> => {
    return native.requestNativePermission();
  }, [native.requestNativePermission]);

  const startRecording = useCallback(
    async (opts?: { postAudioSessionDelayMs?: number; tapIntentAtMs?: number }): Promise<boolean> => {
      const granted = permissionStatus === 'granted' || (await requestPermission());
      if (!granted) {
        onError?.(new Error('Microphone permission denied'));
        return false;
      }

      try {
        await native.startNativeRecording(opts);
        return true;
      } catch {
        return false;
      }
    },
    [permissionStatus, requestPermission, native.startNativeRecording, onError],
  );

  const stopRecording = useCallback(
    (_opts?: { bypassMinDuration?: boolean }) => {
      void native.stopNativeRecording();
    },
    [native.stopNativeRecording],
  );

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  const releaseRecordingInstance = useCallback(
    async (opts?: {
      momentNumber?: number;
      logCleanupFailed?: (payload: { message: string; moment_number?: number }) => void;
    }) => {
      await native.releaseNativeRecording(opts);
    },
    [native.releaseNativeRecording],
  );

  const reinitializeMicrophoneSession = useCallback(async (): Promise<boolean> => {
    return native.reinitializeNativeMicrophoneSession();
  }, [native.reinitializeNativeMicrophoneSession]);

  return {
    isRecording,
    permissionStatus,
    toggleRecording,
    startRecording,
    stopRecording,
    releaseRecordingInstance,
    requestPermission,
    markWebMicPermissionGranted: () => {
      /* no-op — web mic path removed */
    },
    inputMeterLevel,
    lastRecordingPeakMeteringDb: maxMeteringDbRef,
    reinitializeMicrophoneSession,
    prepareWebRecordingSession: async () => {
      /* no-op — web mic path removed */
    },
    abandonPreparedWebRecording: () => {
      /* no-op */
    },
    getLastWebMicCaptureDeviceId: () => null as string | null,
    switchWebInputToDefaultDevice: async () => false,
    resetWebMicInputFallbackState: () => {
      /* no-op */
    },
  };
}
