import { useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

import { logAudioInterviewConfigOnce } from '@features/aria/config/audioInterviewConfig';

import type { AudioRecorderPermissionStatus, UseAudioRecorderParams } from './audioRecorderTypes';
export type { AudioRecorderPermissionStatus } from './audioRecorderTypes';
import { useNativeInterviewRecorder } from './useNativeInterviewRecorder';
import { useWebInterviewMediaRecorder } from './useWebInterviewMediaRecorder';

/**
 * Unified audio recording hook:
 * - expo-av for native iOS/Android
 * - MediaRecorder for web
 */
export function useAudioRecorder({
  onRecordingComplete,
  onError,
  onBeforeWebRecorderStop,
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

  const web = useWebInterviewMediaRecorder({
    onRecordingComplete,
    onError,
    onBeforeWebRecorderStop,
    onRecordingEnginePrimed,
    onRecordingTapIntent,
    setPermissionStatus,
    ...sharedControls,
  });

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return web.requestWebPermission();
    }
    return native.requestNativePermission();
  }, [native.requestNativePermission, web.requestWebPermission]);

  const startRecording = useCallback(
    async (opts?: { postAudioSessionDelayMs?: number; tapIntentAtMs?: number }): Promise<boolean> => {
      const granted = permissionStatus === 'granted' || (await requestPermission());
      if (!granted) {
        onError?.(new Error('Microphone permission denied'));
        return false;
      }

      try {
        if (Platform.OS === 'web') {
          await web.startWebRecording(opts);
        } else {
          await native.startNativeRecording(opts);
        }
        return true;
      } catch {
        return false;
      }
    },
    [permissionStatus, requestPermission, web.startWebRecording, native.startNativeRecording, onError],
  );

  const stopRecording = useCallback(
    (opts?: { bypassMinDuration?: boolean }) => {
      if (Platform.OS === 'web') {
        web.stopWebRecording(opts);
      } else {
        void native.stopNativeRecording();
      }
    },
    [web.stopWebRecording, native.stopNativeRecording],
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
      if (Platform.OS === 'web') {
        await web.releaseWebRecording(opts);
        return;
      }
      await native.releaseNativeRecording(opts);
    },
    [native.releaseNativeRecording, web.releaseWebRecording],
  );

  const reinitializeMicrophoneSession = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      return requestPermission();
    }
    return native.reinitializeNativeMicrophoneSession();
  }, [requestPermission, native.reinitializeNativeMicrophoneSession]);

  return {
    isRecording,
    permissionStatus,
    toggleRecording,
    startRecording,
    stopRecording,
    releaseRecordingInstance,
    requestPermission,
    markWebMicPermissionGranted: web.markWebMicPermissionGranted,
    inputMeterLevel,
    lastRecordingPeakMeteringDb: maxMeteringDbRef,
    reinitializeMicrophoneSession,
    prepareWebRecordingSession: web.prepareWebRecordingSession,
    abandonPreparedWebRecording: web.abandonPreparedWebRecording,
    getLastWebMicCaptureDeviceId: web.getLastWebMicCaptureDeviceId,
    switchWebInputToDefaultDevice: web.switchWebInputToDefaultDevice,
    resetWebMicInputFallbackState: web.resetWebMicInputFallbackState,
  };
}
