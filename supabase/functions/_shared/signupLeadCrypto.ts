const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeSignupLeadEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidSignupLeadEmail(email: string): boolean {
  if (!email || email.length > 320) return false;
  return EMAIL_RE.test(email);
}

export function generateSignupLeadToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function hashSignupLeadToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token.trim());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
