const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** 7 alphanumeric characters, display as XXX-XXXX (matches DB `normalize_referral_code`). */
export function normalizeShareableReferralCode(raw: string): string | null {
  const alnum = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (alnum.length !== 7) return null;
  return `${alnum.slice(0, 3)}-${alnum.slice(3)}`;
}

export function generateShareableReferralCode(): string {
  let s = '';
  for (let i = 0; i < 7; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return normalizeShareableReferralCode(s)!;
}
