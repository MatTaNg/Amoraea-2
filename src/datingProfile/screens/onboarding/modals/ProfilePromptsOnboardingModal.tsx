import React, { useMemo } from 'react';
import { ONBOARDING_STEP_SCREEN_EDGES } from './onboardingStepScreenEdges';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import type { ProfilePromptAnswer } from '@domain/models/Profile';
import { ProfilePromptsFields } from '@/shared/components/profileFields/ProfilePromptsFields';
import { validateProfilePromptsForSetup } from '@/features/profile/profilePromptValidation';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './ProfilePromptsOnboardingModal.styled';

interface ProfilePromptsOnboardingModalProps {
  prompts: ProfilePromptAnswer[];
  onPromptsChange: (prompts: ProfilePromptAnswer[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const ProfilePromptsOnboardingModal: React.FC<ProfilePromptsOnboardingModalProps> = ({
  prompts,
  onPromptsChange,
  onNext,
  onBack,
}) => {
  const validation = useMemo(() => validateProfilePromptsForSetup(prompts), [prompts]);
  const canContinue = validation.ok;

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Profile prompts" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <ProfilePromptsFields
            prompts={prompts}
            onChange={onPromptsChange}
            showSetupHints
          />
        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backButton} />
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
