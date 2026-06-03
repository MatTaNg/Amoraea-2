import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { LifeDomainQuestionsModal } from '../LifeDomainQuestionsModal';

jest.mock('@/screens/profile/editProfile/lifeDomainProfileService', () => ({
  fetchLifeDomainAnswersMap: jest.fn(() => Promise.resolve({})),
  saveLifeDomainAnswersFromOnboarding: jest.fn(() => Promise.resolve()),
  syncLifeDomainImportanceFromOnboarding: jest.fn(() => Promise.resolve()),
}));

jest.mock('../components/OnboardingHeader', () => ({
  OnboardingHeader: () => null,
}));

jest.mock('@/screens/profile/editProfile/BottomSheet', () => ({
  BottomSheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  OptionPickerTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/shared/components/profileFields/SingleChoiceOptionList', () => ({
  SingleChoiceOptionList: () => null,
}));

import { saveLifeDomainAnswersFromOnboarding } from '@/screens/profile/editProfile/lifeDomainProfileService';

describe('LifeDomainQuestionsModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function renderModal(
    domainId: 'finance' | 'family' | 'intimacy' | 'spirituality' | 'health' = 'finance',
    props?: Partial<React.ComponentProps<typeof LifeDomainQuestionsModal>>,
  ) {
    return render(
      <LifeDomainQuestionsModal
        userId="user-1"
        domainId={domainId}
        enforceRequired={false}
        onNext={jest.fn()}
        onBack={jest.fn()}
        {...props}
      />,
    );
  }

  it('does not show question suggestion UI during onboarding', async () => {
    const screen = renderModal('finance', { optionalOpenEndedLeftover: true });
    await waitFor(() => {
      expect(screen.queryByText('Do you have a question suggestion?')).toBeNull();
    });
  });

  it('saves life domain answers on Next', async () => {
    const onNext = jest.fn();
    const screen = renderModal('finance', { optionalOpenEndedLeftover: true, onNext });
    await waitFor(() => {
      expect(screen.getByText('Next')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Next'));

    await waitFor(() => {
      expect(saveLifeDomainAnswersFromOnboarding).toHaveBeenCalledWith('user-1', expect.any(Object));
      expect(onNext).toHaveBeenCalled();
    });
  });
});
