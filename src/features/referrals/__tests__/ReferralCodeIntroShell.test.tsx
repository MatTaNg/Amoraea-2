import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import {
  ReferralCodeIntroShell,
  isReferralCodeIntroSuppressedRoute,
} from '@features/referrals/ReferralCodeIntroShell';
import { referralCodeIntroSeenStorageKey } from '@features/referrals/referralCodeIntroStorage';
import {
  POST_INTERVIEW_LAUNCH_REFERRAL_EYEBROW,
  POST_INTERVIEW_LAUNCH_REFERRAL_EXPLANATION_TITLE,
  POST_INTERVIEW_LAUNCH_REFERRAL_PROSPECTIVE_EYEBROW,
  POST_INTERVIEW_LAUNCH_REFERRAL_PROSPECTIVE_BANNER,
} from '@features/referrals/PostInterviewLaunchReferralCard';

const mockFetchReferralDiscountStatus = jest.fn();

jest.mock('@features/referrals/referralInterview', () => ({
  ...jest.requireActual('@features/referrals/referralInterview'),
  fetchReferralDiscountStatus: (...args: unknown[]) => mockFetchReferralDiscountStatus(...args),
}));

jest.mock('@features/onboarding/postInterviewLaunchMode', () => ({
  isLaunchWaitlistPostInterviewModeEnabled: () => true,
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));

const defaultStatus = {
  referralCode: 'ABC123',
  signedUpWithReferral: false,
  completedReferrals: 0,
  progressCurrent: 0,
  progressTotal: 3,
  remainingReferralsToCap: 3,
  totalDiscount: 40,
  atCap: false,
  fullyComplete: false,
};

describe('ReferralCodeIntroShell', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockFetchReferralDiscountStatus.mockResolvedValue(defaultStatus);
  });

  it('auto-shows the referral modal once after market research completes', async () => {
    render(<ReferralCodeIntroShell userId="user-1" marketResearchComplete />);

    await waitFor(() => {
      expect(mockFetchReferralDiscountStatus).toHaveBeenCalledWith('user-1');
    });

    expect(await screen.findByText(POST_INTERVIEW_LAUNCH_REFERRAL_PROSPECTIVE_EYEBROW)).toBeTruthy();
    expect(await screen.findByText(POST_INTERVIEW_LAUNCH_REFERRAL_PROSPECTIVE_BANNER)).toBeTruthy();
    expect(await screen.findByText(POST_INTERVIEW_LAUNCH_REFERRAL_EXPLANATION_TITLE)).toBeTruthy();
    expect(await screen.findByText('ABC123')).toBeTruthy();
    expect(screen.getByLabelText('Open referral code')).toBeTruthy();

    expect(await AsyncStorage.getItem(referralCodeIntroSeenStorageKey('user-1'))).toBe('1');
  }, 10000);

  it('shows a bottom-left reopen button and opens the modal again', async () => {
    await AsyncStorage.setItem(referralCodeIntroSeenStorageKey('user-1'), '1');

    render(<ReferralCodeIntroShell userId="user-1" marketResearchComplete />);

    await waitFor(() => {
      expect(screen.getByLabelText('Open referral code')).toBeTruthy();
    });

    expect(screen.queryByText(POST_INTERVIEW_LAUNCH_REFERRAL_EYEBROW)).toBeNull();

    fireEvent.press(screen.getByLabelText('Open referral code'));

    await waitFor(() => {
      expect(screen.getByText(POST_INTERVIEW_LAUNCH_REFERRAL_PROSPECTIVE_EYEBROW)).toBeTruthy();
      expect(screen.getByText(POST_INTERVIEW_LAUNCH_REFERRAL_EXPLANATION_TITLE)).toBeTruthy();
      expect(screen.getByText('ABC123')).toBeTruthy();
    });
  });

  it('shows earned discount copy after the interview and psychometrics are complete', async () => {
    mockFetchReferralDiscountStatus.mockResolvedValue({
      ...defaultStatus,
      fullyComplete: true,
      totalDiscount: 60,
      signedUpWithReferral: true,
    });

    render(<ReferralCodeIntroShell userId="user-1" marketResearchComplete />);

    fireEvent.press(await screen.findByLabelText('Open referral code'));

    await waitFor(() => {
      expect(screen.getByText(POST_INTERVIEW_LAUNCH_REFERRAL_EYEBROW)).toBeTruthy();
      expect(screen.getByText('60%')).toBeTruthy();
    });
  });

  it('does not render before market research is complete', async () => {
    render(<ReferralCodeIntroShell userId="user-1" marketResearchComplete={false} />);

    await waitFor(() => {
      expect(mockFetchReferralDiscountStatus).not.toHaveBeenCalled();
    });

    expect(screen.queryByLabelText('Open referral code')).toBeNull();
  });

  it('does not render on PostInterviewLaunch (inline referral card owns that screen)', async () => {
    render(
      <ReferralCodeIntroShell userId="user-1" marketResearchComplete suppressReferralIntro />,
    );

    await waitFor(() => {
      expect(mockFetchReferralDiscountStatus).not.toHaveBeenCalled();
    });

    expect(screen.queryByLabelText('Open referral code')).toBeNull();
    expect(screen.queryByText(POST_INTERVIEW_LAUNCH_REFERRAL_EYEBROW)).toBeNull();
  });
});

describe('isReferralCodeIntroSuppressedRoute', () => {
  it('suppresses edit profile and nested onboarding routes', () => {
    expect(isReferralCodeIntroSuppressedRoute('DatingProfileEdit')).toBe(true);
    expect(isReferralCodeIntroSuppressedRoute('PostInterviewLaunch')).toBe(true);
    expect(isReferralCodeIntroSuppressedRoute('Amoraea')).toBe(false);

    const onboardingState = {
      stale: false,
      type: 'stack',
      key: 'root',
      index: 0,
      routeNames: ['DatingProfileOnboarding'],
      routes: [
        {
          key: 'onboarding',
          name: 'DatingProfileOnboarding',
          state: {
            stale: false,
            type: 'stack',
            key: 'onboarding-stack',
            index: 0,
            routeNames: ['DatingModals'],
            routes: [{ key: 'modals', name: 'DatingModals' }],
          },
        },
      ],
    } as const;

    expect(isReferralCodeIntroSuppressedRoute('DatingModals', onboardingState)).toBe(true);
  });
});
