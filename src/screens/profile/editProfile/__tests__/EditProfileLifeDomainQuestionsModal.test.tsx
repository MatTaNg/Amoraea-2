import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { EditProfileLifeDomainQuestionsModal } from '../EditProfileLifeDomainQuestionsModal';

const inset = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

jest.mock('@/datingProfile/screens/onboarding/modals/lifeDomainQuestionSuggestion', () => ({
  submitLifeDomainQuestionSuggestion: jest.fn(() => Promise.resolve({ error: null })),
}));

import { submitLifeDomainQuestionSuggestion } from '@/datingProfile/screens/onboarding/modals/lifeDomainQuestionSuggestion';

describe('EditProfileLifeDomainQuestionsModal question suggestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reveals a question field and sends it to admin feedback', async () => {
    const screen = render(
      <SafeAreaProvider initialMetrics={inset}>
        <EditProfileLifeDomainQuestionsModal
          visible
          userId="user-1"
          domainId="finance"
          answers={{}}
          onAnswerChange={jest.fn()}
          onClose={jest.fn()}
        />
      </SafeAreaProvider>,
    );

    expect(screen.queryByPlaceholderText('What question should we ask in this life area?')).toBeNull();

    fireEvent.press(screen.getByLabelText('Suggest a question'));

    fireEvent.changeText(
      screen.getByPlaceholderText('What question should we ask in this life area?'),
      'How do you decide what to save each month?',
    );
    fireEvent.press(screen.getByLabelText('Send question suggestion'));

    await waitFor(() => {
      expect(submitLifeDomainQuestionSuggestion).toHaveBeenCalledWith(
        'user-1',
        'finance',
        'How do you decide what to save each month?',
      );
    });
    expect(screen.getByText('Thanks — your question was sent.')).toBeTruthy();
  });
});
