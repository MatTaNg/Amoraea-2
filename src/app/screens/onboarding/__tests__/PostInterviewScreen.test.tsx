import React from 'react';
import { Alert, Platform } from 'react-native';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PostInterviewScreen } from '../PostInterviewScreen';
import { supabase } from '@data/supabase/client';
import * as qaRetake from '@features/onboarding/qaRetake';

jest.mock('@utilities/storage/InterviewStorage', () => ({
  clearInterviewFromStorage: jest.fn(),
  saveInterviewToStorage: jest.fn(),
  loadInterviewFromStorage: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { Ionicons: (props: { name?: string }) => React.createElement(Text, null, props.name ?? '') };
});

jest.mock('@app/screens/FlameOrb', () => ({
  FlameOrb: () => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View);
  },
}));

jest.mock('@features/onboarding/qaRetake', () => ({
  ...jest.requireActual('@features/onboarding/qaRetake'),
  resetInterviewForQaRetake: jest.fn(() => Promise.resolve()),
}));

jest.mock('@data/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const getUserMock = supabase.auth.getUser as jest.Mock;
const fromMock = supabase.from as jest.Mock;

function tableChain() {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
  };
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const utils = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { client, ...utils };
}

describe('PostInterviewScreen', () => {
  const navigation = { replace: jest.fn() };

  beforeEach(() => {
    jest.clearAllMocks();
    fromMock.mockImplementation(() => tableChain());
    (qaRetake.resetInterviewForQaRetake as jest.Mock).mockResolvedValue(undefined);
  });

  it('does not show Retake test for a non-QA referral code', async () => {
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'auth-user-2',
          user_metadata: { referral_code: 'INVITE-123' },
        },
      },
    });

    const { queryByText } = renderWithClient(
      <PostInterviewScreen navigation={navigation} route={{ params: { userId: 'u2' } }} />
    );

    await waitFor(() => {
      expect(getUserMock).toHaveBeenCalled();
    });

    expect(queryByText(/Retake test/i)).toBeNull();
  });

  it('shows Retake test for QA signup (trim/case) and on confirm calls reset + navigates to Aria', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const retake = buttons?.find((b) => 'text' in b && b.text === 'Retake');
      (retake as { onPress?: () => void } | undefined)?.onPress?.();
    });

    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'auth-user-3',
          user_metadata: { referral_code: '  abc-qa  ' },
        },
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries');

    const { getByText, findByText } = render(
      <QueryClientProvider client={queryClient}>
        <PostInterviewScreen navigation={navigation} route={{ params: { userId: 'x' } }} />
      </QueryClientProvider>
    );

    await findByText('Retake test', {}, { timeout: 15_000 });

    fireEvent.press(getByText('Retake test'));

    await waitFor(() => {
      expect(qaRetake.resetInterviewForQaRetake).toHaveBeenCalledWith('auth-user-3');
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['profile', 'auth-user-3'] });
      expect(navigation.replace).toHaveBeenCalledWith('Aria', { userId: 'auth-user-3' });
    });

    alertSpy.mockRestore();
    invalidateSpy.mockRestore();
  });

  it('web: uses window.confirm before running retake', async () => {
    const prevOs = Platform.OS;
    // @ts-expect-error test override
    Platform.OS = 'web';

    const confirmMock = jest.fn(() => true);
    const prevWindow = global.window;
    // @ts-expect-error minimal window for branch under test
    global.window = { ...global.window, confirm: confirmMock };

    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'web-user',
          user_metadata: { referral_code: 'ABC-QA' },
        },
      },
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <PostInterviewScreen navigation={navigation} route={{ params: { userId: 'w' } }} />
      </QueryClientProvider>
    );

    await waitFor(() => expect(getByText(/Retake test/i)).toBeTruthy());
    fireEvent.press(getByText(/Retake test/i));

    await waitFor(() => {
      expect(confirmMock).toHaveBeenCalled();
      expect(qaRetake.resetInterviewForQaRetake).toHaveBeenCalledWith('web-user');
      expect(navigation.replace).toHaveBeenCalledWith('Aria', { userId: 'web-user' });
    });

    global.window = prevWindow;
    // @ts-expect-error restore
    Platform.OS = prevOs;
  });
});
