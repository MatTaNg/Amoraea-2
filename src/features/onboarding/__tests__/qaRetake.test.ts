import {
  QA_RETAKE_SIGNUP_CODE,
  isQaRetakeSignupCode,
  resetInterviewForQaRetake,
} from '../qaRetake';
import { supabase } from '@data/supabase/client';
import { clearInterviewFromStorage } from '@utilities/storage/InterviewStorage';

jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('@utilities/storage/InterviewStorage', () => ({
  clearInterviewFromStorage: jest.fn(() => Promise.resolve()),
}));

const fromMock = supabase.from as jest.Mock;

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
    it('increments attempt count, resets interview flags without touching score columns in payload, then clears storage', async () => {
      const single = jest.fn().mockResolvedValue({
        data: { interview_attempt_count: 2 },
        error: null,
      });
      const updateEq = jest.fn().mockResolvedValue({ error: null });
      const update = jest.fn((payload: Record<string, unknown>) => {
        expect(payload).toEqual({
          interview_completed: false,
          interview_last_checkpoint: 0,
          interview_attempt_count: 3,
          latest_attempt_id: null,
        });
        return { eq: updateEq };
      });
      const selectEq = jest.fn(() => ({ single }));
      const select = jest.fn(() => ({ eq: selectEq }));

      fromMock.mockImplementation(() => ({
        select,
        update,
      }));

      await resetInterviewForQaRetake('user-xyz');

      expect(fromMock).toHaveBeenCalledWith('users');
      expect(select).toHaveBeenCalledWith('interview_attempt_count');
      expect(selectEq).toHaveBeenCalledWith('id', 'user-xyz');
      expect(update).toHaveBeenCalled();
      expect(updateEq).toHaveBeenCalledWith('id', 'user-xyz');
      expect(clearInterviewFromStorage).toHaveBeenCalledWith('user-xyz');
    });

    it('defaults attempt count to 1 when user row has null count', async () => {
      const single = jest.fn().mockResolvedValue({
        data: { interview_attempt_count: null },
        error: null,
      });
      const updateEq = jest.fn().mockResolvedValue({ error: null });
      const update = jest.fn((payload: Record<string, unknown>) => {
        expect(payload.interview_attempt_count).toBe(1);
        return { eq: updateEq };
      });

      fromMock.mockImplementation(() => ({
        select: jest.fn(() => ({ eq: jest.fn(() => ({ single })) })),
        update,
      }));

      await resetInterviewForQaRetake('u1');
      expect(clearInterviewFromStorage).toHaveBeenCalledWith('u1');
    });

    it('throws when update returns error and does not clear storage', async () => {
      const single = jest.fn().mockResolvedValue({
        data: { interview_attempt_count: 0 },
        error: null,
      });
      const updateEq = jest.fn().mockResolvedValue({ error: { message: 'rls' } });
      const update = jest.fn(() => ({ eq: updateEq }));

      fromMock.mockImplementation(() => ({
        select: jest.fn(() => ({ eq: jest.fn(() => ({ single })) })),
        update,
      }));

      (clearInterviewFromStorage as jest.Mock).mockClear();

      await expect(resetInterviewForQaRetake('u1')).rejects.toEqual({ message: 'rls' });
      expect(clearInterviewFromStorage).not.toHaveBeenCalled();
    });
  });
});
