import React from 'react';

/** When set (e.g. modal profile onboarding from post-interview), header ← exits here instead of prev step. */
export const OnboardingHeaderExitContext = React.createContext<(() => void) | undefined>(
  undefined,
);

export function useOnboardingHeaderExit(): (() => void) | undefined {
  return React.useContext(OnboardingHeaderExitContext);
}
