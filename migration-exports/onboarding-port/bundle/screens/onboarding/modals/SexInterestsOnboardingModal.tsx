import React, { useCallback, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { OnboardingHeader } from './components/OnboardingHeader';
import { SexInterestCheckboxList } from '@/shared/components/profileFields/SexInterestCheckboxList';
import {
  PREF_PARTNER_SHARES_SPECIFIC_SEX_INTERESTS_QUESTION,
  PARTNER_SPECIFIC_SEX_MUST_HAVE_YES_NO_OPTIONS,
  prefPartnerSharesSexualInterestsFromYesNo,
  prefPartnerSharesSexualInterestsYesNoSelected,
} from '@/shared/constants/sexualCompatibilityOptions';
import { styles } from './SexualCompatibilityModal.styled';

interface Props {
  categories: string[];
  onCategoriesChange: (next: string[]) => void;
  prefPartnerSharesSexualInterests: string;
  onPrefPartnerSharesSexualInterestsChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

function renderMustHaveHighlight(text: string) {
  const phrase = 'must have';
  const index = text.indexOf(phrase);
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <Text style={styles.mustHaveEmphasis}>{phrase}</Text>
      {text.slice(index + phrase.length)}
    </>
  );
}

export const SexInterestsOnboardingModal: React.FC<Props> = ({
  categories,
  onCategoriesChange,
  prefPartnerSharesSexualInterests,
  onPrefPartnerSharesSexualInterestsChange,
  onNext,
  onBack,
}) => {
  useEffect(() => {
    if ((categories?.length ?? 0) > 1) {
      onCategoriesChange([categories[0]]);
    }
  }, [categories, onCategoriesChange]);

  const onUserPickCategories = useCallback(
    (next: string[]) => {
      onCategoriesChange(next);
    },
    [onCategoriesChange],
  );

  const yesNoSelected = prefPartnerSharesSexualInterestsYesNoSelected(prefPartnerSharesSexualInterests);
  const yesNoAsArray = yesNoSelected ? [yesNoSelected] : [];

  const canContinue =
    (categories?.length ?? 0) === 1 && prefPartnerSharesSexualInterests.trim() !== '';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="Sexual interests" onBack={onBack} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.question}>Sexual interests (select one)</Text>
          <SexInterestCheckboxList
            singleSelect
            selected={categories || []}
            onChange={onUserPickCategories}
          />
          <Text style={styles.dealbreakerQuestion}>
            {renderMustHaveHighlight(PREF_PARTNER_SHARES_SPECIFIC_SEX_INTERESTS_QUESTION)}
          </Text>
          <SexInterestCheckboxList
            singleSelect
            options={PARTNER_SPECIFIC_SEX_MUST_HAVE_YES_NO_OPTIONS}
            selected={yesNoAsArray}
            onChange={(next) => {
              const v = next[0] ?? '';
              onPrefPartnerSharesSexualInterestsChange(prefPartnerSharesSexualInterestsFromYesNo(v));
            }}
          />
        </View>
      </ScrollView>
      <SafeAreaView style={styles.footer} edges={['bottom', 'left', 'right']}>
        <View style={styles.btnRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backBtn} />
          <Button title="Next" onPress={onNext} disabled={!canContinue} style={styles.nextBtn} />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
