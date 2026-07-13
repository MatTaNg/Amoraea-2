import { Platform } from 'react-native';

import { finalizeInterviewMicAmbientOnTtsEnd, type PreInitTriggerDuring } from '@features/aria/utils/webInterviewMicPreInit';
import { getLocalDevPlaybackRateMultiplier } from './interviewTtsPlaybackRate';
import { kickInterviewMicPreInitForTtsPlayback } from './webInterviewMicPreInitKick';
import {
  clearWebSpeechSynthTabResumeState,
  markWebSpeechSynthTabResumeStarted,
} from './webSpeechSynthTabResume';

export type WebSpeechSynthesisResult = { ok: true } | { ok: false; error: string };

/** Cached browser voice so fallback TTS does not switch voices mid-interview. */
let cachedWebSpeechVoice: SpeechSynthesisVoice | null = null;

export function resetCachedWebSpeechVoice(): void {
  cachedWebSpeechVoice = null;
}

function pickStableWebSpeechVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  if (cachedWebSpeechVoice) return cachedWebSpeechVoice;
  const list = window.speechSynthesis.getVoices();
  const prefer =
    list.find((v) => /samantha|google us english|zira|karen|victoria/i.test(v.name) && /^en/i.test(v.lang)) ??
    list.find((v) => (v as SpeechSynthesisVoice & { localService?: boolean }).localService === true && /^en/i.test(v.lang)) ??
    list.find((v) => /^en(-|$)/i.test(v.lang)) ??
    null;
  cachedWebSpeechVoice = prefer;
  return prefer;
}

/** Web (esp. Mobile Safari): expo-speech often calls onError immediately — use the browser Speech Synthesis API instead. */
export function speakWithWebSpeechSynthesis(
  spokenText: string,
  onPlaybackStarted?: () => void,
  preInitTriggerDuring: PreInitTriggerDuring = 'tts_playback',
  playbackRateMultiplier: number = 1
): Promise<WebSpeechSynthesisResult> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      resolve({ ok: false, error: 'no-api' });
      return;
    }

    let settled = false;
    const timeoutMs = Math.min(120_000, Math.max(5_000, spokenText.length * 100));
    /** DOM `setTimeout` id is a number; avoid `NodeJS.Timeout` mismatch in mixed typings. */
    let timeoutId: number;
    const settle = (result: WebSpeechSynthesisResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(result);
    };
    timeoutId = window.setTimeout(() => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
      settle({ ok: false, error: 'timeout' });
    }, timeoutMs);

    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    const utter = new SpeechSynthesisUtterance(spokenText);
    utter.lang = 'en-US';
    utter.rate = Math.min(4, Math.max(0.5, 0.92 * playbackRateMultiplier));
    utter.pitch = 0.95;
    utter.onstart = () => {
      markWebSpeechSynthTabResumeStarted(spokenText);
      onPlaybackStarted?.();
      kickInterviewMicPreInitForTtsPlayback(preInitTriggerDuring);
    };
    utter.onend = () => {
      clearWebSpeechSynthTabResumeState();
      finalizeInterviewMicAmbientOnTtsEnd();
      settle({ ok: true });
    };
    utter.onerror = (ev) => {
      clearWebSpeechSynthTabResumeState();
      const code =
        typeof ev === 'object' && ev !== null && 'error' in ev
          ? String((ev as SpeechSynthesisErrorEvent).error)
          : 'unknown';
      settle({ ok: false, error: code });
    };
    const speakNow = () => {
      try {
        window.speechSynthesis.speak(utter);
      } catch {
        settle({ ok: false, error: 'throw' });
      }
    };
    const applyVoiceAndSpeak = () => {
      const en = pickStableWebSpeechVoice();
      if (en) utter.voice = en;
      speakNow();
    };
    if (window.speechSynthesis.getVoices().length > 0) {
      applyVoiceAndSpeak();
    } else {
      let voicesReady = false;
      const finishVoices = () => {
        if (voicesReady) return;
        voicesReady = true;
        window.speechSynthesis.removeEventListener?.('voiceschanged', onVc);
        applyVoiceAndSpeak();
      };
      const onVc = () => finishVoices();
      window.speechSynthesis.addEventListener?.('voiceschanged', onVc);
      setTimeout(() => {
        finishVoices();
      }, 400);
    }
  });
}

/**
 * Call **synchronously** from a tap handler (mic). iOS Safari requires speechSynthesis.speak in the user-gesture stack.
 */
export function trySpeakWebSpeechInUserGesture(spokenText: string, onDone?: () => void): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    void window.speechSynthesis.getVoices();
  } catch {
    /* ignore */
  }
  const utter = new SpeechSynthesisUtterance(spokenText);
  utter.lang = 'en-US';
  utter.rate = Math.min(4, Math.max(0.5, 0.92 * getLocalDevPlaybackRateMultiplier()));
  utter.pitch = 0.95;
  utter.volume = 1;
  utter.onend = () => {
    onDone?.();
  };
  utter.onerror = () => {
    onDone?.();
  };
  const list = window.speechSynthesis.getVoices();
  const en = list.find((v) => /^en(-|$)/i.test(v.lang));
  if (en) utter.voice = en;
  try {
    window.speechSynthesis.speak(utter);
  } catch {
    onDone?.();
  }
}
