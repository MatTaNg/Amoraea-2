import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './BioModal.styled';

interface BioModalProps {
  bio: string;
  onBioChange: (bio: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const BioModal: React.FC<BioModalProps> = ({
  bio,
  onBioChange,
  onNext,
  onBack,
}) => {
  // Disable Complete button if bio is empty or only whitespace
  const canComplete = bio && bio.trim().length > 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="Bio description" onBack={onBack} />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.note}>
            Please add a bio description to tell others more about yourself.
          </Text>

          <Input
            label="Bio"
            value={bio}
            onChangeText={onBioChange}
            placeholder="Tell others about yourself..."
            multiline
            numberOfLines={6}
            style={styles.bioInput}
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
            title="Complete"
            onPress={onNext}
            disabled={!canComplete}
            style={styles.nextButton}
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};

