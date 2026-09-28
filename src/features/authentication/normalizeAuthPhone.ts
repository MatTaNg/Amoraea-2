import { parsePhoneNumberFromString } from 'libphonenumber-js';

/** Normalize user-entered phone to E.164 for Supabase Auth (default US when no country code). */
export function normalizeAuthPhoneE164(
  raw: string,
  defaultCountry: 'US' = 'US',
): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed =
    parsePhoneNumberFromString(trimmed, defaultCountry) ?? parsePhoneNumberFromString(trimmed);
  if (!parsed?.isValid()) return null;
  return parsed.format('E.164');
}

export function formatAuthPhoneForDisplay(e164: string): string {
  const parsed = parsePhoneNumberFromString(e164);
  if (parsed) return parsed.formatNational();
  return e164;
}

export function isValidAuthPhoneInput(raw: string): boolean {
  return normalizeAuthPhoneE164(raw) != null;
}
