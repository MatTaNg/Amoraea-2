import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

import { getWebInterviewTabRestoreStash } from './webInterviewTabRestoreStash';
import { clearHtmlAudioTabResumeState } from './webInterviewHtmlAudioTabRestoreOrchestration';
import {
  assignActiveWebHtmlAudioObjectUrl,
  clearActiveWebHtmlAudio,
  getActiveWebHtmlAudioObjectUrl,
  getActiveWebHtmlAudioRef,
} from './webInterviewActiveHtmlAudio';
import {
  bumpWebInterviewTtsScheduleEpoch,
  stopActiveWebBufferAndPcmPlayback,
  stopExtraWebInterviewPlaybackHooks,
} from './webInterviewWebAudioPlaybackSurface';
import { revokePendingWebGestureBlobUrlUnlessTabStash } from './webInterviewPendingGestureBlob';
import { stopNativeElevenLabsMp3Playback } from './nativeElevenLabsMp3Playback';

/** Stop web audio, expo-speech, and any in-progress native MP3 from a prior TTS call. */
export async function stopElevenLabsPlayback(): Promise<void> {
  if (Platform.OS === 'web') {
    stopExtraWebInterviewPlaybackHooks();
    clearHtmlAudioTabResumeState();
    bumpWebInterviewTtsScheduleEpoch();
  }
  if (Platform.OS === 'web') {
    revokePendingWebGestureBlobUrlUnlessTabStash(getWebInterviewTabRestoreStash()?.objectUrl ?? null);
  }
  if (Platform.OS === 'web') {
    stopActiveWebBufferAndPcmPlayback();
  }
  const activeHtmlAudio = getActiveWebHtmlAudioRef();
  if (Platform.OS === 'web' && activeHtmlAudio) {
    try {
      activeHtmlAudio.pause();
      activeHtmlAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
    clearActiveWebHtmlAudio();
  }
  const activeObjectUrl = getActiveWebHtmlAudioObjectUrl();
  if (Platform.OS === 'web' && activeObjectUrl) {
    const tabStashUrl = getWebInterviewTabRestoreStash()?.objectUrl ?? null;
    if (activeObjectUrl !== tabStashUrl) {
      try {
        URL.revokeObjectURL(activeObjectUrl);
      } catch {
        /* ignore */
      }
    }
    assignActiveWebHtmlAudioObjectUrl(null);
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
  Speech.stop();
  if (Platform.OS !== 'web') {
    await stopNativeElevenLabsMp3Playback();
  }
}

/** Stop any current TTS (including native MP3). Safe to fire-and-forget from UI handlers. */
export function stopElevenLabsSpeech(): void {
  void stopElevenLabsPlayback();
}
