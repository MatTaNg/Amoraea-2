import React, { useCallback, useEffect, useMemo } from "react";
import { ONBOARDING_STEP_SCREEN_EDGES } from './onboardingStepScreenEdges';
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/shared/ui/Button";
import { AppSelect } from "@/shared/ui/AppSelect";
import { OnboardingHeader } from "./components/OnboardingHeader";
import { SexInterestCheckboxList } from "@/shared/components/profileFields/SexInterestCheckboxList";
import { renderDealbreakerQuestionHighlight } from '@/shared/components/profileFields/dealbreakerQuestionHighlight';
import {
  PREF_PHYSICAL_COMPAT_CENTRALITY_OPTIONS,
  PREF_PARTNER_SHARES_SPECIFIC_SEX_INTERESTS_QUESTION,
  PARTNER_SPECIFIC_SEX_MUST_HAVE_YES_NO_OPTIONS,
  prefPartnerSharesSexualInterestsFromYesNo,
  prefPartnerSharesSexualInterestsYesNoSelected,
  SEX_DRIVE_OPTIONS,
  SEX_INTEREST_CATEGORY_OPTIONS,
  sexualCompatStepComplete,
} from "@/shared/constants/sexualCompatibilityOptions";
import { styles } from "./SexualCompatibilityModal.styled";
import { ONBOARDING_SEXUAL_COMPATIBILITY_LEAD } from "./onboardingStepCopy";

export type SexualCompatibilityDraft = {
  prefPhysicalCompatImportance: string;
  prefPartnerSharesSexualInterests: string;
  sexDrive: string;
  sexInterestCategories: string[];
};

interface SexualCompatibilityModalProps {
  value: SexualCompatibilityDraft;
  onChange: (patch: Partial<SexualCompatibilityDraft>) => void;
  onNext: () => void;
  onBack: () => void;
}

const SELECT_PLACEHOLDER = "Select";

function truncLabel(s: string, max = 72): string {
  const t = String(s ?? "").trim();
  if (!t) return SELECT_PLACEHOLDER;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function toSelectOptions(options: readonly string[]) {
  return options.map((option) => ({ label: option, value: option }));
}

function renderDealbreakerHighlight(text: string) {
  return renderDealbreakerQuestionHighlight(text, styles.dealbreakerEmphasis);
}

export const SexualCompatibilityModal: React.FC<SexualCompatibilityModalProps> = ({
  value,
  onChange,
  onNext,
  onBack,
}) => {
  useEffect(() => {
    const cur = value.sexInterestCategories || [];
    if (cur.length > 1) {
      onChange({ sexInterestCategories: [cur[0]] });
    }
  }, [value.sexInterestCategories, onChange]);

  const canContinue = useMemo(() => sexualCompatStepComplete(value), [value]);

  const partnerSpecificSexYesNo = prefPartnerSharesSexualInterestsYesNoSelected(
    value.prefPartnerSharesSexualInterests,
  );
  const partnerSpecificSexSelected = partnerSpecificSexYesNo ? [partnerSpecificSexYesNo] : [];

  const pickCategory = useCallback(
    (slug: string) => {
      const cur = value.sexInterestCategories || [];
      const onlyThis = cur.length === 1 && cur[0] === slug;
      onChange({ sexInterestCategories: onlyThis ? [] : [slug] });
    },
    [value.sexInterestCategories, onChange]
  );

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Sexual compatibility" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.lead}>
          {ONBOARDING_SEXUAL_COMPATIBILITY_LEAD}
        </Text>

        <Text style={styles.question}>
          How central is physical and sexual compatibility for you in a relationship?
        </Text>
        <AppSelect
          bare
          value={value.prefPhysicalCompatImportance}
          options={toSelectOptions(PREF_PHYSICAL_COMPAT_CENTRALITY_OPTIONS)}
          onValueChange={(next) => onChange({ prefPhysicalCompatImportance: next })}
          allowUnset
          placeholder={SELECT_PLACEHOLDER}
          sheetTitle="Physical & sexual compatibility"
          formatSelectedLabel={(label, selected) =>
            selected.trim() ? truncLabel(label) : SELECT_PLACEHOLDER
          }
        />

        <Text style={styles.dealbreakerQuestion}>
          {renderDealbreakerHighlight(PREF_PARTNER_SHARES_SPECIFIC_SEX_INTERESTS_QUESTION)}
        </Text>
        <SexInterestCheckboxList
          singleSelect
          options={PARTNER_SPECIFIC_SEX_MUST_HAVE_YES_NO_OPTIONS}
          selected={partnerSpecificSexSelected}
          onChange={(next) => {
            const v = next[0] ?? "";
            onChange({
              prefPartnerSharesSexualInterests: prefPartnerSharesSexualInterestsFromYesNo(v),
            });
          }}
        />

        <Text style={styles.question}>
          In a relationship, what feels like your natural rhythm for sex?
        </Text>
        <AppSelect
          bare
          value={value.sexDrive}
          options={[...SEX_DRIVE_OPTIONS]}
          onValueChange={(next) => onChange({ sexDrive: next })}
          allowUnset
          placeholder={SELECT_PLACEHOLDER}
          sheetTitle="Natural rhythm for sex"
          formatSelectedLabel={(label, selected) =>
            selected.trim() ? truncLabel(label) : SELECT_PLACEHOLDER
          }
        />

        <Text style={styles.question}>Sexual interests (select one)</Text>
        <View style={styles.chipWrap}>
          {SEX_INTEREST_CATEGORY_OPTIONS.map((opt) => {
            const selected = (value.sexInterestCategories || [])[0] === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => pickCategory(opt.value)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
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
