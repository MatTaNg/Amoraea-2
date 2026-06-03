import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import {
  getActiveRequiredLifeDomainQuestionsByDomain,
  getLifeDomainOnboardingMeta,
  LIFE_DOMAIN_ONBOARDING_DOMAIN_ORDER,
  type LifeDomainId,
  type LifeDomainQuestionDef,
} from '@/shared/constants/lifeDomainOnboardingQuestions';
import type { LifeDomainAnswersMap } from '@/screens/profile/editProfile/lifeDomainProfileService';
import { FormField, FormTextInput } from '@/shared/ui/FormField';
import {
  BottomSheet,
  OptionPickerTrigger,
  type OptionAnchor,
} from '@/screens/profile/editProfile/BottomSheet';
import { SelectTriggerRow } from '@/shared/ui/SelectTriggerRow';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
import { theme } from '@/shared/theme/theme';

type Props = {
  wantKids?: string | null;
  answers: LifeDomainAnswersMap;
  onAnswerChange: (domainId: LifeDomainId, questionId: string, value: string) => void;
};

function QuestionDropdown({
  label,
  value,
  options,
  onValueChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onValueChange: (v: string) => void;
}) {
  const [sheetAnchor, setSheetAnchor] = React.useState<OptionAnchor | null>(null);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? 'Choose…';

  if (Platform.OS === 'web') {
    return (
      <FormField label={label}>
        <OptionPickerTrigger
          style={styles.dropdownTrigger}
          onOpen={(anchor) => setSheetAnchor(anchor)}
        >
          <SelectTriggerRow
            label={selectedLabel}
            isPlaceholder={!value}
            labelStyle={styles.dropdownValue}
            placeholderStyle={styles.dropdownPlaceholder}
          />
        </OptionPickerTrigger>
        <BottomSheet
          visible={!!sheetAnchor}
          title={label}
          anchor={sheetAnchor}
          onClose={() => setSheetAnchor(null)}
        >
          <SingleChoiceOptionList
            options={options}
            value={value}
            onSelect={(v) => {
              onValueChange(String(v));
              setSheetAnchor(null);
            }}
          />
        </BottomSheet>
      </FormField>
    );
  }

  return (
    <FormField label={label}>
      <View style={styles.pickerWrap}>
        <Picker
          selectedValue={value || (options[0]?.value ?? '')}
          onValueChange={(v) => onValueChange(String(v))}
          mode={Platform.OS === 'android' ? 'dropdown' : undefined}
          style={styles.picker}
          dropdownIconColor={theme.colors.textSecondary}
        >
          {options.map((o) => (
            <Picker.Item key={o.value} label={o.label} value={o.value} />
          ))}
        </Picker>
      </View>
    </FormField>
  );
}

function renderQuestion(
  domainId: LifeDomainId,
  q: LifeDomainQuestionDef,
  value: string,
  onAnswerChange: Props['onAnswerChange'],
) {
  if (q.input === 'dropdown' && q.options?.length) {
    return (
      <QuestionDropdown
        key={q.id}
        label={q.text}
        value={value}
        options={q.options}
        onValueChange={(v) => onAnswerChange(domainId, q.id, v)}
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
  const byDomain = useMemo(
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
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: 'rgba(123,154,190,0.35)',
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.6)',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  dropdownValue: {
    color: theme.colors.text,
    fontSize: 16,
  },
  dropdownPlaceholder: {
    color: theme.colors.textSecondary,
    fontSize: 16,
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: 'rgba(123,154,190,0.35)',
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,42,0.6)',
    overflow: 'hidden',
  },
  picker: {
    color: theme.colors.text,
  },
});
