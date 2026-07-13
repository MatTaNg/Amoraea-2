import { Platform } from 'react-native';

/**
 * Facebook / Instagram / Line / LinkedIn in-app browsers run embedded WebViews where chunked PCM +
 * Web Audio overlaps badly with HTML audio after `visibilitychange` (garbled / static). Same pipeline
 * as desktop: MP3 fetch → HTMLAudio or Web Audio decode only.
 */
export function webEmbeddedInAppBrowserDiscouragesPcmStream(userAgent?: string): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (!ua) return false;
  if (/FBAN|FBAV|FBIOS|FB_IAB/i.test(ua)) return true;
  if (/Instagram/i.test(ua)) return true;
  if (/\bLine\//i.test(ua)) return true;
  if (/\bLinkedInApp\//i.test(ua)) return true;
  return false;
}

/**
 * iOS browsers (including Brave/Chrome/Firefox on iPhone/iPad) all use WebKit under the hood.
 * PCM streaming is static-prone there; force non-PCM paths like mobile Safari.
 */
export function isIosWebkitMobileWebLike(userAgent?: string): boolean {
  if (Platform.OS !== 'web') return false;
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (!ua) return false;
  const isIosDevice = /\b(iPhone|iPad|iPod)\b/i.test(ua);
  const isAppleWebKit = /\bAppleWebKit\/\d+/i.test(ua);
  const isMobile = /\bMobile\/\w+/i.test(ua) || /Mobi/i.test(ua);
  return isIosDevice && isAppleWebKit && isMobile;
}

/** Conservative guard: mobile browsers are more static-prone with PCM chunk scheduling. */
export function isAnyMobileWebBrowser(userAgent?: string): boolean {
  if (Platform.OS !== 'web') return false;
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (!ua) return false;
  return /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
}

/** Whether ElevenLabs PCM streaming should be avoided for the current browser environment. */
export function shouldDiscourageElevenLabsPcmStreamOnWeb(
  userAgent?: string,
  opts?: { isIosSafariMobileWeb?: () => boolean },
): boolean {
  if (Platform.OS !== 'web') return true;
  if (isAnyMobileWebBrowser(userAgent)) return true;
  if (opts?.isIosSafariMobileWeb?.()) return true;
  if (isIosWebkitMobileWebLike(userAgent)) return true;
  if (webEmbeddedInAppBrowserDiscouragesPcmStream(userAgent)) return true;
  return false;
}
