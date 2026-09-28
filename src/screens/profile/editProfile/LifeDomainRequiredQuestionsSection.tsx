import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  getActiveRequiredLifeDomainQuestionsByDomain,
  getLifeDomainOnboardingMeta,
  LIFE_DOMAIN_ONBOARDING_DOMAIN_ORDER,
  type LifeDomainId,
  type LifeDomainQuestionDef,
} from '@/shared/constants/lifeDomainOnboardingQuestions';
import type { LifeDomainAnswersMap } from '@/screens/profile/editProfile/lifeDomainProfileService';
import { FormTextInput } from '@/shared/ui/FormField';
import { AppSelect } from '@/shared/ui/AppSelect';
import { theme } from '@/shared/theme/theme';

type Props = {
  wantKids?: string | null;
  answers: LifeDomainAnswersMap;
  onAnswerChange: (domainId: LifeDomainId, questionId: string, value: string) => void;
};

function renderQuestion(
  domainId: LifeDomainId,
  q: LifeDomainQuestionDef,
  value: string,
  onAnswerChange: Props['onAnswerChange'],
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
        unsetLabel="Choose…"
        placeholder="Choose…"
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
    />
  );
}

export function LifeDomainRequiredQuestionsSection({
  wantKids,
  answers,
  onAnswerChange,
}: Props) {
  const byDomain = React.useMemo(
    () => getActiveRequiredLifeDomainQuestionsByDomain(wantKids),
    [wantKids],
  );

  const domainsWithQuestions = LIFE_DOMAIN_ONBOARDING_DOMAIN_ORDER.filter(
    (id) => (byDomain[id]?.length ?? 0) > 0,
  );

  if (domainsWithQuestions.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {domainsWithQuestions.map((domainId) => {
        const meta = getLifeDomainOnboardingMeta(domainId);
        const questions = byDomain[domainId] ?? [];
        const domainAnswers = answers[domainId] ?? {};
        return (
          <View key={domainId} style={styles.domainBlock}>
            <Text style={styles.domainTitle}>
              {meta.icon} {meta.name}
            </Text>
            {questions.map((q) =>
              renderQuestion(domainId, q, domainAnswers[q.id] ?? '', onAnswerChange),
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 20,
    marginBottom: 8,
  },
  domainBlock: {
    gap: 12,
  },
  domainTitle: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
