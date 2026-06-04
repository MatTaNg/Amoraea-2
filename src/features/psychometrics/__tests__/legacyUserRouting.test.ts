import {
  resolveInterviewStackScreenFromStatus,
} from '@features/psychometrics/interviewCompletionStatus';

describe('resolveInterviewStackScreenFromStatus', () => {
  it('legacy user (interview complete, no psychometrics) → PsychometricAssessment with legacy mode', () => {
    const result = resolveInterviewStackScreenFromStatus({
      psychometricsCompletedAt: null,
      interviewCompleted: true,
    });
    expect(result.screen).toBe('PsychometricAssessment');
    expect(result.legacyPsychometricsMode).toBe(true);
    expect(result.interviewAlreadyCompleted).toBe(true);
  });

  it('new user (nothing complete) → PsychometricAssessment without legacy mode', () => {
    const result = resolveInterviewStackScreenFromStatus({
      psychometricsCompletedAt: null,
      interviewCompleted: false,
    });
    expect(result.screen).toBe('PsychometricAssessment');
    expect(result.legacyPsychometricsMode).toBe(false);
    expect(result.interviewAlreadyCompleted).toBe(false);
  });

  it('both complete → post-interview route directly', () => {
    const result = resolveInterviewStackScreenFromStatus({
      psychometricsCompletedAt: '2026-01-01T00:00:00Z',
      interviewCompleted: true,
      postInterviewScreen: 'PostInterviewPassed',
    });
    expect(result.screen).toBe('PostInterviewPassed');
    expect(result.legacyPsychometricsMode).toBe(false);
    expect(result.interviewAlreadyCompleted).toBe(true);
  });

  it('psychometrics complete, interview not → Aria', () => {
    const result = resolveInterviewStackScreenFromStatus({
      psychometricsCompletedAt: '2026-01-01T00:00:00Z',
      interviewCompleted: false,
    });
    expect(result.screen).toBe('Aria');
    expect(result.legacyPsychometricsMode).toBe(false);
  });

  it('failed interview legacy user completes psychometrics → post-interview failed (not Aria)', () => {
    const result = resolveInterviewStackScreenFromStatus({
      psychometricsCompletedAt: '2026-06-01T00:00:00Z',
      interviewCompleted: true,
      postInterviewScreen: 'PostInterviewFailed',
    });
    expect(result.screen).toBe('PostInterviewFailed');
    expect(result.legacyPsychometricsMode).toBe(false);
  });
});

describe('isLegacyUserMissingPsychometrics (state)', () => {
  function isLegacyFromState(
    interviewCompleted: boolean,
    psychometricsCompletedAt: string | null,
  ): boolean {
    return interviewCompleted && psychometricsCompletedAt == null;
  }

  it('detects legacy when interview done and psychometrics timestamp missing', () => {
    expect(isLegacyFromState(true, null)).toBe(true);
    expect(isLegacyFromState(false, null)).toBe(false);
    expect(isLegacyFromState(true, '2026-01-01')).toBe(false);
  });
});
