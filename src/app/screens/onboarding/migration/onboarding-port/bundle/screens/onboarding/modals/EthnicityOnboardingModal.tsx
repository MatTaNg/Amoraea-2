import React, { useMemo, useCallback } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
import type { ChoiceOption } from '@/shared/components/profileFields/SingleChoiceOptionList';
import { OnboardingHeader } from './components/OnboardingHeader';
import {
  ETHNICITY_ATTRACTION_OPTIONS,
  ETHNICITY_ATTRACTION_OPEN_TO_ALL,
  normalizeEthnicityAttractionStored,
} from '@/shared/constants/ethnicityAttractionOptions';
import { styles } from './EthnicityOnboardingModal.styled';

export interface EthnicityOnboardingModalProps {
  ethnicity: string;
  onEthnicityChange: (value: string) => void;
  ethnicityAttraction: string[] | undefined;
  onEthnicityAttractionChange: (next: string[]) => void;
  heritageOptions: ChoiceOption[];
  onNext: () => void;
  onBack: () => void;
}

export const EthnicityOnboardingModal: React.FC<EthnicityOnboardingModalProps> = ({
  ethnicity,
  onEthnicityChange,
  ethnicityAttraction,
  onEthnicityAttractionChange,
  heritageOptions,
  onNext,
  onBack,
}) => {
  const normalizedAttraction = useMemo(
    () => normalizeEthnicityAttractionStored(ethnicityAttraction),
    [ethnicityAttraction],
  );

  const toggleEthnicity = useCallback(
    (option: string) => {
      if (option === ETHNICITY_ATTRACTION_OPEN_TO_ALL) {
        onEthnicityAttractionChange([ETHNICITY_ATTRACTION_OPEN_TO_ALL]);
        return;
      }
      const withoutOpen = normalizedAttraction.filter(
        (item) => item !== ETHNICITY_ATTRACTION_OPEN_TO_ALL,
      );
      const next = withoutOpen.includes(option)
        ? withoutOpen.filter((item) => item !== option)
        : [...withoutOpen, option];
      onEthnicityAttractionChange(next);
    },
    [normalizedAttraction, onEthnicityAttractionChange],
  );

  const hasHeritage = heritageOptions.some((o) => o.value === ethnicity);
  const canContinue = hasHeritage && normalizedAttraction.length > 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="Ethnicity" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.description}>
            Tell us about your background and who you are typically attracted to.
          </Text>
          <Text style={styles.sectionTitle}>Your ethnicity</Text>
          <SingleChoiceOptionList
            options={heritageOptions}
            value={ethnicity}
            onSelect={onEthnicityChange}
          />
          <View style={styles.divider}>
            <Text style={styles.sectionTitle}>Which ethnicities are you generally attracted to?</Text>
            <Text style={styles.helperText}>Select all that apply.</Text>
            <View style={styles.optionList}>
              {ETHNICITY_ATTRACTION_OPTIONS.map((option) => {
                const selected = normalizedAttraction.includes(option);
                return (
                  <Pressable
                    key={option}
                    style={[styles.optionRow, selected && styles.optionRowSelected]}
                    onPress={() => toggleEthnicity(option)}
                  >
                    <Text
                      style={[styles.optionText, selected && styles.optionTextSelected]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backButton} />
          <Button title="Next" onPress={onNext} disabled={!canContinue} style={styles.nextButton} />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
