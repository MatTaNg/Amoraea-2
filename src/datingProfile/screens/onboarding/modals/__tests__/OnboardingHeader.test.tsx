import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { OnboardingHeader } from '../components/OnboardingHeader';
import { OnboardingHeaderExitContext } from '../components/onboardingHeaderExitContext';

describe('OnboardingHeader', () => {
  it('header arrow calls exit handler from context instead of onBack', () => {
    const onBack = jest.fn();
    const onExit = jest.fn();

    const screen = render(
      <OnboardingHeaderExitContext.Provider value={onExit}>
        <OnboardingHeader title="Test step" onBack={onBack} />
      </OnboardingHeaderExitContext.Provider>,
    );

    fireEvent.press(screen.getByLabelText('Return to interview results'));

    expect(onExit).toHaveBeenCalledTimes(1);
    expect(onBack).not.toHaveBeenCalled();
  });

  it('falls back to onBack when exit context is unset', () => {
    const onBack = jest.fn();

    const screen = render(<OnboardingHeader title="Test step" onBack={onBack} />);

    fireEvent.press(screen.getByLabelText('Go back'));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows header arrow when only exit context is set', () => {
    const onExit = jest.fn();

    const screen = render(
      <OnboardingHeaderExitContext.Provider value={onExit}>
        <OnboardingHeader title="Life Domain Priorities" />
      </OnboardingHeaderExitContext.Provider>,
    );

    fireEvent.press(screen.getByLabelText('Return to interview results'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
