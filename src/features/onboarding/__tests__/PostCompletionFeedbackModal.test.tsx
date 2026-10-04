import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { PostCompletionFeedbackModal } from '@features/onboarding/PostCompletionFeedbackModal';
import {
  POST_COMPLETION_FATIGUE_ONLY_OPTIONS,
  POST_COMPLETION_FEEDBACK_THANKS_BODY,
  POST_COMPLETION_FEEDBACK_THANKS_DONE_LABEL,
  POST_COMPLETION_FEEDBACK_THANKS_TITLE,
  POST_COMPLETION_QUESTIONS,
  POST_COMPLETION_SCENARIO_OPTIONS,
} from '@features/onboarding/postCompletionFeedback';

const mockSubmit = jest.fn(() => Promise.resolve({ error: null }));

jest.mock('@features/onboarding/postCompletionFeedback', () => {
  const actual = jest.requireActual('@features/onboarding/postCompletionFeedback');
  return {
    ...actual,
    submitPostCompletionFeedback: (...args: unknown[]) => mockSubmit(...args),
  };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

const inset = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

describe('PostCompletionFeedbackModal', () => {
  const onDismiss = jest.fn();
  const onSubmitted = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderModal() {
    return render(
      <SafeAreaProvider initialMetrics={inset}>
        <PostCompletionFeedbackModal
          visible
          userId="user-1"
          entryPoint="congrats"
          onDismiss={onDismiss}
          onSubmitted={onSubmitted}
        />
      </SafeAreaProvider>,
    );
  }

  it('does not submit on cancel and hides Next on choice questions', () => {
    renderModal();

    expect(screen.getByLabelText('Feedback progress').props.accessibilityValue).toEqual({
      min: 1,
      max: 8,
      now: 1,
    });
    expect(screen.queryByLabelText('Next question')).toBeNull();
    expect(screen.queryByLabelText('Submit feedback')).toBeNull();

    fireEvent.press(screen.getByLabelText('Cancel'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(mockSubmit).not.toHaveBeenCalled();
    expect(onSubmitted).not.toHaveBeenCalled();
  });

  it('keeps the psychometric-only options off questions 2 and 4', () => {
    renderModal();

    expect(
      screen.getByLabelText(`fatigue option ${POST_COMPLETION_FATIGUE_ONLY_OPTIONS[0]}`),
    ).toBeTruthy();
    expect(
      screen.getByLabelText(`fatigue option ${POST_COMPLETION_FATIGUE_ONLY_OPTIONS[1]}`),
    ).toBeTruthy();
    expect(screen.queryByText(POST_COMPLETION_QUESTIONS.redundant)).toBeNull();

    fireEvent.press(screen.getByLabelText(`fatigue option ${POST_COMPLETION_SCENARIO_OPTIONS[0]}`));
    expect(screen.queryByLabelText('Next question')).toBeNull();
    expect(screen.queryByLabelText(`redundant option ${POST_COMPLETION_FATIGUE_ONLY_OPTIONS[0]}`)).toBeNull();

    fireEvent.press(screen.getByLabelText(`redundant option ${POST_COMPLETION_SCENARIO_OPTIONS[0]}`));
    expect(screen.queryByLabelText('Next question')).toBeNull();
    fireEvent.press(screen.getByLabelText('trust score 8'));
    expect(screen.queryByLabelText(`unclear option ${POST_COMPLETION_FATIGUE_ONLY_OPTIONS[1]}`)).toBeNull();
    expect(screen.queryByLabelText('unclear other')).toBeNull();
    expect(screen.queryByLabelText('Next question')).toBeNull();
  });

  it('keeps one choice per question and omits free text on the first question', async () => {
    renderModal();

    expect(screen.queryByLabelText('fatigue other')).toBeNull();
    fireEvent.press(screen.getByLabelText(`fatigue option ${POST_COMPLETION_SCENARIO_OPTIONS[0]}`));
    expect(screen.getByText(POST_COMPLETION_QUESTIONS.redundant)).toBeTruthy();
    expect(screen.queryByLabelText('Cancel')).toBeNull();
    fireEvent.press(screen.getByLabelText('Previous question'));
    fireEvent.press(screen.getByLabelText(`fatigue option ${POST_COMPLETION_SCENARIO_OPTIONS[1]}`));

    expect(screen.queryByLabelText('redundant other')).toBeNull();
    fireEvent.press(screen.getByLabelText(`redundant option ${POST_COMPLETION_SCENARIO_OPTIONS[0]}`));
    expect(screen.getByText(POST_COMPLETION_QUESTIONS.trust)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Previous question'));
    fireEvent.press(screen.getByLabelText(`redundant option ${POST_COMPLETION_SCENARIO_OPTIONS[2]}`));
    fireEvent.press(screen.getByLabelText('trust score 9'));
    expect(screen.getByText(POST_COMPLETION_QUESTIONS.unclear)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Previous question'));
    fireEvent.press(screen.getByLabelText('trust score 4'));
    fireEvent.press(screen.getByLabelText(`unclear option ${POST_COMPLETION_SCENARIO_OPTIONS[0]}`));
    expect(screen.queryByLabelText('Next question')).toBeNull();
    fireEvent.press(screen.getByLabelText('difficulty score 6'));
    expect(screen.getByLabelText('Next question')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Next question'));
    expect(screen.getByText(POST_COMPLETION_QUESTIONS.bugs)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('interview bugs'), 'The mic cut out once');
    fireEvent.press(screen.getByLabelText('Next question'));
    fireEvent.press(screen.getByLabelText('Submit feedback'));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          draft: expect.objectContaining({
            fatigue: {
              selected: [POST_COMPLETION_SCENARIO_OPTIONS[1]],
              freeform: '',
            },
            redundant: {
              selected: [POST_COMPLETION_SCENARIO_OPTIONS[2]],
              freeform: '',
            },
            trust: 4,
            difficulty: 6,
            bugs: 'The mic cut out once',
          }),
        }),
      );
    });
    expect(onSubmitted).not.toHaveBeenCalled();
    expect(screen.getByText(POST_COMPLETION_FEEDBACK_THANKS_TITLE)).toBeTruthy();
    expect(screen.getByText(POST_COMPLETION_FEEDBACK_THANKS_BODY)).toBeTruthy();
    fireEvent.press(screen.getByLabelText(POST_COMPLETION_FEEDBACK_THANKS_DONE_LABEL));
    expect(onSubmitted).toHaveBeenCalledTimes(1);
  });
});
