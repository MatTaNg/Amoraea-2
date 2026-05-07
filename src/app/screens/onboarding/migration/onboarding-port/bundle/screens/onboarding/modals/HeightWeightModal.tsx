import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { HeightSlider } from '@/shared/components/HeightSlider';
import { WeightInput } from '@/shared/components/WeightInput';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './HeightWeightModal.styled';

interface HeightWeightModalProps {
  height: string;
  weight: string;
  onHeightChange: (height: string) => void;
  onWeightChange: (weight: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const HeightWeightModal: React.FC<HeightWeightModalProps> = ({
  height,
  weight,
  onHeightChange,
  onWeightChange,
  onNext,
  onBack,
}) => {
  const canContinue = !!(height?.trim() && weight?.trim());

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="Height & Weight" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.note}>
            This is only used to calculate BMI. Height, weight, and BMI are not shown on your profile.
          </Text>
          <HeightSlider
            label="Height (cm)"
            value={height || ''}
            onChange={onHeightChange}
            defaultUnit="cm"
            allowUnitSwitch={false}
          />
          <WeightInput
            label="Weight (lbs)"
            value={weight || ''}
            onChange={onWeightChange}
            defaultUnit="lbs"
            allowUnitSwitch={false}
          />
        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button
            title="Back"
            variant="outline"
            onPress={onBack}
            style={styles.backButton}
          />
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
