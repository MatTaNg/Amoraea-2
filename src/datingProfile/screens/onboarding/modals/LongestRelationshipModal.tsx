import React from "react";
import { ONBOARDING_STEP_SCREEN_EDGES, ONBOARDING_STEP_SCREEN_EDGES_WITH_BOTTOM } from './onboardingStepScreenEdges';
import { View, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/shared/ui/Button";
import { SingleChoiceOptionList } from "@/shared/components/profileFields/SingleChoiceOptionList";
import { LONGEST_ROMANTIC_RELATIONSHIP_OPTIONS } from "@/shared/constants/longestRomanticRelationshipOptions";
import { OnboardingHeader } from "./components/OnboardingHeader";
import { styles } from "./RelationshipStyleModal.styled";

interface LongestRelationshipModalProps {
  value: string;
  onValueChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const LongestRelationshipModal: React.FC<LongestRelationshipModalProps> = ({
  value,
  onValueChange,
  onNext,
  onBack,
}) => {
  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Relationship history" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.description}>
            What has been your longest romantic relationship?
          </Text>
          <SingleChoiceOptionList
            options={LONGEST_ROMANTIC_RELATIONSHIP_OPTIONS}
            value={value}
            onSelect={(v) => {
              onValueChange(v);
              onNext();
            }}
          />
        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={["bottom", "left", "right"]}>
        <View style={styles.buttonRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backButton} />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
