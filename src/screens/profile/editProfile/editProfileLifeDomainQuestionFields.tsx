import React from 'react';
import type { LifeDomainId, LifeDomainQuestionDef } from '@/shared/constants/lifeDomainOnboardingQuestions';
import type { LifeDomainAnswersMap } from '@/screens/profile/editProfile/lifeDomainProfileService';
import { FormTextInput } from '@/shared/ui/FormField';
import { AppSelect } from '@/shared/ui/AppSelect';

export function renderEditProfileLifeDomainQuestion(
  domainId: LifeDomainId,
  q: LifeDomainQuestionDef,
  value: string,
  onAnswerChange: LifeDomainAnswerChangeHandler,
  options?: { onTextFocus?: () => void },
) {
  if (q.input === 'dropdown' && q.options?.length) {
    return (
      <AppSelect
        key={q.id}
        label={q.text}
        value={value}
        options={q.options}
        onValueChange={(v) => onAnswerChange(domainId, q.id, v)}
        allowUnset
        unsetLabel="Select an option"
        placeholder="Select an option"
        sheetTitle={q.text}
      />
    );
  }
  return (
    <FormTextInput
      key={q.id}
      label={q.text}
      value={value}
      onChangeText={(t) => onAnswerChange(domainId, q.id, t)}
      multiline={q.multiline !== false}
      textAlignVertical="top"
      onFocus={options?.onTextFocus}
    />
  );
}

export type LifeDomainAnswerChangeHandler = (
  domainId: LifeDomainId,
  questionId: string,
  value: string,
) => void;

export function getLifeDomainAnswersForDomain(
  answers: LifeDomainAnswersMap,
  domainId: LifeDomainId,
): Record<string, string> {
  return answers[domainId] ?? {};
}
