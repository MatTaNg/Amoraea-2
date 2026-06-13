import {
  PSYCHOMETRICS_ENABLED,
  resolveInterviewStackScreenFromStatus,
} from '@features/psychometrics/interviewCompletionStatus';

describe('resolveInterviewStackScreenFromStatus', () => {
  if (PSYCHOMETRICS_ENABLED) {
    it('legacy user (interview complete, no psychometrics) → InterviewComplete congratulations', () => {
      const result = resolveInterviewStackScreenFromStatus({
        psychometricsCompletedAt: null,
        interviewCompleted: true,
      });
      expect(result.screen).toBe('InterviewComplete');
      expect(result.legacyPsychometricsMode).toBe(true);
      expect(result.interviewAlreadyCompleted).toBe(true);
    });

    it('new user (nothing complete) → Aria (interview first)', () => {
      const result = resolveInterviewStackScreenFromStatus({
        psychometricsCompletedAt: null,
        interviewCompleted: false,
      });
      expect(result.screen).toBe('Aria');
      expect(result.legacyPsychometricsMode).toBe(false);
      expect(result.interviewAlreadyCompleted).toBe(false);
    });

    it('both complete but gate not finalized → PsychometricsComplete', () => {
      const result = resolveInterviewStackScreenFromStatus({
        psychometricsCompletedAt: '2026-01-01T00:00:00Z',
        interviewCompleted: true,
        postInterviewScreen: 'PostInterviewPassed',
      });
      expect(result.screen).toBe('PsychometricsComplete');
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
  } else {
    it('legacy user (interview complete, no psychometrics) → post-interview, skipping battery', () => {
      const result = resolveInterviewStackScreenFromStatus({
        psychometricsCompletedAt: null,
        interviewCompleted: true,
        postInterviewScreen: 'PostInterviewPassed',
      });
      expect(result.screen).toBe('PostInterviewPassed');
      expect(result.legacyPsychometricsMode).toBe(false);
      expect(result.interviewAlreadyCompleted).toBe(true);
    });

    it('new user (nothing complete) → Aria (market research handled upstream)', () => {
      const result = resolveInterviewStackScreenFromStatus({
        psychometricsCompletedAt: null,
        interviewCompleted: false,
      });
      expect(result.screen).toBe('Aria');
      expect(result.legacyPsychometricsMode).toBe(false);
      expect(result.interviewAlreadyCompleted).toBe(false);
    });

    it('interview complete → post-interview regardless of psychometrics timestamp', () => {
      const result = resolveInterviewStackScreenFromStatus({
        psychometricsCompletedAt: '2026-01-01T00:00:00Z',
        interviewCompleted: true,
        postInterviewScreen: 'PostInterviewFailed',
      });
      expect(result.screen).toBe('PostInterviewFailed');
      expect(result.legacyPsychometricsMode).toBe(false);
    });

    it('psychometrics timestamp present but interview incomplete → Aria', () => {
      const result = resolveInterviewStackScreenFromStatus({
        psychometricsCompletedAt: '2026-01-01T00:00:00Z',
        interviewCompleted: false,
      });
      expect(result.screen).toBe('Aria');
      expect(result.legacyPsychometricsMode).toBe(false);
    });
  }

  it('failed interview legacy user completes psychometrics → post-interview failed (not Aria)', () => {
    if (!PSYCHOMETRICS_ENABLED) {
      const result = resolveInterviewStackScreenFromStatus({
        psychometricsCompletedAt: '2026-06-01T00:00:00Z',
        interviewCompleted: true,
        postInterviewScreen: 'PostInterviewFailed',
      });
      expect(result.screen).toBe('PostInterviewFailed');
      expect(result.legacyPsychometricsMode).toBe(false);
      return;
    }
    const result = resolveInterviewStackScreenFromStatus({
      psychometricsCompletedAt: '2026-06-01T00:00:00Z',
      interviewCompleted: true,
      postInterviewScreen: 'PostInterviewFailed',
    });
    expect(result.screen).toBe('PsychometricsComplete');
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
