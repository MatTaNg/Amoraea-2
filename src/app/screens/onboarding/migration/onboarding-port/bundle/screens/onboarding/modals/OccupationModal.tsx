import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './NameModal.styled';

interface OccupationModalProps {
  occupation: string;
  onOccupationChange: (occupation: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const OccupationModal: React.FC<OccupationModalProps> = ({
  occupation,
  onOccupationChange,
  onNext,
  onBack,
}) => {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="Occupation" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Input
            label="Occupation"
            value={occupation || ''}
            onChangeText={onOccupationChange}
            placeholder="What do you do for work?"
            autoCapitalize="words"
            maxLength={60}
          />

        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backButton} />
          <Button title="Next" onPress={onNext} disabled={!occupation.trim()} style={styles.nextButton} />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
