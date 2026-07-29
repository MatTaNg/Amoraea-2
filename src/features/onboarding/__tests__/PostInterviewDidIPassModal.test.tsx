import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { PostInterviewDidIPassModal } from '@features/onboarding/PostInterviewDidIPassModal';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

describe('PostInterviewDidIPassModal', () => {
  it('shows trailblazer copy and closes on Got it', () => {
    const onClose = jest.fn();
    render(<PostInterviewDidIPassModal visible onClose={onClose} />);

    expect(screen.getByText("We're Blazing New Trails Here!")).toBeTruthy();
    expect(screen.getByText(/When we reach 500 users/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Got it!'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
