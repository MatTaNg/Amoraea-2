import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

import {
  setTtsBufferCompleteBeforePlaybackForNextPlayback,
  setTtsPlaybackStrategyForNextPlayback,
} from '@features/aria/telemetry/ttsBufferTelemetry';
import { logAndApplyPlaybackModeForTts } from './audioModeHelpers';
import type { ElevenLabsSpeakOptions } from './elevenLabsSpeakTypes';
import { stopElevenLabsPlayback } from './elevenLabsTtsPlaybackStop';
import {
  getEffectivePlaybackRateMultiplier,
  getLocalDevPlaybackRateMultiplier,
} from './interviewTtsPlaybackRate';
import { speakWithWebSpeechSynthesis } from './interviewWebSpeechSynthesis';
import { webSpeechShouldDeferToUserGesture } from './webSpeechDeferPolicy';
import { WebTtsRequiresUserGestureError } from './webTtsGestureErrors';

/** Expo-speech / Web Speech fallback when ElevenLabs network TTS is unavailable. */
export function speakFallback(
  text: string,
  onFallback?: () => void,
  playbackOpts?: ElevenLabsSpeakOptions
): Promise<void> {
  /** Expo-speech / Web Speech API — synthesized locally; not a full ElevenLabs buffer before playback. */
  setTtsBufferCompleteBeforePlaybackForNextPlayback(false);
  setTtsPlaybackStrategyForNextPlayback('streaming');
  const onPlaybackStarted = playbackOpts?.onPlaybackStarted;
  onFallback?.();
  return new Promise((resolve, reject) => {
    const run = async () => {
      await stopElevenLabsPlayback();
      if (Platform.OS === 'web') {
        /** `speechSynthesis` does not use the shared `AudioContext`; do not require `unlockWebAudioForAutoplay` here. */
        const playbackRateMultiplier = getEffectivePlaybackRateMultiplier(playbackOpts?.playbackRateMultiplier);
        const webRes = await speakWithWebSpeechSynthesis(
          text,
          onPlaybackStarted,
          playbackOpts?.preInitTriggerDuring ??
            (playbackOpts?.telemetry?.source === 'greeting' ? 'greeting' : 'tts_playback'),
          playbackRateMultiplier
        );
        if (webRes.ok) {
          resolve();
          return;
        }
        if (!webRes.ok && webRes.error === 'not-allowed') {
          throw new WebTtsRequiresUserGestureError(text);
        }
        if (!webRes.ok && webSpeechShouldDeferToUserGesture()) {
          throw new WebTtsRequiresUserGestureError(text);
        }
        throw new WebTtsRequiresUserGestureError(text);
      }
      await logAndApplyPlaybackModeForTts('speakFallback:before_expo_speech').catch(() => {});
      onPlaybackStarted?.();
      // iOS: false = AVSpeechSynthesizer uses its own playback session (speaker). true inherits app session (often earpiece after PlayAndRecord/mic).
      const iosSpeechSession = Platform.OS === 'ios' ? { useApplicationAudioSession: false as const } : {};
      Speech.speak(text, {
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
