import {
  INTERVIEW_RETAKE_COOLING_MONTHS,
  getInterviewRetakeEligibleAt,
  isSixMonthInterviewRetakeEligible,
  shouldShowPostInterviewRetake,
} from '../interviewRetake';

describe('interviewRetake eligibility', () => {
  it('adds six months to completion date', () => {
    const completed = new Date('2025-01-15T12:00:00Z');
    const eligible = getInterviewRetakeEligibleAt(completed);
    expect(eligible.getUTCMonth()).toBe((completed.getUTCMonth() + INTERVIEW_RETAKE_COOLING_MONTHS) % 12);
  });

  it('returns false before six months elapse', () => {
    const completedAt = '2026-01-01T00:00:00Z';
    const now = new Date('2026-06-30T23:59:59Z');
    expect(isSixMonthInterviewRetakeEligible(completedAt, now)).toBe(false);
  });

  it('returns true on or after six months', () => {
    const completedAt = '2025-06-01T00:00:00Z';
    const now = new Date('2025-12-01T00:00:00Z');
    expect(isSixMonthInterviewRetakeEligible(completedAt, now)).toBe(true);
  });

  it('shows retake for QA signup code', () => {
    expect(
      shouldShowPostInterviewRetake({
        referralSignupCode: 'ABC-QA',
        isQaRetakeSignupCode: (code) => code?.toUpperCase() === 'ABC-QA',
      }),
    ).toBe(true);
  });

  it('shows retake when admin allowed flag is set', () => {
    expect(
      shouldShowPostInterviewRetake({
        interviewRetakeAdminAllowedAt: '2026-05-01T00:00:00Z',
      }),
    ).toBe(true);
  });

  it('does not show retake for moderate recent completion without admin allow', () => {
    expect(
      shouldShowPostInterviewRetake({
        latestCompletedAttemptAt: '2026-05-01T00:00:00Z',
        now: new Date('2026-05-15T00:00:00Z'),
      }),
    ).toBe(false);
  });
});
