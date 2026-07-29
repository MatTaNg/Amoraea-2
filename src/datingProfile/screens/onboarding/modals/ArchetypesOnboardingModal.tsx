import React from 'react';
import { ONBOARDING_STEP_SCREEN_EDGES, ONBOARDING_STEP_SCREEN_EDGES_WITH_BOTTOM } from './onboardingStepScreenEdges';
import { View, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { ArchetypeSelector } from '@/shared/components/profileFields/ArchetypeSelector';
import {
  isCompleteArchetypeSelection,
  MAX_PROFILE_ARCHETYPES,
  MIN_PROFILE_ARCHETYPES,
  type ArchetypeId,
} from '@/shared/constants/archetypes';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './TypologyModal.styled';

interface ArchetypesOnboardingModalProps {
  archetypes?: ArchetypeId[];
  onArchetypesChange: (archetypes: ArchetypeId[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const ArchetypesOnboardingModal: React.FC<ArchetypesOnboardingModalProps> = ({
  archetypes = [],
  onArchetypesChange,
  onNext,
  onBack,
}) => {
  const canContinue = isCompleteArchetypeSelection(archetypes.length);

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Your archetypes" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <ArchetypeSelector value={archetypes} onChange={onArchetypesChange} />
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
        {!canContinue ? (
          <Text style={[styles.optionalNote, { paddingHorizontal: 24, textAlign: 'center' }]}>
            Select {MIN_PROFILE_ARCHETYPES}–{MAX_PROFILE_ARCHETYPES} archetypes to continue.
          </Text>
        ) : null}
      </SafeAreaView>
    </SafeAreaView>
  );
};
