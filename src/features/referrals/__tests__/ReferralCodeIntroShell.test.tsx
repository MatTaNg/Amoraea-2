import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ReferralCodeIntroShell } from '@features/referrals/ReferralCodeIntroShell';
import { referralCodeIntroSeenStorageKey } from '@features/referrals/referralCodeIntroStorage';

const mockFetchReferralDiscountStatus = jest.fn();

jest.mock('@features/referrals/referralInterview', () => ({
  fetchReferralDiscountStatus: (...args: unknown[]) => mockFetchReferralDiscountStatus(...args),
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

    expect(await screen.findByText('Your referral code is ABC123')).toBeTruthy();
    expect(await screen.findByLabelText('Open referral code')).toBeTruthy();

    const seen = await AsyncStorage.getItem(referralCodeIntroSeenStorageKey('user-1'));
    expect(seen).toBe('1');
  });

  it('shows a bottom-left reopen button and opens the modal again', async () => {
    await AsyncStorage.setItem(referralCodeIntroSeenStorageKey('user-1'), '1');

    render(<ReferralCodeIntroShell userId="user-1" marketResearchComplete />);

    await waitFor(() => {
      expect(screen.getByLabelText('Open referral code')).toBeTruthy();
    });

    expect(screen.queryByText('Your referral code is ABC123')).toBeNull();

    fireEvent.press(screen.getByLabelText('Open referral code'));

    await waitFor(() => {
      expect(screen.getByText('Your referral code is ABC123')).toBeTruthy();
    });
  });

  it('does not render before market research is complete', async () => {
    render(<ReferralCodeIntroShell userId="user-1" marketResearchComplete={false} />);

    await waitFor(() => {
      expect(mockFetchReferralDiscountStatus).not.toHaveBeenCalled();
    });

    expect(screen.queryByLabelText('Open referral code')).toBeNull();
  });
});
