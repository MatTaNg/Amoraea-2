import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react-native';

import { PostInterviewLaunchScreen } from '../PostInterviewLaunchScreen';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@expo/vector-icons', () => ({
  Ionicons: (props: { name?: string }) => {
    const { Text } = require('react-native');
    return <Text>{props.name ?? ''}</Text>;
  },
}));

jest.mock('@app/screens/FlameOrb', () => ({
  FlameOrb: () => {
    const { View } = require('react-native');
    return <View />;
  },
}));

jest.mock('@features/psychometrics/DownloadPersonalReportButton', () => ({
  DownloadPersonalReportButton: () => {
    const { View } = require('react-native');
    return <View />;
  },
}));

jest.mock('@features/aria/hooks/useInterviewAttemptEgoRepair', () => ({
  useInterviewAttemptEgoRepair: jest.fn(),
}));

jest.mock('@features/authentication/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'applicant@example.com' } }),
}));

jest.mock('@features/onboarding/fetchLaunchWaitlistPassedCount', () => ({
  fetchLaunchWaitlistPassedCount: jest.fn(() => Promise.resolve(12)),
}));

jest.mock('@features/onboarding/usePostInterviewProfileCta', () => ({
  usePostInterviewProfileCta: () => ({
    profileCtaLoaded: true,
    profileCtaBusy: false,
    profileCtaLabel: 'Complete your profile',
    profileTimeEstimateLabel: '5-10 minutes',
    profileReadyForMatching: false,
    openProfileCta: jest.fn(() => Promise.resolve()),
  }),
}));

jest.mock('@react-navigation/native', () => {
  const React = require('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => {
      React.useEffect(() => cb(), [cb]);
    },
  };
});

jest.mock('@data/repos/usersRoutingRepo', () => ({
  clearReferralNoticePending: jest.fn(() => Promise.resolve()),
}));

jest.mock('@data/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } } })),
    },
    from: jest.fn(),
    rpc: jest.fn(() =>
      Promise.resolve({
        data: [{ cohort_average_final_score: 6.2, scored_user_count: 12 }],
        error: null,
      }),
    ),
  },
}));

jest.mock('@features/onboarding/loadInterviewReportAttempt', () => ({
  loadInterviewReportAttempt: jest.fn(() =>
    Promise.resolve({
      modified_weighted_score_with_psychometrics: 6.7,
    }),
  ),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));

const mockFetchReferralDiscountStatus = jest.fn();
jest.mock('@features/referrals/referralInterview', () => ({
  fetchReferralDiscountStatus: (...args: unknown[]) => mockFetchReferralDiscountStatus(...args),
}));

type ReferralStatus = {
  referralCode: string | null;
  signedUpWithReferral: boolean;
  completedReferrals: number;
  progressCurrent: number;
  progressTotal: number;
  remainingReferralsToCap: number;
  totalDiscount: number;
  atCap: boolean;
  fullyComplete: boolean;
};

const defaultStatus: ReferralStatus = {
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

const navigation = {
  replace: jest.fn(),
  dispatch: jest.fn(),
  navigate: jest.fn(),
};
const originalConsoleError = console.error.bind(console);
let consoleErrorSpy: jest.SpyInstance;
let queryClient: QueryClient;

function mockUserRoutingRow(referralNoticePending: string | null = null) {
  return {
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        maybeSingle: jest.fn(() =>
          Promise.resolve({
            data: { referral_notice_pending: referralNoticePending },
            error: null,
          }),
        ),
      })),
    })),
  };
}

function renderScreen() {
  return render(
    <QueryClientProvider client={queryClient}>
      <PostInterviewLaunchScreen
        navigation={navigation}
        route={{ params: { userId: 'user-1' } }}
      />
    </QueryClientProvider>,
  );
}

describe('PostInterviewLaunchScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.clear();
    mockFetchReferralDiscountStatus.mockResolvedValue(defaultStatus);
    const { supabase } = require('@data/supabase/client') as {
      supabase: { from: jest.Mock };
    };
    supabase.from.mockImplementation(() => mockUserRoutingRow());
    const { Animated } = require('react-native');
    jest.spyOn(Animated, 'timing').mockImplementation(
      (value: Animated.Value, config: Animated.TimingAnimationConfig) =>
        ({
          start: (callback?: Animated.EndCallback) => {
            value.setValue(Number(config.toValue));
            callback?.({ finished: true });
          },
          stop: jest.fn(),
          reset: jest.fn(),
        }) as unknown as Animated.CompositeAnimation,
    );
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      const first = args[0];
      if (typeof first === 'string' && first.includes('not wrapped in act')) {
        return;
      }
      originalConsoleError(...args);
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('shows 40% and a discount-based progress label for a non-referred user', async () => {
    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByText('40%')).toBeTruthy();
      expect(screen.getByText('40% toward 100% off')).toBeTruthy();
    });
  });

  it('shows 60% and a discount-based progress label for a referred user', async () => {
    mockFetchReferralDiscountStatus.mockResolvedValue({
      ...defaultStatus,
      signedUpWithReferral: true,
      progressTotal: 2,
      remainingReferralsToCap: 2,
      totalDiscount: 60,
    });
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem('@amoraea:post_interview_launch_referral_popup_seen:user-1', '1');

    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByText('60%')).toBeTruthy();
      expect(screen.getByText('60% toward 100% off')).toBeTruthy();
    });
  });

  it('replaces progress with the cap message at 100%', async () => {
    mockFetchReferralDiscountStatus.mockResolvedValue({
      ...defaultStatus,
      signedUpWithReferral: true,
      completedReferrals: 3,
      progressCurrent: 2,
      progressTotal: 2,
      remainingReferralsToCap: 0,
      totalDiscount: 100,
      atCap: true,
    });
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    await AsyncStorage.setItem('@amoraea:post_interview_launch_referral_popup_seen:user-1', '1');

    const screen = renderScreen();

    await waitFor(() => {
      expect(screen.getByText('100%')).toBeTruthy();
      expect(
        screen.getByText("You've unlocked the maximum discount. Every tier is 100% off for you."),
      ).toBeTruthy();
    });
  });
});
