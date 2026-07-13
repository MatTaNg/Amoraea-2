import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import { LifeDomainQuestionsEditModal } from '../LifeDomainQuestionsEditModal';

jest.mock('@/screens/profile/editProfile/lifeDomainProfileService', () => ({
  fetchLifeDomainAnswersMap: jest.fn(() => Promise.resolve({})),
  saveLifeDomainAnswersFromOnboarding: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/screens/profile/editProfile/BottomSheet', () => ({
  BottomSheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  OptionPickerTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/shared/components/profileFields/SingleChoiceOptionList', () => ({
  SingleChoiceOptionList: () => null,
}));

describe('LifeDomainQuestionsEditModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    {
      domainId: 'finance' as const,
      visibleOptionalQuestion: 'What are your financial goals?',
      hiddenRequiredQuestion: 'What is your yearly income?',
    },
    {
      domainId: 'intimacy' as const,
      visibleOptionalQuestion:
        'What does "good communication" look like for you? How do you know when you\'re communicating poorly?',
      hiddenRequiredQuestion: 'Where do you see yourself living in the future?',
    },
    {
      domainId: 'spirituality' as const,
      visibleOptionalQuestion:
        'What is your relationship to spirituality or your religion?',
      hiddenRequiredQuestion:
        'How many hours a week do you spend doing spiritual or religious practice?',
    },
    {
      domainId: 'family' as const,
      visibleOptionalQuestion: 'How many kids do you want?',
      hiddenRequiredQuestion: "What's your relationship with pets?",
    },
    {
      domainId: 'health' as const,
      visibleOptionalQuestion: 'What is your diet?',
      hiddenRequiredQuestion: 'How would you describe your sleep schedule?',
    },
  ])(
    'shows only optional questions for $domainId in edit-profile modal',
    async ({ domainId, visibleOptionalQuestion, hiddenRequiredQuestion }) => {
      const screen = render(
        <LifeDomainQuestionsEditModal
          visible
          userId="user-1"
          domainId={domainId}
          wantKids="Want kids"
          enforceRequired={false}
          questionScope="optional"
          onClose={jest.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(visibleOptionalQuestion)).toBeTruthy();
      });

      expect(screen.queryByText(hiddenRequiredQuestion)).toBeNull();
    },
  );

  it('shows all requested optional family follow-up questions in edit profile', async () => {
    const screen = render(
      <LifeDomainQuestionsEditModal
        visible
        userId="user-1"
        domainId="family"
        wantKids="Want kids"
        enforceRequired={false}
        questionScope="optional"
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('How many kids do you want?')).toBeTruthy();
      expect(screen.getByText('When do you want kids?')).toBeTruthy();
      expect(screen.getByText('Adoption preferences')).toBeTruthy();
      expect(
        screen.getByText('What are your thoughts on how children should be educated?'),
      ).toBeTruthy();
    });
  });
});
