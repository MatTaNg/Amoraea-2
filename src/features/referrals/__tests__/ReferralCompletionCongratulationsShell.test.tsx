import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ReferralCompletionCongratulationsShell } from '@features/referrals/ReferralCompletionCongratulationsShell';
import {
  REFERRAL_COMPLETION_CONGRATS_LEAD,
  REFERRAL_COMPLETION_CONGRATS_TITLE,
} from '@features/referrals/ReferralCompletionCongratulationsShell';
import {
  referralCompletionCongratsPendingKey,
  referralCompletionCongratsSeenKey,
} from '@features/referrals/referralCompletionCongratsStorage';
import { POST_INTERVIEW_LAUNCH_REFERRAL_EXPLANATION_TITLE } from '@features/referrals/PostInterviewLaunchReferralCard';

const mockFetchReferralDiscountStatus = jest.fn();

jest.mock('@features/referrals/referralInterview', () => ({
  fetchReferralDiscountStatus: (...args: unknown[]) => mockFetchReferralDiscountStatus(...args),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));

const completedStatus = {
  referralCode: 'ABC123',
  signedUpWithReferral: false,
  completedReferrals: 0,
  progressCurrent: 0,
  progressTotal: 3,
  remainingReferralsToCap: 3,
  totalDiscount: 40,
  atCap: false,
  fullyComplete: true,
};

describe('ReferralCompletionCongratulationsShell', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockFetchReferralDiscountStatus.mockResolvedValue(completedStatus);
  });

  it('shows the completion congratulations modal when pending and fully complete', async () => {
    await AsyncStorage.setItem(referralCompletionCongratsPendingKey('user-1'), '1');

    render(<ReferralCompletionCongratulationsShell userId="user-1" />);

    await waitFor(() => {
      expect(mockFetchReferralDiscountStatus).toHaveBeenCalledWith('user-1');
    });

    expect(await screen.findByText(REFERRAL_COMPLETION_CONGRATS_TITLE)).toBeTruthy();
    expect(screen.getByText(REFERRAL_COMPLETION_CONGRATS_LEAD)).toBeTruthy();
    expect(screen.getByText('40%')).toBeTruthy();
    expect(screen.getByText(POST_INTERVIEW_LAUNCH_REFERRAL_EXPLANATION_TITLE)).toBeTruthy();
  });

  it('marks the modal as seen and clears pending when dismissed', async () => {
    await AsyncStorage.setItem(referralCompletionCongratsPendingKey('user-1'), '1');

    render(<ReferralCompletionCongratulationsShell userId="user-1" />);

    fireEvent.press(await screen.findByText('Got it'));

    await waitFor(async () => {
      expect(await AsyncStorage.getItem(referralCompletionCongratsSeenKey('user-1'))).toBe('1');
      expect(await AsyncStorage.getItem(referralCompletionCongratsPendingKey('user-1'))).toBeNull();
    });
  });

  it('does not show when the pending flag is absent', async () => {
    render(<ReferralCompletionCongratulationsShell userId="user-1" />);

    await waitFor(() => {
      expect(mockFetchReferralDiscountStatus).not.toHaveBeenCalled();
    });

    expect(screen.queryByText(REFERRAL_COMPLETION_CONGRATS_TITLE)).toBeNull();
  });
});
