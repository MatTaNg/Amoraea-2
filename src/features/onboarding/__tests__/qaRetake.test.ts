import {
  QA_RETAKE_SIGNUP_CODE,
  isQaRetakeSignupCode,
  resetInterviewForQaRetake,
} from '../qaRetake';
import { enableInterviewRetake } from '@features/interview/interviewRetake';

jest.mock('@features/interview/interviewRetake', () => ({
  enableInterviewRetake: jest.fn(() => Promise.resolve()),
}));

describe('qaRetake', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isQaRetakeSignupCode', () => {
    it('returns true for exact ABC-QA', () => {
      expect(isQaRetakeSignupCode('ABC-QA')).toBe(true);
    });

    it('matches case-insensitively and ignores outer whitespace', () => {
      expect(isQaRetakeSignupCode('  abc-qa  ')).toBe(true);
    });

    it('returns false for other codes', () => {
      expect(isQaRetakeSignupCode('OTHER')).toBe(false);
      expect(isQaRetakeSignupCode('ABC-QB')).toBe(false);
    });

    it('returns false for null/undefined/non-string', () => {
      expect(isQaRetakeSignupCode(null)).toBe(false);
      expect(isQaRetakeSignupCode(undefined)).toBe(false);
      expect(isQaRetakeSignupCode('')).toBe(false);
    });

    it('exposes the canonical code constant', () => {
      expect(QA_RETAKE_SIGNUP_CODE).toBe('ABC-QA');
    });
  });

  describe('resetInterviewForQaRetake', () => {
    it('delegates to enableInterviewRetake', async () => {
      await resetInterviewForQaRetake('user-xyz');
      expect(enableInterviewRetake).toHaveBeenCalledWith('user-xyz');
    });
  });
});
