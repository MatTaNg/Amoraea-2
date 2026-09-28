import React, { useState } from 'react';
import { ONBOARDING_STEP_SCREEN_EDGES } from './onboardingStepScreenEdges';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { OnboardingHeader } from './components/OnboardingHeader';
import { afterOnboardingSelectionFeedback } from '@/datingProfile/screens/onboarding/onboardingSelectionFeedback';
import { styles } from './GenderModal.styled';

interface GenderModalProps {
  gender: string;
  onGenderChange: (gender: string) => void;
  onNext: () => void;
  onBack: () => void;
}

// Onboarding copy: Man, Woman, Non-binary
const GENDER_OPTIONS = ['Man', 'Woman', 'Non-binary'];

export const GenderModal: React.FC<GenderModalProps> = ({
  gender,
  onGenderChange,
  onNext,
  onBack,
}) => {
  const [pendingGender, setPendingGender] = useState<string | null>(null);
  const displayedGender = pendingGender ?? gender;

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Gender" onBack={onBack} />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {GENDER_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.option,
                displayedGender === option && styles.optionSelected,
              ]}
              onPress={() => {
                setPendingGender(option);
                onGenderChange(option);
                afterOnboardingSelectionFeedback(onNext);
              }}
            >
              <Text style={[
                styles.optionText,
                displayedGender === option && styles.optionTextSelected,
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
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
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};

