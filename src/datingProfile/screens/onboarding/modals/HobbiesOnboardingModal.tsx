import React from 'react';
import { ONBOARDING_STEP_SCREEN_EDGES } from './onboardingStepScreenEdges';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { HobbiesFields } from '@/shared/components/profileFields/HobbiesFields';
import { hobbiesStringToIds } from '@/shared/utils/hobbiesHelpers';
import { MIN_HOBBY_SELECTIONS } from '@/shared/constants/hobbies';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './HobbiesOnboardingModal.styled';

interface HobbiesOnboardingModalProps {
  hobbies: string;
  professionalHobbyId: string | null | undefined;
  onHobbiesChange: (hobbies: string) => void;
  onProfessionalHobbyIdChange: (id: string | null) => void;
  onNext: () => void;
  onBack: () => void;
}

export const HobbiesOnboardingModal: React.FC<HobbiesOnboardingModalProps> = ({
  hobbies,
  professionalHobbyId,
  onHobbiesChange,
  onProfessionalHobbyIdChange,
  onNext,
  onBack,
}) => {
  const canContinue = hobbiesStringToIds(hobbies).length >= MIN_HOBBY_SELECTIONS;

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Hobbies" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <HobbiesFields
            hobbies={hobbies}
            professionalHobbyId={professionalHobbyId}
            onHobbiesChange={onHobbiesChange}
            onProfessionalHobbyIdChange={onProfessionalHobbyIdChange}
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
