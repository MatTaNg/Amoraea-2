import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { AriaInterviewScreenRouter } from '@features/aria/screens/AriaInterviewScreenRouter';

function baseProps(
  overrides: Partial<React.ComponentProps<typeof AriaInterviewScreenRouter>> = {},
): React.ComponentProps<typeof AriaInterviewScreenRouter> {
  return {
    sessionExpired: false,
    interviewStatus: 'not_started',
    status: 'intro',
    fromValidationTrack: false,
    pendingCompletion: false,
    resumeLoadingVisible: false,
    resumeHydrationPending: false,
    shouldShowAdminPanel: false,
    alphaMode: false,
    analysisAttemptId: null,
    isAdmin: false,
    isAdminAccount: false,
    userId: 'user-1',
    hasSubmittedPostInterviewFeedback: false,
    showPostInterviewFeedback: false,
    postInterviewFeedbackError: null,
    postInterviewRatings: {} as never,
    postInterviewComments: {} as never,
    postInterviewGeneralFeedback: '',
    adminInterviewTopBar: null,
    micError: null,
    micPermission: 'prompt',
    micWarning: null,
    preInterviewConsentAge: false,
    preInterviewConsentData: false,
    interviewStartInFlight: false,
    interviewAttemptBootstrap: 'ready',
    supabase: {} as never,
    signOut: async () => undefined,
    setSessionExpired: () => undefined,
    setShowAdminPanel: () => undefined,
    setPostInterviewFeedbackError: () => undefined,
    setShowPostInterviewFeedback: () => undefined,
    setPostInterviewRatings: () => undefined,
    setPostInterviewComments: () => undefined,
    setPostInterviewGeneralFeedback: () => undefined,
    setMicError: () => undefined,
    setPreInterviewConsentAge: () => undefined,
    setPreInterviewConsentData: () => undefined,
    onboardingAutoStartRef: { current: false },
    handleInterviewSignOut: () => undefined,
    handleRetake: () => undefined,
    handleSubmitPostInterviewFeedback: () => undefined,
    handleBackToValidationReport: () => undefined,
    startInterview: async () => undefined,
    ...overrides,
  };
}

describe('AriaInterviewScreenRouter', () => {
  it('shows resume loading instead of Before you begin while hydration is pending', () => {
    render(<>{AriaInterviewScreenRouter(baseProps({ resumeHydrationPending: true }))}</>);
    expect(screen.getByText('Resuming your interview...')).toBeTruthy();
    expect(screen.queryByText('Before you begin')).toBeNull();
  });

  it('skips intro when interview is already in progress', () => {
    const result = AriaInterviewScreenRouter(
      baseProps({ status: 'intro', interviewStatus: 'in_progress' }),
    );
    expect(result).toBeNull();
  });
});
