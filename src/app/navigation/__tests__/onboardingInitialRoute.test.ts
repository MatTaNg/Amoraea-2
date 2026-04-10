import { getOnboardingInitialRoute, ALPHA_MODE } from '../onboardingInitialRoute';

describe('getOnboardingInitialRoute', () => {
  const opts = (hasAcknowledgedInterviewFraming: boolean, alphaMode?: boolean) => ({
    hasAcknowledgedInterviewFraming,
    ...(alphaMode !== undefined ? { alphaMode } : {}),
  });

  describe('Interview Framing vs skip (ack)', () => {
    it('returns InterviewFraming for interview stage when not acknowledged', () => {
      expect(
        getOnboardingInitialRoute({ onboardingStage: 'interview' }, opts(false))
      ).toBe('InterviewFraming');
    });

    it('returns OnboardingInterview when InterviewFraming would apply but user acknowledged framing', () => {
      expect(
        getOnboardingInitialRoute({ onboardingStage: 'interview' }, opts(true))
      ).toBe('OnboardingInterview');
    });

    it('returns Stage1BasicInfo when basic_info + InterviewFraming path + acknowledged', () => {
      expect(
        getOnboardingInitialRoute({ onboardingStage: 'basic_info' }, opts(true))
      ).toBe('Stage1BasicInfo');
    });
  });

  describe('alphaMode', () => {
    it('with alphaMode true, basic_info maps to InterviewFraming until ack', () => {
      expect(
        getOnboardingInitialRoute({ onboardingStage: 'basic_info' }, opts(false, true))
      ).toBe('InterviewFraming');
    });

    it('with alphaMode false, basic_info with gate1 + approved goes to Stage1BasicInfo', () => {
      expect(
        getOnboardingInitialRoute(
          {
            onboardingStage: 'basic_info',
            gate1Score: { x: 1 },
            applicationStatus: 'approved',
          },
          opts(false, false)
        )
      ).toBe('Stage1BasicInfo');
    });

    it('with alphaMode false, interview + approved goes to Stage1BasicInfo', () => {
      expect(
        getOnboardingInitialRoute(
          { onboardingStage: 'interview', applicationStatus: 'approved' },
          opts(false, false)
        )
      ).toBe('Stage1BasicInfo');
    });

    it('with alphaMode false, interview + gate1Score goes to PostInterview', () => {
      expect(
        getOnboardingInitialRoute(
          { onboardingStage: 'interview', gate1Score: { x: 1 } },
          opts(false, false)
        )
      ).toBe('PostInterview');
    });
  });

  describe('psychometrics & other stages', () => {
    it('psychometrics + approved → Gate2Reentry', () => {
      expect(
        getOnboardingInitialRoute(
          { onboardingStage: 'psychometrics', applicationStatus: 'approved' },
          opts(false)
        )
      ).toBe('Gate2Reentry');
    });

    it('psychometrics + under_review → UnderReview', () => {
      expect(
        getOnboardingInitialRoute(
          { onboardingStage: 'psychometrics', applicationStatus: 'under_review' },
          opts(false)
        )
      ).toBe('UnderReview');
    });

    it('psychometrics otherwise → PostInterview', () => {
      expect(
        getOnboardingInitialRoute({ onboardingStage: 'psychometrics' }, opts(false))
      ).toBe('PostInterview');
    });

    it('compatibility → Stage4Compatibility', () => {
      expect(
        getOnboardingInitialRoute({ onboardingStage: 'compatibility' }, opts(false))
      ).toBe('Stage4Compatibility');
    });

    it('complete → Stage1BasicInfo', () => {
      expect(
        getOnboardingInitialRoute({ onboardingStage: 'complete' }, opts(false))
      ).toBe('Stage1BasicInfo');
    });
  });

  it('defaults onboardingStage to interview', () => {
    expect(getOnboardingInitialRoute({}, opts(false))).toBe('InterviewFraming');
  });

  it('exports ALPHA_MODE for App parity', () => {
    expect(typeof ALPHA_MODE).toBe('boolean');
  });
});
