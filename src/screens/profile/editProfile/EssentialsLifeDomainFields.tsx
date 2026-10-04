import React from 'react';
import { AppSelect } from '@/shared/ui/AppSelect';
import { getEssentialsProfileQuestions } from '@/shared/constants/lifeDomainOnboardingQuestions';
import type { LifeDomainId } from '@/shared/constants/lifeDomainOnboardingQuestions';
import type { LifeDomainAnswersMap } from '@/screens/profile/editProfile/lifeDomainProfileService';
import { EditProfileSubsectionTitle } from '@/screens/profile/editProfile/EditProfileUi';

type Props = {
  answers: LifeDomainAnswersMap;
  onChange: (domainId: LifeDomainId, questionId: string, value: string) => void;
};

/** Life-domain pickers that now live on the Essentials tab. */
export function EssentialsLifeDomainFields({ answers, onChange }: Props) {
  const questions = getEssentialsProfileQuestions();
  return (
    <>
      <EditProfileSubsectionTitle>More about you</EditProfileSubsectionTitle>
      {questions.map(({ domainId, question }) => (
        <AppSelect
          key={`${domainId}:${question.id}`}
          label={question.text}
          value={answers[domainId]?.[question.id] ?? ''}
          allowUnset
          options={question.options ?? []}
          onValueChange={(value) => onChange(domainId, question.id, value)}
        />
      ))}
    </>
  );
}
