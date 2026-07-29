import React, { useEffect, useState } from 'react';
import { ONBOARDING_STEP_SCREEN_EDGES } from './onboardingStepScreenEdges';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './AttractionModal.styled';

interface AttractionModalProps {
  attractedTo: string[];
  onAttractedToChange: (attractedTo: string[]) => void;
  /** Called with the selection that should be persisted when advancing (avoids stale parent state). */
  onNext: (selection?: string[]) => void | Promise<void>;
  onBack: () => void;
}

const ATTRACTION_OPTIONS = ['Men', 'Women', 'Non-binary'];

export const AttractionModal: React.FC<AttractionModalProps> = ({
  attractedTo,
  onAttractedToChange,
  onNext,
  onBack,
}) => {
  const [selection, setSelection] = useState<string[]>(attractedTo);

  useEffect(() => {
    setSelection(attractedTo);
  }, [attractedTo.join('|')]);

  const toggleOption = (option: string) => {
    let nextSelection = selection;
    setSelection((prev) => {
      nextSelection = prev.includes(option)
        ? prev.filter((item) => item !== option)
        : [...prev, option];
      return nextSelection;
    });
    onAttractedToChange(nextSelection);
  };

  const handleNext = () => {
    if (selection.length === 0) return;
    void onNext(selection);
  };

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Attracted to" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {ATTRACTION_OPTIONS.map((option) => {
            const isSelected = selection.includes(option);
            return (
              <TouchableOpacity
                key={option}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => toggleOption(option)}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                  {option}
                </Text>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backButton} />
          <Button
            title="Next"
            onPress={handleNext}
            disabled={selection.length === 0}
            style={styles.nextButton}
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
