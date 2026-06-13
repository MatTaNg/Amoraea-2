import {
  resolveInterviewStackBootstrap,
  shouldFetchPostInterviewDeferralSnapshot,
} from '../resolveInterviewStackBootstrap';
import { PSYCHOMETRICS_ENABLED } from '../interviewCompletionStatus';

describe('shouldFetchPostInterviewDeferralSnapshot', () => {
  it('returns false when psychometrics are still required', () => {
    expect(
      shouldFetchPostInterviewDeferralSnapshot(
        { screen: 'PsychometricAssessment' },
        true,
      ),
    ).toBe(false);
    expect(
      shouldFetchPostInterviewDeferralSnapshot({ screen: 'InterviewComplete' }, true),
    ).toBe(false);
    expect(
      shouldFetchPostInterviewDeferralSnapshot({ screen: 'PsychometricsComplete' }, true),
    ).toBe(false);
  });

  it('returns true when profile shows interview complete and psychometrics are done', () => {
    expect(
      shouldFetchPostInterviewDeferralSnapshot({ screen: 'PostInterview' }, true),
    ).toBe(true);
  });
});

describe('resolveInterviewStackBootstrap', () => {
  if (PSYCHOMETRICS_ENABLED) {
    it('keeps legacy users on PsychometricAssessment despite completed interview profile', () => {
      const result = resolveInterviewStackBootstrap({
        initialRoute: {
          screen: 'PsychometricAssessment',
          legacyPsychometricsMode: true,
          interviewAlreadyCompleted: true,
          needsMarketResearch: true,
        },
        profileShowsStandardInterviewComplete: true,
        deferralSnapshot: {
          completed_at: '2026-01-01T00:00:00Z',
          passed: true,
          override_status: null,
        },
        isAdminEmail: false,
        lockedPostInterviewRoute: null,
      });

      expect(result.initialRouteName).toBe('PsychometricAssessment');
      expect(result.legacyPsychometricsMode).toBe(true);
      expect(result.interviewAlreadyCompleted).toBe(true);
      expect(result.needsMarketResearch).toBe(true);
    });
  } else {
    it('legacy completed-interview users defer to post-interview reveal when psychometrics disabled', () => {
      const result = resolveInterviewStackBootstrap({
        initialRoute: {
          screen: 'PostInterview',
          legacyPsychometricsMode: false,
          interviewAlreadyCompleted: true,
          needsMarketResearch: true,
        },
        profileShowsStandardInterviewComplete: true,
        deferralSnapshot: {
          completed_at: '2026-01-01T00:00:00Z',
          passed: true,
          override_status: null,
        },
        isAdminEmail: false,
        lockedPostInterviewRoute: null,
      });

      expect(result.initialRouteName).not.toBe('PsychometricAssessment');
      expect(result.legacyPsychometricsMode).toBe(false);
      expect(result.interviewAlreadyCompleted).toBe(true);
    });
  }

  it('defers to post-interview reveal when psychometrics are complete', () => {
    const result = resolveInterviewStackBootstrap({
      initialRoute: {
        screen: 'PostInterview',
        legacyPsychometricsMode: false,
        interviewAlreadyCompleted: true,
        needsMarketResearch: false,
      },
      profileShowsStandardInterviewComplete: true,
      deferralSnapshot: {
        completed_at: '2026-01-01T00:00:00Z',
        passed: true,
        override_status: null,
      },
      isAdminEmail: false,
      lockedPostInterviewRoute: null,
    });

    expect(result.initialRouteName).not.toBe('PsychometricAssessment');
  });

  it('sends new users with incomplete interview to Aria when psychometrics disabled', () => {
    const result = resolveInterviewStackBootstrap({
      initialRoute: {
        screen: PSYCHOMETRICS_ENABLED ? 'PsychometricAssessment' : 'Aria',
        legacyPsychometricsMode: false,
        interviewAlreadyCompleted: false,
        needsMarketResearch: true,
      },
      profileShowsStandardInterviewComplete: false,
      deferralSnapshot: null,
      isAdminEmail: false,
      lockedPostInterviewRoute: null,
    });

    expect(result.initialRouteName).toBe(PSYCHOMETRICS_ENABLED ? 'PsychometricAssessment' : 'Aria');
    expect(result.legacyPsychometricsMode).toBe(false);
  });
});
