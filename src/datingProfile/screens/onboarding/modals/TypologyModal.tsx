import React from "react";
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
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <OnboardingHeader title="Typology" onBack={onBack} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Text style={styles.description}>
            Optional: choose from the lists below. You can skip any field and tap Next whenever you are ready.
          </Text>
          <TypologyPickerFields variant="onboarding" value={typology || {}} onTypologyChange={onTypologyChange} />
        </View>
      </ScrollView>

      <SafeAreaView style={styles.buttonContainer} edges={["bottom", "left", "right"]}>
        <View style={styles.buttonRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backButton} />
          <Button title="Next" onPress={onNext} style={styles.nextButton} />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
