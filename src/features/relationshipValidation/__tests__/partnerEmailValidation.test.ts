import { describe, expect, it } from 'vitest';
import {
  getPartnerEmailValidationError,
  isValidPartnerEmail,
  normalizePartnerEmail,
} from '../partnerEmailValidation';

describe('partner email validation', () => {
  const userEmail = 'jordan@example.com';

  it('rejects empty input', () => {
    expect(getPartnerEmailValidationError('', userEmail)).toMatch(/enter your partner/i);
  });

  it('rejects malformed emails', () => {
    expect(isValidPartnerEmail('not-an-email')).toBe(false);
    expect(isValidPartnerEmail('missing@domain')).toBe(false);
    expect(getPartnerEmailValidationError('not-an-email', userEmail)).toMatch(/valid email/i);
  });

  it('accepts well-formed partner emails', () => {
    expect(getPartnerEmailValidationError('partner@example.com', userEmail)).toBeNull();
  });

  it('rejects linking with the user own email (case-insensitive)', () => {
    expect(getPartnerEmailValidationError('Jordan@Example.com', userEmail)).toMatch(/cannot link with your own/i);
    expect(getPartnerEmailValidationError('  jordan@example.com  ', userEmail)).toMatch(/cannot link with your own/i);
  });

  it('normalizes emails for comparison', () => {
    expect(normalizePartnerEmail('  Partner@Example.COM ')).toBe('partner@example.com');
  });
});
