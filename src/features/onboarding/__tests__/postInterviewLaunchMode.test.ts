import {
  LAUNCH_WAITLIST_USER_GOAL,
  LAUNCH_WAITLIST_VALUE_PROPS,
  mapInterviewStackRouteForLaunchMode,
  mapPostInterviewStackRouteForLaunchMode,
  standardApplicantPostInterviewDestination,
} from '../postInterviewLaunchMode';

describe('postInterviewLaunchMode', () => {
  it('routes standard applicants to PostInterviewLaunch while mode is enabled', () => {
    expect(standardApplicantPostInterviewDestination()).toBe('PostInterviewLaunch');
    expect(mapPostInterviewStackRouteForLaunchMode('PostInterviewPassed')).toBe('PostInterviewLaunch');
    expect(mapPostInterviewStackRouteForLaunchMode('PostInterviewFailed')).toBe('PostInterviewLaunch');
    expect(mapPostInterviewStackRouteForLaunchMode('PostInterviewProcessing')).toBe('PostInterviewLaunch');
    expect(mapInterviewStackRouteForLaunchMode('PostInterview')).toBe('PostInterviewLaunch');
    expect(mapInterviewStackRouteForLaunchMode('Amoraea')).toBe('Amoraea');
  });

  it('uses 500 as the launch waitlist goal', () => {
    expect(LAUNCH_WAITLIST_USER_GOAL).toBe(500);
  });

  it('exposes three launch value props for the waitlist counter card', () => {
    expect(LAUNCH_WAITLIST_VALUE_PROPS).toHaveLength(3);
    expect(LAUNCH_WAITLIST_VALUE_PROPS[0]).toMatch(/compatibility matching/i);
  });
});
