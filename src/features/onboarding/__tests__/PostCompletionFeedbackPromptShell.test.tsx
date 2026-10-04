import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PostCompletionFeedbackPromptShell } from '@features/onboarding/PostCompletionFeedbackPromptShell';
import {
  POST_COMPLETION_FEEDBACK_DECLINE_LABEL,
  POST_COMPLETION_FEEDBACK_GIVE_LABEL,
  POST_COMPLETION_FEEDBACK_INTRO_BODY,
  POST_COMPLETION_FEEDBACK_INTRO_TITLE,
  POST_COMPLETION_QUESTIONS,
} from '@features/onboarding/postCompletionFeedback';
import {
  fetchUserLoginRoutingRow,
  resolveInterviewCompletedForUser,
} from '@features/psychometrics/interviewCompletionStatus';
import {
  markReferralCompletionCongratsPending,
  referralCompletionCongratsPendingKey,
  referralCompletionCongratsSeenKey,
} from '@features/referrals/referralCompletionCongratsStorage';

jest.mock('@features/psychometrics/interviewCompletionStatus', () => ({
  fetchUserLoginRoutingRow: jest.fn(() => Promise.resolve(null)),
  resolveInterviewCompletedForUser: jest.fn(() => Promise.resolve(false)),
}));

const mockSubmit = jest.fn(() => Promise.resolve({ error: null }));
const mockSubmittedAt = jest.fn(() => Promise.resolve<string | null>(null));

jest.mock('@features/onboarding/postCompletionFeedback', () => {
  const actual = jest.requireActual('@features/onboarding/postCompletionFeedback');
  return {
    ...actual,
    submitPostCompletionFeedback: (...args: unknown[]) => mockSubmit(...args),
    fetchPostCompletionFeedbackSubmittedAt: () => mockSubmittedAt(),
  };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

const inset = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderShell() {
  return render(
    <SafeAreaProvider initialMetrics={inset}>
      <PostCompletionFeedbackPromptShell userId="user-1" />
    </SafeAreaProvider>,
  );
}

describe('PostCompletionFeedbackPromptShell', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSubmittedAt.mockResolvedValue(null);
    (fetchUserLoginRoutingRow as jest.Mock).mockResolvedValue(null);
    (resolveInterviewCompletedForUser as jest.Mock).mockResolvedValue(false);
    await AsyncStorage.clear();
  });

  it('shows the feedback invitation instead of the referral-bonus popup after full completion', async () => {
    await AsyncStorage.setItem(referralCompletionCongratsPendingKey('user-1'), '1');

    renderShell();

    expect(await screen.findByText(POST_COMPLETION_FEEDBACK_INTRO_TITLE)).toBeTruthy();
    expect(screen.getByText(POST_COMPLETION_FEEDBACK_INTRO_BODY)).toBeTruthy();
    expect(screen.queryByText(/unlocked your discount/i)).toBeNull();
    expect(screen.queryByText('How to get more discounts:')).toBeNull();
  });

  it('routes No thanks to the congrats screen without opening the feedback form', async () => {
    await AsyncStorage.setItem(referralCompletionCongratsPendingKey('user-1'), '1');

    renderShell();

    fireEvent.press(await screen.findByText(POST_COMPLETION_FEEDBACK_DECLINE_LABEL));

    await waitFor(async () => {
      expect(screen.queryByText(POST_COMPLETION_FEEDBACK_INTRO_TITLE)).toBeNull();
      expect(screen.queryByText(POST_COMPLETION_QUESTIONS.fatigue)).toBeNull();
      expect(await AsyncStorage.getItem(referralCompletionCongratsSeenKey('user-1'))).toBe('1');
      expect(await AsyncStorage.getItem(referralCompletionCongratsPendingKey('user-1'))).toBeNull();
    });
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('opens the 7-question form from Give Feedback', async () => {
    await AsyncStorage.setItem(referralCompletionCongratsPendingKey('user-1'), '1');

    renderShell();

    fireEvent.press(await screen.findByText(POST_COMPLETION_FEEDBACK_GIVE_LABEL));

    expect(await screen.findByText(POST_COMPLETION_QUESTIONS.fatigue)).toBeTruthy();
    expect(screen.getByText('1 of 8')).toBeTruthy();
    expect(screen.queryByText(POST_COMPLETION_QUESTIONS.redundant)).toBeNull();
    expect(screen.queryByText(POST_COMPLETION_QUESTIONS.anythingElse)).toBeNull();
  });

  it('shows the invitation when completion becomes pending while the app stays open', async () => {
    renderShell();

    await expect(
      screen.findByText(POST_COMPLETION_FEEDBACK_INTRO_TITLE, {}, { timeout: 400 }),
    ).rejects.toThrow();

    await markReferralCompletionCongratsPending('user-1');

    expect(await screen.findByText(POST_COMPLETION_FEEDBACK_INTRO_TITLE)).toBeTruthy();
    expect(screen.getByText(POST_COMPLETION_FEEDBACK_INTRO_BODY)).toBeTruthy();
  });

  it('still shows after a previous referral dismissal when this completion is pending', async () => {
    await AsyncStorage.setItem(referralCompletionCongratsPendingKey('user-1'), '1');
    await AsyncStorage.setItem(referralCompletionCongratsSeenKey('user-1'), '1');

    renderShell();

    expect(await screen.findByText(POST_COMPLETION_FEEDBACK_INTRO_TITLE)).toBeTruthy();
  });

  it('does not show when feedback was already submitted', async () => {
    mockSubmittedAt.mockResolvedValue('2026-10-03T00:00:00.000Z');
    await AsyncStorage.setItem(referralCompletionCongratsPendingKey('user-1'), '1');

    renderShell();

    await expect(
      screen.findByText(POST_COMPLETION_FEEDBACK_INTRO_TITLE, {}, { timeout: 400 }),
    ).rejects.toThrow();
  });

  it('shows after both the interview and psychometrics are already complete', async () => {
    (fetchUserLoginRoutingRow as jest.Mock).mockResolvedValue({
      psychometrics_completed_at: '2026-10-03T00:00:00.000Z',
    });
    (resolveInterviewCompletedForUser as jest.Mock).mockResolvedValue(true);

    renderShell();

    expect(await screen.findByText(POST_COMPLETION_FEEDBACK_INTRO_TITLE)).toBeTruthy();
  });

  it('does not show when completion is not pending', async () => {
    renderShell();

    await expect(
      screen.findByText(POST_COMPLETION_FEEDBACK_INTRO_TITLE, {}, { timeout: 400 }),
    ).rejects.toThrow();
  });
});
