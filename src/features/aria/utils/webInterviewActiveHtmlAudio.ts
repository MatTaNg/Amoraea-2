import { Platform } from 'react-native';

export type ActiveWebHtmlAudioLike = {
  pause(): void;
  currentTime: number;
  ended?: boolean;
  duration?: number;
  volume?: number;
};

let activeWebAudio: ActiveWebHtmlAudioLike | null = null;
let activeWebHtmlAudioObjectUrl: string | null = null;

export function getActiveWebHtmlAudioRef(): ActiveWebHtmlAudioLike | null {
  return activeWebAudio;
}

export function getActiveWebHtmlAudioElement(): HTMLAudioElement | null {
  if (Platform.OS !== 'web' || !activeWebAudio) return null;
  const el = activeWebAudio as HTMLAudioElement;
  if (typeof el.play !== 'function' || typeof el.pause !== 'function') return null;
  return el;
}

export function assignActiveWebHtmlAudio(audio: ActiveWebHtmlAudioLike | null): void {
  activeWebAudio = audio;
}

export function clearActiveWebHtmlAudio(): void {
  activeWebAudio = null;
}

export function getActiveWebHtmlAudioObjectUrl(): string | null {
  return activeWebHtmlAudioObjectUrl;
}

export function assignActiveWebHtmlAudioObjectUrl(url: string | null): void {
  activeWebHtmlAudioObjectUrl = url;
}

export function clearActiveWebHtmlAudioObjectUrlIfMatches(url: string): void {
  if (activeWebHtmlAudioObjectUrl === url) {
    activeWebHtmlAudioObjectUrl = null;
  }
}

/** Volume of the active web HTML audio element — for session telemetry only. */
export function getActiveWebHtmlAudioVolumeForTelemetry(): number | null {
  if (Platform.OS !== 'web' || !activeWebAudio) return null;
  try {
    const v = activeWebAudio.volume;
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

export function resetWebInterviewActiveHtmlAudio(): void {
  activeWebAudio = null;
  activeWebHtmlAudioObjectUrl = null;
}
