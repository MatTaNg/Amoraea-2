import { Platform } from 'react-native';

/**
 * True when the web app is **not** in a browser “secure context”.
 * Microphone (and some other APIs) are blocked on e.g. `http://192.168.x.x` or `http://yourdomain.com`
 * unless you use HTTPS, or `http://localhost` / `http://127.0.0.1` on the same machine.
 */
export function isWebInsecureDevUrl(): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return window.isSecureContext === false;
}

/** Private LAN-style hostnames where people often open `http://` from a phone for dev. */
function isLikelyLanDevHostname(hostname: string): boolean {
  if (!hostname) return false;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return false;
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    hostname.endsWith('.local')
  );
}

/**
 * Banner text when `isSecureContext` is false — explains why the mic cannot work and what to do.
 */
export function webInsecureContextHelpMessage(): string {
  const hostname =
    typeof window !== 'undefined' && typeof window.location?.hostname === 'string'
      ? window.location.hostname
      : '';

  const core =
    'Microphone needs HTTPS, not HTTP. Browsers only allow the mic on a secure page (https://), ' +
    'or on http://localhost when you run the app on the same computer.';

  if (isLikelyLanDevHostname(hostname)) {
    return (
      `${core}\n\n` +
      'You are on a LAN / HTTP URL (for example after npm run web:lan). That cannot use the mic on a phone.\n\n' +
      'Easiest HTTPS options:\n' +
      '- Terminal 1: npm run web — wait until Metro is up on port 8081.\n' +
      '- Terminal 2: npm run web:cf-tunnel — open the https://…trycloudflare.com URL on your phone (no Expo account).\n' +
      '- Or: npm run web:tunnel — use the https:// URL Expo prints (command is `expo start`, not `expo strt`). ' +
      'If tunnel fails: turn off VPN, allow Node.js in Windows Firewall, or use web:cf-tunnel instead.\n' +
      '- Or: npm run build:web and deploy the dist folder to Vercel/Netlify for HTTPS.'
    );
  }

  return (
    `${core} Open this site using https:// instead of http://, or configure your server or host to serve HTTPS.`
  );
}
