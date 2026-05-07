import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './NameModal.styled';

interface NameModalProps {
  name: string;
  onNameChange: (name: string) => void;
  onNext: () => void;
  /** Screen 1 has no back button; pass undefined to hide. */
  onBack?: (() => void) | undefined;
}

export const NameModal: React.FC<NameModalProps> = ({
  name,
  onNameChange,
  onNext,
  onBack,
}) => {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="Your name" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Input
            label="Name"
            value={name || ''}
            onChangeText={(text) => {
              console.log('Name text changed:', text);
              onNameChange(text);
            }}
            placeholder="Your first name"
            autoCapitalize="words"
            maxLength={30}
          />
          
          <Text style={styles.note}>
            This name will be shown on your profile
          </Text>
        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          {onBack != null && (
            <Button
              title="Back"
              variant="outline"
              onPress={onBack}
              style={styles.backButton}
            />
          )}
          <Button
            title="Next"
            onPress={onNext}
            disabled={!name.trim()}
            style={onBack == null ? styles.nextButtonFullWidth : styles.nextButton}
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};

