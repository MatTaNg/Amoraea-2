import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { OnboardingHeader } from '../components/OnboardingHeader';
import { styles } from '../GenderModal.styled';

interface GenderModalProps {
  gender: string;
  onGenderChange: (gender: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary'];

export const GenderModal: React.FC<GenderModalProps> = ({
  gender,
  onGenderChange,
  onNext,
  onBack,
}) => {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <OnboardingHeader title="I am a" onBack={onBack} />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {GENDER_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.option,
                gender === option && styles.optionSelected,
              ]}
              onPress={() => onGenderChange(option)}
            >
              <Text style={[
                styles.optionText,
                gender === option && styles.optionTextSelected,
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}

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
              disabled={!gender}
              style={styles.nextButton}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

