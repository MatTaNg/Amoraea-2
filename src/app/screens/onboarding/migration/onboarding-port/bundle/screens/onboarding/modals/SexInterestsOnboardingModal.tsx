import React, { useCallback, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/shared/ui/Button";
import { OnboardingHeader } from "./components/OnboardingHeader";
import { SexInterestCheckboxList } from "@/shared/components/profileFields/SexInterestCheckboxList";
import { styles } from "./SexualCompatibilityModal.styled";

interface Props {
  categories: string[];
  onCategoriesChange: (next: string[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export const SexInterestsOnboardingModal: React.FC<Props> = ({
  categories,
  onCategoriesChange,
  onNext,
  onBack,
}) => {
  useEffect(() => {
    if ((categories?.length ?? 0) > 1) {
      onCategoriesChange([categories[0]]);
    }
  }, [categories, onCategoriesChange]);

  /** Persist choice then advance when the user picks an option (not used for legacy multi→single normalize). */
  const onUserPickCategories = useCallback(
    (next: string[]) => {
      onCategoriesChange(next);
      if (next.length === 1) {
        onNext();
      }
    },
    [onCategoriesChange, onNext],
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <OnboardingHeader title="Sexual interests" onBack={onBack} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>
          Choose the one option that best describes your style.
        </Text>
        <Text style={styles.question}>Sexual interests (select one)</Text>
        <SexInterestCheckboxList
          singleSelect
          selected={categories || []}
          onChange={onUserPickCategories}
        />
      </ScrollView>
      <SafeAreaView style={styles.footer} edges={["bottom", "left", "right"]}>
        <View style={styles.btnRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backBtn} />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
