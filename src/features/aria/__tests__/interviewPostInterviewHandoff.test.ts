import {
  replaceWithStandardApplicantPostInterviewHandoffForUser,
} from '@features/aria/interviewPostInterviewHandoff';
import {
  markPsychometricsInterviewHandoffIssued,
  resetCompletionScoringSession,
} from '@features/aria/completionScoringKick';

jest.mock('@features/psychometrics/interviewCompletionStatus', () => ({
  PSYCHOMETRICS_ENABLED: true,
  fetchMostRecentCompletedInterviewAttemptId: jest.fn().mockResolvedValue(null),
}));

jest.mock('@features/onboarding/triggerAsyncAiReasoningPipeline', () => ({
  triggerAsyncAiReasoningPipeline: jest.fn(),
}));

jest.mock('@features/relationshipValidation/validationPostInterviewRouting', () => ({
  isValidationTrackInterviewHandoffActive: jest.fn(() => false),
  VALIDATION_POST_INTERVIEW_HANDOFF_ROUTE: 'ValidationPostInterviewProcessing',
}));

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn(),
}));

describe('replaceWithStandardApplicantPostInterviewHandoffForUser', () => {
  beforeEach(() => {
    resetCompletionScoringSession();
  });

  it('navigates to InterviewComplete once and skips later handoffs', () => {
    const replace = jest.fn();
    replaceWithStandardApplicantPostInterviewHandoffForUser({ replace }, 'user-1', {
      source: 'test_first_handoff',
    });
    replaceWithStandardApplicantPostInterviewHandoffForUser({ replace }, 'user-1', {
      source: 'test_duplicate_handoff',
    });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('InterviewComplete', { userId: 'user-1' });
  });

  it('does not navigate again when a handoff was already marked', () => {
    markPsychometricsInterviewHandoffIssued();
    const replace = jest.fn();
    replaceWithStandardApplicantPostInterviewHandoffForUser({ replace }, 'user-1', {
      source: 'test_duplicate_handoff',
    });
    expect(replace).not.toHaveBeenCalled();
  });
});
