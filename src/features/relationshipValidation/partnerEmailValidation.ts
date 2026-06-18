const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MAX_EMAIL_LENGTH = 254;

export function normalizePartnerEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidPartnerEmail(email: string): boolean {
  const trimmed = email.trim();
  if (!trimmed || trimmed.length > MAX_EMAIL_LENGTH) return false;
  if (/\s/.test(trimmed)) return false;
  return EMAIL_RE.test(trimmed);
}

/** Returns a user-facing error message, or null when the partner email is acceptable. */
export function getPartnerEmailValidationError(
  partnerEmail: string,
  userEmail: string | null | undefined,
): string | null {
  const trimmed = partnerEmail.trim();
  if (!trimmed) {
    return "Please enter your partner's email address.";
  }
  if (!isValidPartnerEmail(trimmed)) {
    return 'Please enter a valid email address.';
  }
  const normalizedPartner = normalizePartnerEmail(trimmed);
  const normalizedUser =
    typeof userEmail === 'string' && userEmail.trim() ? normalizePartnerEmail(userEmail) : null;
  if (normalizedUser && normalizedPartner === normalizedUser) {
    return "Please enter your partner's email — you cannot link with your own address.";
  }
  return null;
}
