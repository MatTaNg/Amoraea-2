import React from 'react';
import { ONBOARDING_STEP_SCREEN_EDGES } from './onboardingStepScreenEdges';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import {
  HeightWeightInputFields,
  isHeightWeightInputComplete,
} from '@/shared/components/HeightWeightInputFields';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './HeightWeightModal.styled';

interface HeightWeightModalProps {
  heightCm?: number;
  weightKg?: number;
  onHeightCmChange: (heightCm: number | undefined) => void;
  onWeightKgChange: (weightKg: number | undefined) => void;
  onNext: () => void;
  onBack: () => void;
}

export const HeightWeightModal: React.FC<HeightWeightModalProps> = ({
  heightCm,
  weightKg,
  onHeightCmChange,
  onWeightKgChange,
  onNext,
  onBack,
}) => {
  const canContinue = isHeightWeightInputComplete(heightCm, weightKg);

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Height & Weight" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.note}>
            This is only used to calculate BMI. Your height, weight, and BMI will not be
            communicated to your potential matches.
          </Text>
          <HeightWeightInputFields
            heightCm={heightCm}
            weightKg={weightKg}
            onHeightCmChange={onHeightCmChange}
            onWeightKgChange={onWeightKgChange}
          />
        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backButton} />
          <Button
            title="Next"
            onPress={onNext}
            disabled={!canContinue}
            style={styles.nextButton}
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
