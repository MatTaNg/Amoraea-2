import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

import {
  setTtsBufferCompleteBeforePlaybackForNextPlayback,
  setTtsPlaybackStrategyForNextPlayback,
} from '@features/aria/telemetry/ttsBufferTelemetry';
import { applyNativeTtsPrePlaybackAudioMode, setPlaybackMode } from './audioModeHelpers';
import type { ElevenLabsSpeakOptions } from './elevenLabsSpeakTypes';
import { stopElevenLabsPlayback } from './elevenLabsTtsPlaybackStop';
import { getLocalDevPlaybackRateMultiplier } from './interviewTtsPlaybackRate';
import { applyAmoraeaPronunciationForDeviceSpeech } from './elevenLabsTtsVoice';

/** Expo-speech fallback when ElevenLabs network TTS is unavailable (native apps). */
export function speakFallback(
  text: string,
  onFallback?: () => void,
  playbackOpts?: ElevenLabsSpeakOptions
): Promise<void> {
  setTtsBufferCompleteBeforePlaybackForNextPlayback(false);
  setTtsPlaybackStrategyForNextPlayback('streaming');
  const onPlaybackStarted = playbackOpts?.onPlaybackStarted;
  onFallback?.();
  const speechText = applyAmoraeaPronunciationForDeviceSpeech(text ?? '');
  return new Promise((resolve, reject) => {
    const run = async () => {
      await stopElevenLabsPlayback();
      await applyNativeTtsPrePlaybackAudioMode('speakFallback:before_expo_speech').catch(() => {});
      if (Platform.OS === 'android') {
        await setPlaybackMode().catch(() => {});
      }
      onPlaybackStarted?.();
      // iOS: false = AVSpeechSynthesizer uses its own playback session (speaker).
      const iosSpeechSession = Platform.OS === 'ios' ? { useApplicationAudioSession: false as const } : {};
      Speech.speak(speechText, {
        language: 'en-US',
        rate: Math.min(2, Math.max(0.4, 0.78 * getLocalDevPlaybackRateMultiplier())),
        pitch: 0.92,
        ...iosSpeechSession,
        onDone: () => {
          resolve();
        },
        onStopped: resolve,
        onError: () => {
          resolve();
        },
      });
    };
    void run().catch((err: unknown) => {
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}
