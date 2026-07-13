import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { HobbiesModal } from '@/shared/components/HobbiesModal';
import { hobbiesStringToIds, hobbiesIdsToString } from '@/shared/utils/hobbiesHelpers';
import { getHobbiesByIds } from '@/shared/constants/hobbies';
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
  const [hobbiesModalVisible, setHobbiesModalVisible] = useState(false);
  const selectedIds = hobbiesStringToIds(hobbies);
  const selectedHobbies = getHobbiesByIds(selectedIds);
  const canContinue = selectedIds.length > 0;

  const handleSaveHobbies = (ids: string[]) => {
    onHobbiesChange(hobbiesIdsToString(ids));
    if (professionalHobbyId && !ids.includes(professionalHobbyId)) {
      onProfessionalHobbyIdChange(null);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="Hobbies" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.description}>
            How do you spend most of your time? Choose up to 3 options.
          </Text>
          <TouchableOpacity
            style={styles.hobbyButton}
            onPress={() => setHobbiesModalVisible(true)}
          >
            <Text style={styles.hobbyButtonText}>
              {selectedIds.length === 0
                ? 'Select hobbies'
                : selectedHobbies.map((h) => h.name).join(', ')}
            </Text>
          </TouchableOpacity>
          {selectedIds.length > 0 && (
            <>
              <Text style={styles.proLabel}>
                Optionally, mark one as your "professional hobby" (you spend 20+ hours a week on it — the center of your life).
              </Text>
              <View style={styles.proOptions}>
                <TouchableOpacity
                  style={[
                    styles.proOption,
                    professionalHobbyId === null || professionalHobbyId === undefined ? styles.proOptionSelected : undefined,
                  ]}
                  onPress={() => onProfessionalHobbyIdChange(null)}
                >
                  <Text style={styles.proOptionText}>None</Text>
                </TouchableOpacity>
                {selectedHobbies.map((h) => (
                  <TouchableOpacity
                    key={h.id}
                    style={[
                      styles.proOption,
                      professionalHobbyId === h.id ? styles.proOptionSelected : undefined,
                    ]}
                    onPress={() => onProfessionalHobbyIdChange(h.id)}
                  >
                    <Text style={styles.proOptionText}>{h.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
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
            title="Next"
            onPress={onNext}
            disabled={!canContinue}
            style={styles.nextButton}
          />
        </View>
      </SafeAreaView>
      <HobbiesModal
        visible={hobbiesModalVisible}
        onClose={() => setHobbiesModalVisible(false)}
        selectedHobbies={selectedIds}
        onSave={handleSaveHobbies}
        maxSelections={3}
      />
    </SafeAreaView>
  );
};
