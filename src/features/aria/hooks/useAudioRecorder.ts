import { useState, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { setPlaybackMode, setRecordingMode } from '@features/aria/utils/audioModeHelpers';
export type AudioRecorderPermissionStatus = 'granted' | 'denied' | null;

const RECORDING_OPTIONS = {
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
}: {
  onRecordingComplete?: (blob: Blob, nativeUri: string | null) => void | Promise<void>;
  onError?: (err: Error) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<AudioRecorderPermissionStatus>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);
  const webMimeRef = useRef<string>('audio/webm');

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
      await setRecordingMode();

      const { recording } = await Audio.Recording.createAsync(RECORDING_OPTIONS);

      recordingRef.current = recording;
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (err) {
      if (__DEV__) console.error('Native recording failed:', err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, [onError]);

  const stopNativeRecording = useCallback(async () => {
    const recording = recordingRef.current;
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      // iOS: PlayAndRecord without DefaultToSpeaker while recording; restore playback-only session ASAP so next TTS uses loudspeaker (expo-av applies DefaultToSpeaker when allowsRecordingIOS is false).
      if (Platform.OS !== 'web') {
        await setPlaybackMode();
      }

      const uri = recording.getURI();
      recordingRef.current = null;
      setIsRecording(false);

      if (uri) {
        const response = await fetch(uri);
        const blob = await response.blob();
        await onRecordingComplete?.(blob, uri);
      }
    } catch (err) {
      if (__DEV__) console.error('Native recording stop failed:', err);
      setIsRecording(false);
      if (Platform.OS !== 'web') {
        await setPlaybackMode().catch(() => {});
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
          sampleRate: 44100,
        },
      });

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
        const blob = new Blob(audioChunksRef.current, {
          type: webMimeRef.current,
        });
        stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current = null;
        setIsRecording(false);
        await onRecordingComplete?.(blob, null);
      };

      /** No timeslice: one `dataavailable` + final blob on `stop()` — mobile Brave often produced empty blobs with `start(1000)` when stop fired before the first slice. */
      mediaRecorder.start();
      recordingStartTimeRef.current = Date.now();
      setIsRecording(true);
    } catch (err) {
      if (__DEV__) console.error('Web recording failed:', err);
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }, [getSupportedMimeType, onRecordingComplete, onError]);

  const stopWebRecording = useCallback(() => {
    const elapsed = Date.now() - (recordingStartTimeRef.current ?? 0);
    const stop = () => {
      const rec = mediaRecorderRef.current;
      if (rec?.state !== 'inactive') rec?.stop();
    };
    if (elapsed < 1000) {
      setTimeout(stop, 1000 - elapsed);
    } else {
      stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    const granted =
      permissionStatus === 'granted' || (await requestPermission());
    if (!granted) {
      onError?.(new Error('Microphone permission denied'));
      return;
    }

    if (Platform.OS === 'web') {
      await startWebRecording();
    } else {
      await startNativeRecording();
    }
  }, [
    permissionStatus,
    requestPermission,
    startWebRecording,
    startNativeRecording,
    onError,
  ]);

  const stopRecording = useCallback(() => {
    if (Platform.OS === 'web') {
      stopWebRecording();
    } else {
      stopNativeRecording();
    }
  }, [stopWebRecording, stopNativeRecording]);

  const toggleRecording = useCallback(async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return {
    isRecording,
    permissionStatus,
    toggleRecording,
    startRecording,
    stopRecording,
    requestPermission,
  };
}
