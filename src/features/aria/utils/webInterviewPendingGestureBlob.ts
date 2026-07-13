import { Platform } from 'react-native';

/** ElevenLabs MP3 `blob:` URL kept when `play()` hits autoplay policy; replay from mic tap in the user-gesture stack. */
let pendingWebGestureBlobUrl: string | null = null;

export function getPendingWebGestureBlobUrl(): string | null {
  return pendingWebGestureBlobUrl;
}

export function assignPendingWebGestureBlobUrl(url: string | null): void {
  pendingWebGestureBlobUrl = url;
}

export function hasPendingWebGestureBlobUrl(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!pendingWebGestureBlobUrl;
}

export function revokePendingWebGestureBlobUrlUnlessTabStash(tabStashObjectUrl: string | null): void {
  if (!pendingWebGestureBlobUrl) return;
  if (pendingWebGestureBlobUrl !== tabStashObjectUrl) {
    try {
      URL.revokeObjectURL(pendingWebGestureBlobUrl);
    } catch {
      /* ignore */
    }
  }
  pendingWebGestureBlobUrl = null;
}

export function resetWebInterviewPendingGestureBlob(): void {
  pendingWebGestureBlobUrl = null;
}
