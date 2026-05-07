import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { OnboardingHeader } from '../components/OnboardingHeader';
import { styles } from '../AttractionModal.styled';

interface AttractionModalProps {
  attractedTo: string[];
  onAttractedToChange: (attractedTo: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const ATTRACTION_OPTIONS = ['Male', 'Female', 'Non-binary'];

export const AttractionModal: React.FC<AttractionModalProps> = ({
  attractedTo,
  onAttractedToChange,
  onNext,
  onBack,
}) => {
  const toggleOption = (option: string) => {
    if (attractedTo.includes(option)) {
      onAttractedToChange(attractedTo.filter(item => item !== option));
    } else {
      onAttractedToChange([...attractedTo, option]);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <OnboardingHeader title="I am looking for" onBack={onBack} />
      <ScrollView 
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
                onPress={() => toggleOption(option)}
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
              disabled={attractedTo.length === 0}
              style={styles.nextButton}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

