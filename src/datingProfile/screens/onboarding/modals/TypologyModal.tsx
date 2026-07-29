import React from "react";
import { ONBOARDING_STEP_SCREEN_EDGES, ONBOARDING_STEP_SCREEN_EDGES_WITH_BOTTOM } from './onboardingStepScreenEdges';
import { View, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/shared/ui/Button";
import { TypologyPickerFields, type TypologyPickerValue } from "@/shared/components/profileFields/TypologyPickerFields";
import { OnboardingHeader } from "./components/OnboardingHeader";
import { styles } from "./TypologyModal.styled";

interface TypologyModalProps {
  typology?: TypologyPickerValue;
  onTypologyChange: (typology: TypologyPickerValue) => void;
  onNext: () => void;
  onBack: () => void;
}

export const TypologyModal: React.FC<TypologyModalProps> = ({
  typology,
  onTypologyChange,
  onNext,
  onBack,
}) => {
  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Typology" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.description}>
            Optional: add any typology details you would like to share. Skip any field and tap Next
            when you are ready.
          </Text>
          <TypologyPickerFields
            variant="onboarding"
            value={typology || {}}
            onTypologyChange={onTypologyChange}
          />
        </View>
      </ScrollView>

      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backButton} />
          <Button title="Next" onPress={onNext} style={styles.nextButton} />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
