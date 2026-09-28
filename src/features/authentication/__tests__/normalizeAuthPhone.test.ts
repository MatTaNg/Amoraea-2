import { normalizeAuthPhoneE164 } from '@features/authentication/normalizeAuthPhone';

describe('normalizeAuthPhoneE164', () => {
  it('normalizes US 10-digit numbers to E.164', () => {
    expect(normalizeAuthPhoneE164('4155552671')).toBe('+14155552671');
  });

  it('accepts numbers already in E.164', () => {
    expect(normalizeAuthPhoneE164('+14155552671')).toBe('+14155552671');
  });

  it('returns null for invalid input', () => {
    expect(normalizeAuthPhoneE164('123')).toBeNull();
    expect(normalizeAuthPhoneE164('')).toBeNull();
  });
});
