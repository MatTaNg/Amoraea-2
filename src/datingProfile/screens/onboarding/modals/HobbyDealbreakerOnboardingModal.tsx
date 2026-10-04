import React, { useCallback, useMemo } from 'react';
import { ONBOARDING_STEP_SCREEN_EDGES } from './onboardingStepScreenEdges';
import { View, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
import { getHobbiesByIds } from '@/shared/constants/hobbies';
import { hobbiesStringToIds } from '@/shared/utils/hobbiesHelpers';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './HobbyDealbreakerOnboardingModal.styled';
import { ONBOARDING_HOBBY_DEALBREAKER_DESCRIPTION } from './onboardingStepCopy';

export const HOBBY_DEALBREAKER_NONE_VALUE = '__none__';

interface HobbyDealbreakerOnboardingModalProps {
  hobbies: string;
  hobbyDealbreakerId: string | null | undefined;
  onHobbyDealbreakerChange: (id: string | null) => void;
  onNext: () => void;
  onBack: () => void;
}

export const HobbyDealbreakerOnboardingModal: React.FC<HobbyDealbreakerOnboardingModalProps> = ({
  hobbies,
  hobbyDealbreakerId,
  onHobbyDealbreakerChange,
  onNext,
  onBack,
}) => {
  const selectedHobbies = useMemo(
    () => getHobbiesByIds(hobbiesStringToIds(hobbies)),
    [hobbies],
  );

  const options = useMemo(
    () => [
      ...selectedHobbies.map((h) => ({ label: h.name, value: h.id })),
      {
        label: 'None of these would be a dealbreaker',
        value: HOBBY_DEALBREAKER_NONE_VALUE,
      },
    ],
    [selectedHobbies],
  );

  const value =
    hobbyDealbreakerId === null
      ? HOBBY_DEALBREAKER_NONE_VALUE
      : hobbyDealbreakerId ?? '';

  const handleSelect = useCallback(
    (next: string) => {
      onHobbyDealbreakerChange(next === HOBBY_DEALBREAKER_NONE_VALUE ? null : next);
      onNext();
    },
    [onHobbyDealbreakerChange, onNext],
  );

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Shared hobby" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.description}>
            {ONBOARDING_HOBBY_DEALBREAKER_DESCRIPTION}
          </Text>
          <Text style={styles.selectionHint}>Select one option</Text>
          <SingleChoiceOptionList
            options={options}
            value={value}
            onSelect={handleSelect}
          />
        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backButton} />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
