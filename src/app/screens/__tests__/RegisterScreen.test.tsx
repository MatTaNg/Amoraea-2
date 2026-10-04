import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RegisterScreen } from '../RegisterScreen';
import { REGISTER_PASSWORD_MIN_LENGTH_MESSAGE } from '@features/authentication/registerFormValidation';

jest.mock('@app/screens/FlameOrb', () => ({
  FlameOrb: () => {
    const { View } = require('react-native');
    return <View />;
  },
}));

jest.mock('@features/authentication/hooks/useAuth', () => ({
  AUTH_SMS_RESEND_COOLDOWN_MS: 60_000,
  useAuth: () => ({
    signUp: jest.fn(),
    resendConfirmationEmail: jest.fn(),
  }),
}));

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: {} }),
}));

jest.mock('@data/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock('@features/authentication/signupLead', () => ({
  persistSignupLeadToken: jest.fn(),
  readSignupLeadFromWebUrl: jest.fn(() => null),
  normalizeSignupLeadToken: jest.fn(() => null),
}));

const inset = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderRegister() {
  return render(
    <SafeAreaProvider initialMetrics={inset}>
      <RegisterScreen navigation={{ navigate: jest.fn() }} />
    </SafeAreaProvider>,
  );
}

describe('RegisterScreen', () => {
  it('keeps Create Account enabled and shows the password minimum-length error on submit', () => {
    renderRegister();

    fireEvent.press(screen.getByText('Create Account →'));

    expect(screen.getByText(REGISTER_PASSWORD_MIN_LENGTH_MESSAGE)).toBeTruthy();
    expect(screen.getByText('Please enter your email.')).toBeTruthy();
    expect(screen.getByText('Please confirm your password.')).toBeTruthy();
    expect(screen.getByText('Please enter your age.')).toBeTruthy();
    expect(screen.getByText('Please select a gender.')).toBeTruthy();
  });

  it('shows the password minimum-length error when the password is too short', () => {
    renderRegister();

    fireEvent.changeText(screen.getByPlaceholderText('Email'), 'join@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('Password'), 'short');
    fireEvent.changeText(screen.getByPlaceholderText('Confirm password'), 'short');
    fireEvent.changeText(screen.getByPlaceholderText('Age'), '28');
    fireEvent.press(screen.getByLabelText('Select gender'));
    fireEvent.press(screen.getByText('Female'));
    fireEvent.press(screen.getByText('Create Account →'));

    expect(screen.getByText(REGISTER_PASSWORD_MIN_LENGTH_MESSAGE)).toBeTruthy();
  });
});
