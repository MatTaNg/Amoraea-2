import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PsychometricAssessmentScreen } from '../PsychometricAssessmentScreen';

jest.mock('@/shared/hooks/AuthProvider', () => ({
  useAuth: () => ({ user: { id: 'user-1', email: 'person@example.com' } }),
}));

const userRow = {
  market_research_completed_at: '2026-01-01T00:00:00Z',
  psychometrics_completed_at: null as string | null,
  psychometrics_current_assessment: null as string | null,
  psychometrics_current_question_index: null as number | null,
  psychometrics_partial_responses: null as Record<string, number> | null,
};

jest.mock('@data/supabase/client', () => {
  const query: {
    select: () => typeof query;
    eq: () => Promise<{ error: null }> & typeof query;
    update: () => typeof query;
    single: () => Promise<{ data: typeof userRow; error: null }>;
    maybeSingle: () => Promise<{ data: null; error: null }>;
  } = {
    select: () => query,
    eq: () => Object.assign(Promise.resolve({ error: null }), query),
    update: () => query,
    single: () => Promise.resolve({ data: userRow, error: null }),
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  };
  return {
    supabase: {
      from: () => query,
      auth: {
        getSession: () => new Promise(() => {}),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      },
    },
  };
});

const inset = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderAssessment() {
  const navigation = { replace: jest.fn() };
  render(
    <SafeAreaProvider initialMetrics={inset}>
      <PsychometricAssessmentScreen
        navigation={navigation}
        route={{
          params: {
            userId: 'user-1',
            interviewAlreadyCompleted: true,
            legacyPsychometricsMode: true,
          },
        }}
      />
    </SafeAreaProvider>,
  );
  return navigation;
}

describe('PsychometricAssessmentScreen after the interview', () => {
  beforeEach(() => {
    userRow.psychometrics_current_assessment = null;
    userRow.psychometrics_current_question_index = null;
    userRow.psychometrics_partial_responses = null;
  });

  it('returns to the congratulations screen from the top arrow and keeps question back on the first item', async () => {
    const navigation = renderAssessment();
    expect(await screen.findByText('I tend to bounce back quickly after hard times.')).toBeTruthy();
    expect(screen.getByLabelText('Previous question')).toBeDisabled();

    fireEvent.press(screen.getByLabelText('Back to previous screen'));
    expect(navigation.replace).toHaveBeenCalledWith('InterviewComplete', { userId: 'user-1' });
  });

  it('uses the bottom back button to return to the previous question', async () => {
    userRow.psychometrics_current_assessment = 'brs';
    userRow.psychometrics_current_question_index = 1;
    userRow.psychometrics_partial_responses = { 1: 4 };

    renderAssessment();
    expect(await screen.findByText('I have a hard time making it through stressful events.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Previous question'));
    await waitFor(() => {
      expect(screen.getByText('I tend to bounce back quickly after hard times.')).toBeTruthy();
    });
  });
});
