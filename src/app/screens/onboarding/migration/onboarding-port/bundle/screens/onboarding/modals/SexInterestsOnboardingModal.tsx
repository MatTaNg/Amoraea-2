import React, { useCallback, useEffect } from "react";
import { View, Text, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/shared/ui/Button";
import { OnboardingHeader } from "./components/OnboardingHeader";
import { SexInterestCheckboxList } from "@/shared/components/profileFields/SexInterestCheckboxList";
import { SingleChoiceOptionList } from "@/shared/components/profileFields/SingleChoiceOptionList";
import {
  PREF_PARTNER_SHARES_SEXUAL_INTERESTS_OPTIONS,
} from "@/shared/constants/sexualCompatibilityOptions";
import { styles } from "./SexualCompatibilityModal.styled";

interface Props {
  categories: string[];
  onCategoriesChange: (next: string[]) => void;
  prefPartnerSharesSexualInterests: string;
  onPrefPartnerSharesSexualInterestsChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const PARTNER_SHARES_SEXUAL_INTERESTS_CHOICES = PREF_PARTNER_SHARES_SEXUAL_INTERESTS_OPTIONS.map((label) => ({
  label,
  value: label,
}));

export const SexInterestsOnboardingModal: React.FC<Props> = ({
  categories,
  onCategoriesChange,
  prefPartnerSharesSexualInterests,
  onPrefPartnerSharesSexualInterestsChange,
  onNext,
  onBack,
}) => {
  useEffect(() => {
    if ((categories?.length ?? 0) > 1) {
      onCategoriesChange([categories[0]]);
    }
  }, [categories, onCategoriesChange]);

  const onUserPickCategories = useCallback(
    (next: string[]) => {
      onCategoriesChange(next);
    },
    [onCategoriesChange],
  );
  const canContinue =
    (categories?.length ?? 0) === 1 && prefPartnerSharesSexualInterests.trim() !== "";

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <OnboardingHeader title="Sexual interests" onBack={onBack} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <Text style={styles.question}>Sexual interests (select one)</Text>
          <SexInterestCheckboxList
            singleSelect
            selected={categories || []}
            onChange={onUserPickCategories}
          />
          <Text style={styles.dealbreakerQuestion}>
            Is it a <Text style={{ fontWeight: "800" }}>must have</Text> that your partner share the same sexual interests as you?
          </Text>
          <SingleChoiceOptionList
            options={PARTNER_SHARES_SEXUAL_INTERESTS_CHOICES}
            value={prefPartnerSharesSexualInterests}
            onSelect={onPrefPartnerSharesSexualInterestsChange}
          />
        </View>
      </ScrollView>
      <SafeAreaView style={styles.footer} edges={["bottom", "left", "right"]}>
        <View style={styles.btnRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backBtn} />
          <Button title="Next" onPress={onNext} disabled={!canContinue} style={styles.nextBtn} />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
