import React from 'react';
import { View, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './SingleChoiceModal.styled';

export interface ChoiceOption {
  label: string;
  value: string;
}

interface SingleChoiceModalProps {
  title: string;
  options: ChoiceOption[];
  value: string;
  onValueChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  description?: string;
  /** When true, selecting an option immediately saves and advances to next step (no Next button). */
  autoAdvanceOnSelect?: boolean;
}

export const SingleChoiceModal: React.FC<SingleChoiceModalProps> = ({
  title,
  options,
  value,
  onValueChange,
  onNext,
  onBack,
  description,
  autoAdvanceOnSelect = true,
}) => {
  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    if (autoAdvanceOnSelect) {
      onNext();
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title={title} onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {description ? <Text style={styles.description}>{description}</Text> : null}
          <SingleChoiceOptionList options={options} value={value} onSelect={handleSelect} />
        </View>
      </ScrollView>
      {!autoAdvanceOnSelect ? (
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
              disabled={!value}
              style={styles.nextButton}
            />
          </View>
        </SafeAreaView>
      ) : (
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
      )}
    </SafeAreaView>
  );
};
