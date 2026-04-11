import { Platform } from 'react-native';

/**
 * Browsers only expose microphone / some media APIs in a **secure context** (HTTPS, or
 * http://localhost / http://127.0.0.1). Opening the dev server as http://192.168.x.x:8081
 * is **not** secure — getUserMedia fails and the mic appears dead.
 */
export function isWebInsecureDevUrl(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return window.isSecureContext === false;
}

export function webInsecureContextHelpMessage(): string {
  return (
    'Microphone needs HTTPS. This http:// LAN URL is blocked. ' +
    'Expo does not print a separate "https" line for web: "Web is waiting on http://localhost:8081" is only for your computer. ' +
    'The tunnel URL is in the next line — "Metro waiting on exp+…" — inside the query string as url=https%3A%2F%2F… ' +
    'Decode that (it is https://YOUR-TUNNEL.exp.direct) and open it in Brave on your phone. ' +
    'The QR code opens a dev build / Expo Go, not this web page.'
  );
}
