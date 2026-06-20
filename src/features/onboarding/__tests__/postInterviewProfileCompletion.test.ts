import {
  POST_INTERVIEW_PROFILE_BENEFITS,
  POST_INTERVIEW_PROFILE_TIME_ESTIMATE,
  POST_INTERVIEW_LAUNCH_PROFILE_BENEFITS,
  POST_INTERVIEW_LAUNCH_PROFILE_LEAD,
} from '@features/onboarding/postInterviewProfileCompletion';

describe('postInterviewProfileCompletion', () => {
  it('exposes three profile completion benefits', () => {
    expect(POST_INTERVIEW_PROFILE_BENEFITS).toHaveLength(3);
  });

  it('uses a fixed 20–30 minute estimate', () => {
    expect(POST_INTERVIEW_PROFILE_TIME_ESTIMATE).toBe('Estimated time: about 20–30 minutes');
  });

  it('exposes launch waitlist profile copy', () => {
    expect(POST_INTERVIEW_LAUNCH_PROFILE_BENEFITS).toHaveLength(3);
    expect(POST_INTERVIEW_LAUNCH_PROFILE_LEAD).toMatch(/launch/i);
  });
});
