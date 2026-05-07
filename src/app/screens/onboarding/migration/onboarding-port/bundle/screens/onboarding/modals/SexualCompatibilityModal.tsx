import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/shared/ui/Button";
import { OnboardingHeader } from "./components/OnboardingHeader";
import {
  BottomSheet,
  OptionPickerTrigger,
  type OptionAnchor,
} from "@/screens/profile/editProfile/BottomSheet";
import { SingleChoiceOptionList } from "@/shared/components/profileFields/SingleChoiceOptionList";
import {
  PREF_PHYSICAL_COMPAT_CENTRALITY_OPTIONS,
  PREF_PARTNER_SHARES_SEXUAL_INTERESTS_OPTIONS,
  SEX_DRIVE_OPTIONS,
  SEX_INTEREST_CATEGORY_OPTIONS,
  sexualCompatStepComplete,
} from "@/shared/constants/sexualCompatibilityOptions";
import { styles } from "./SexualCompatibilityModal.styled";

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

function truncLabel(s: string, max = 72): string {
  const t = String(s ?? "").trim();
  if (!t) return "Select";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export const SexualCompatibilityModal: React.FC<SexualCompatibilityModalProps> = ({
  value,
  onChange,
  onNext,
  onBack,
}) => {
  const [sheet, setSheet] = useState<{
    title: string;
    options: readonly string[];
    selectedValue: string;
    onPick: (v: string) => void;
    anchor?: OptionAnchor;
  } | null>(null);

  useEffect(() => {
    const cur = value.sexInterestCategories || [];
    if (cur.length > 1) {
      onChange({ sexInterestCategories: [cur[0]] });
    }
  }, [value.sexInterestCategories, onChange]);

  const canContinue = useMemo(() => sexualCompatStepComplete(value), [value]);

  const pickCategory = useCallback(
    (slug: string) => {
      const cur = value.sexInterestCategories || [];
      const onlyThis = cur.length === 1 && cur[0] === slug;
      onChange({ sexInterestCategories: onlyThis ? [] : [slug] });
    },
    [value.sexInterestCategories, onChange]
  );

  const openSingle = useCallback(
    (
      anchor: OptionAnchor,
      title: string,
      options: readonly string[],
      key: "prefPhysicalCompatImportance" | "prefPartnerSharesSexualInterests" | "sexDrive"
    ) => {
      setSheet({
        title,
        options,
        anchor,
        selectedValue: String(value[key] ?? ""),
        onPick: (v) => {
          const patch: Partial<SexualCompatibilityDraft> = { [key]: v } as Partial<SexualCompatibilityDraft>;
          onChange(patch);
          setSheet(null);
        },
      });
    },
    [onChange, value]
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <OnboardingHeader title="Sexual compatibility" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.lead}>
          Answer honestly — this helps us understand what matters to you in matching.
        </Text>

        <Text style={styles.question}>
          How central is physical and sexual compatibility for you in a relationship?
        </Text>
        <OptionPickerTrigger
          style={styles.row}
          onOpen={(anchor) =>
            openSingle(anchor, "Physical & sexual compatibility", PREF_PHYSICAL_COMPAT_CENTRALITY_OPTIONS, "prefPhysicalCompatImportance")
          }
        >
          <Text style={styles.rowValue}>{truncLabel(value.prefPhysicalCompatImportance)}</Text>
        </OptionPickerTrigger>

        <Text style={styles.question}>
          Do you want someone who shares your specific sexual interests?
        </Text>
        <OptionPickerTrigger
          style={styles.row}
          onOpen={(anchor) =>
            openSingle(
              anchor,
              "Partner shares your interests",
              PREF_PARTNER_SHARES_SEXUAL_INTERESTS_OPTIONS,
              "prefPartnerSharesSexualInterests"
            )
          }
        >
          <Text style={styles.rowValue}>{truncLabel(value.prefPartnerSharesSexualInterests)}</Text>
        </OptionPickerTrigger>

        <Text style={styles.question}>
          In a relationship, what feels like your natural rhythm for sex?
        </Text>
        <OptionPickerTrigger
          style={styles.row}
          onOpen={(anchor) =>
            openSingle(anchor, 'Natural rhythm for sex', SEX_DRIVE_OPTIONS, 'sexDrive')
          }
        >
          <Text style={styles.rowValue}>{truncLabel(value.sexDrive)}</Text>
        </OptionPickerTrigger>

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

      <BottomSheet visible={!!sheet} title={sheet?.title} anchor={sheet?.anchor} onClose={() => setSheet(null)}>
        {sheet ? (
          <SingleChoiceOptionList
            options={(sheet.options ?? []).map((o) => ({ label: o, value: o }))}
            value={sheet.selectedValue}
            onSelect={(v) => {
              sheet.onPick(v);
              setSheet(null);
            }}
          />
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
};
