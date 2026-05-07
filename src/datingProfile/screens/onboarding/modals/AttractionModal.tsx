import React from 'react';
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
  const handleOptionPress = (option: string) => {
    const isSelected = attractedTo.includes(option);
    let newSelection: string[];
    if (isSelected) {
      if (attractedTo.length <= 1) {
        // Sole chip tap would clear selection and strand the user (no Next button). Treat as confirm + continue.
        void onNext(attractedTo);
        return;
      }
      newSelection = attractedTo.filter((item) => item !== option);
    } else {
      newSelection = [...attractedTo, option];
    }
    onAttractedToChange(newSelection);
    if (newSelection.length >= 1) {
      void onNext(newSelection);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="Attracted to" onBack={onBack} />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {ATTRACTION_OPTIONS.map((option) => {
            const isSelected = attractedTo.includes(option);
            return (
              <TouchableOpacity
                key={option}
                style={[
                  styles.option,
                  isSelected && styles.optionSelected,
                ]}
                onPress={() => handleOptionPress(option)}
              >
                <Text style={[
                  styles.optionText,
                  isSelected && styles.optionTextSelected,
                ]}>
                  {option}
                </Text>
                {isSelected && (
                  <Text style={styles.checkmark}>✓</Text>
                )}
              </TouchableOpacity>
            );
          })}
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

