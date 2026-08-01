import React, { useCallback } from 'react';
import { ONBOARDING_STEP_SCREEN_EDGES, ONBOARDING_STEP_SCREEN_EDGES_WITH_BOTTOM } from './onboardingStepScreenEdges';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
import type { ChoiceOption } from '@/shared/components/profileFields/SingleChoiceOptionList';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './EthnicityOnboardingModal.styled';

export interface EthnicityOnboardingModalProps {
  ethnicity: string;
  onEthnicityChange: (value: string) => void;
  heritageOptions: ChoiceOption[];
  onNext: () => void;
  onBack: () => void;
}

export const EthnicityOnboardingModal: React.FC<EthnicityOnboardingModalProps> = ({
  ethnicity,
  onEthnicityChange,
  heritageOptions,
  onNext,
  onBack,
}) => {
  const onHeritageSelect = useCallback(
    (value: string) => {
      onEthnicityChange(value);
      onNext();
    },
    [onEthnicityChange, onNext],
  );

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Ethnicity" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.description}>Tell us about your background.</Text>
          <Text style={styles.sectionTitle}>Your ethnicity</Text>
          <SingleChoiceOptionList
            options={heritageOptions}
            value={ethnicity}
            onSelect={onHeritageSelect}
          />
        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backButton} />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
