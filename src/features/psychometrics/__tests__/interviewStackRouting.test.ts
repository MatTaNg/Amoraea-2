import { resolveInterviewStackScreenFromStatus } from '../interviewCompletionStatus';

describe('resolveInterviewStackScreenFromStatus (psychometrics enabled)', () => {
  it('routes incomplete interview to AssessmentWelcome', () => {
    expect(
      resolveInterviewStackScreenFromStatus(
        {
          interviewCompleted: false,
          psychometricsCompletedAt: null,
          gateResultFinalizedAt: null,
        },
        true,
      ),
    ).toEqual({
      screen: 'AssessmentWelcome',
      legacyPsychometricsMode: false,
      interviewAlreadyCompleted: false,
    });
  });

  it('routes interview complete without psychometrics to InterviewComplete', () => {
    expect(
      resolveInterviewStackScreenFromStatus(
        {
          interviewCompleted: true,
          psychometricsCompletedAt: null,
          gateResultFinalizedAt: null,
        },
        true,
      ),
    ).toEqual({
      screen: 'InterviewComplete',
      legacyPsychometricsMode: true,
      interviewAlreadyCompleted: true,
    });
  });

  it('routes psychometrics complete without gate finalization to PsychometricsComplete', () => {
    expect(
      resolveInterviewStackScreenFromStatus(
        {
          interviewCompleted: true,
          psychometricsCompletedAt: '2026-06-01T12:00:00Z',
          gateResultFinalizedAt: null,
        },
        true,
      ),
    ).toEqual({
      screen: 'PsychometricsComplete',
      legacyPsychometricsMode: false,
      interviewAlreadyCompleted: true,
    });
  });

  it('routes finalized gate to post-interview screen', () => {
    expect(
      resolveInterviewStackScreenFromStatus(
        {
          interviewCompleted: true,
          psychometricsCompletedAt: '2026-06-01T12:00:00Z',
          gateResultFinalizedAt: '2026-06-01T12:00:05Z',
          postInterviewScreen: 'PostInterviewPassed',
        },
        true,
      ),
    ).toEqual({
      screen: 'PostInterviewPassed',
      legacyPsychometricsMode: false,
      interviewAlreadyCompleted: true,
    });
  });

  it('keeps legacy production routing when psychometrics disabled', () => {
    expect(
      resolveInterviewStackScreenFromStatus(
        {
          interviewCompleted: true,
          psychometricsCompletedAt: null,
          gateResultFinalizedAt: null,
        },
        false,
      ),
    ).toEqual({
      screen: 'PostInterview',
      legacyPsychometricsMode: false,
      interviewAlreadyCompleted: true,
    });
  });
});
