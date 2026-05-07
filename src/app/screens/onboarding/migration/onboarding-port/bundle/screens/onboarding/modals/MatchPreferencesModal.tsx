import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { OnboardingHeader } from './components/OnboardingHeader';
import {
  MatchPreferences,
  defaultPreferences,
} from '@/shared/hooks/filterPreferences/types';

import { RangeSlider } from '@/shared/ui/RangeSlider';
import { BodyTypeAttractionSelect } from '@/shared/components/BodyTypeAttractionSelect';
import {
  parseBodyTypeAttraction,
  type BodyTypeAttractionId,
} from '@/shared/constants/bodyTypeAttraction';
import {
  PREF_DEALBREAKER_CHILDREN_OPTIONS,
  PREF_DEALBREAKER_POLITICS_OPTIONS,
  PREF_DEALBREAKER_RELIGION_OPTIONS,
  PREF_PARTNER_HAS_CHILDREN_OPTIONS,
  PREF_PARTNER_POLITICAL_SHARING_OPTIONS,
  normalizePartnerPoliticalAlignmentToYesNo,
} from '@/screens/profile/editProfile/constants';
import { PARTNER_SUBSTANCE_ALIGNMENT_OPTIONS } from '@/shared/constants/filterOptions';
import {
  PREF_PHYSICAL_COMPAT_CENTRALITY_OPTIONS,
  PREF_PARTNER_SHARES_SEXUAL_INTERESTS_OPTIONS,
} from '@/shared/constants/sexualCompatibilityOptions';
import { BottomSheet, OptionPickerTrigger, type OptionAnchor } from '@/screens/profile/editProfile/BottomSheet';
import { styles } from './MatchPreferencesModal.styled';

type DealbreakerPreferences = MatchPreferences & {
  childrenPreference?: string;
  partnerAlignmentTobacco?: string;
  partnerAlignmentRecreationalDrugs?: string;
  partnerAlignmentPsychedelics?: string;
  partnerAlignmentCannabis?: string;
  partnerAlignmentAlcohol?: string;
};

const normalizeNoPreference = (value: unknown): string => {
  const v = String(value ?? "").trim();
  return v.toLowerCase() === "any" ? "No preference" : v;
};

const normalizeDealbreakerPreferences = (prefs: DealbreakerPreferences): DealbreakerPreferences => ({
  ...prefs,
  smokingPreference: normalizeNoPreference(prefs.smokingPreference),
  drinkingPreference: normalizeNoPreference(prefs.drinkingPreference),
  cannabisPreference: normalizeNoPreference(prefs.cannabisPreference),
  partnerAlignmentTobacco: normalizeNoPreference(prefs.partnerAlignmentTobacco),
  partnerAlignmentRecreationalDrugs: normalizeNoPreference(prefs.partnerAlignmentRecreationalDrugs),
  partnerAlignmentPsychedelics: normalizeNoPreference(prefs.partnerAlignmentPsychedelics),
  partnerAlignmentCannabis: normalizeNoPreference(prefs.partnerAlignmentCannabis),
  partnerAlignmentAlcohol: normalizeNoPreference(prefs.partnerAlignmentAlcohol),
});

const SUBSTANCE_PARTNER_DEALBREAKERS: {
  key: keyof DealbreakerPreferences;
  question: string;
}[] = [
  {
    key: 'partnerAlignmentTobacco',
    question:
      'How important is it that your partner shares your relationship with cigarettes or tobacco?',
  },
  {
    key: 'partnerAlignmentRecreationalDrugs',
    question:
      'How important is it that your partner shares your relationship with recreational drugs?',
  },
  {
    key: 'partnerAlignmentPsychedelics',
    question:
      'How important is it that your partner shares your relationship with psychedelics or plant medicines?',
  },
  {
    key: 'partnerAlignmentCannabis',
    question: 'How important is it that your partner shares your relationship with cannabis?',
  },
  {
    key: 'partnerAlignmentAlcohol',
    question: 'How important is it that your partner shares your relationship with alcohol?',
  },
];

/** Relationship style is edited on Edit Profile (`relationship_type`), not in dealbreakers. */
function withoutRelationshipType(
  prefs: MatchPreferences | DealbreakerPreferences
): DealbreakerPreferences {
  const { relationshipType: _, ...rest } = prefs as DealbreakerPreferences & {
    relationshipType?: string;
  };
  return rest as DealbreakerPreferences;
}

function truncDealbreaker(s: string, max = 80): string {
  const t = String(s ?? "").trim();
  if (!t) return "Select";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

interface MatchPreferencesModalProps {
  matchPreferences?: DealbreakerPreferences;
  location?: string;
  userAge?: number;
  prefPhysicalCompatImportance?: string;
  prefPartnerSharesSexualInterests?: string;
  onPrefPhysicalCompatImportanceChange?: (v: string) => void;
  onPrefPartnerSharesSexualInterestsChange?: (v: string) => void;
  prefPartnerHasChildren?: string;
  onPrefPartnerHasChildrenChange?: (v: string) => void;
  prefPartnerPoliticalAlignmentImportance?: string;
  onPrefPartnerPoliticalAlignmentImportanceChange?: (v: string) => void;
  onMatchPreferencesChange: (preferences: DealbreakerPreferences) => void;
  onNext: () => void;
  onBack: () => void;
}

export const MatchPreferencesModal: React.FC<MatchPreferencesModalProps> = ({
  matchPreferences,
  location: _location,
  userAge,
  prefPhysicalCompatImportance = '',
  prefPartnerSharesSexualInterests = '',
  onPrefPhysicalCompatImportanceChange,
  onPrefPartnerSharesSexualInterestsChange,
  prefPartnerHasChildren = '',
  onPrefPartnerHasChildrenChange,
  prefPartnerPoliticalAlignmentImportance = '',
  onPrefPartnerPoliticalAlignmentImportanceChange,
  onMatchPreferencesChange,
  onNext,
  onBack,
}) => {
  const defaultAgeMin = userAge != null ? Math.max(18, userAge - 5) : 18;
  const defaultAgeMax = userAge != null ? Math.min(100, userAge + 5) : 65;
  
  const [preferences, setPreferences] = useState<DealbreakerPreferences>(() => {
    const base = normalizeDealbreakerPreferences(
      withoutRelationshipType((matchPreferences || defaultPreferences) as DealbreakerPreferences)
    );
    if (base.ageRange && (base.ageRange[0] === 18 && base.ageRange[1] === 65) && userAge != null) {
      return {
        ...base,
        ageRange: [defaultAgeMin, defaultAgeMax] as [number, number],
      };
    }
    return base;
  });
  const [optionSheet, setOptionSheet] = useState<{
    title: string;
    options: readonly string[] | string[];
    selectedValue: string;
    onPick: (value: string) => void;
    anchor?: OptionAnchor;
  } | null>(null);

  useEffect(() => {
    if (matchPreferences) {
      setPreferences(
        normalizeDealbreakerPreferences(withoutRelationshipType(matchPreferences))
      );
    }
  }, [matchPreferences]);

  const setPref = useCallback(
    (patch: Partial<DealbreakerPreferences>) => {
      setPreferences((prevPrefs) => {
        const newPrefs = { ...prevPrefs, ...patch };
        onMatchPreferencesChange(withoutRelationshipType(newPrefs));
        return newPrefs;
      });
    },
    [onMatchPreferencesChange]
  );

  const ageMin = preferences.ageRange?.[0] != null ? String(preferences.ageRange[0]) : "";
  const ageMax = preferences.ageRange?.[1] != null ? String(preferences.ageRange[1]) : "";
  const canContinue = true; // No longer require gender preference

  const onBodyTypeAttractionChange = useCallback(
    (next: BodyTypeAttractionId[]) => {
      setPreferences((prevPrefs) => {
        const { bmiRange: _legacyBmi, ...rest } = prevPrefs;
        const newPrefs: DealbreakerPreferences =
          next.length > 0 ? { ...rest, bodyTypeAttraction: next } : { ...rest };
        onMatchPreferencesChange(withoutRelationshipType(newPrefs));
        return newPrefs;
      });
    },
    [onMatchPreferencesChange]
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="Dealbreakers" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.description}>
            Set your dealbreakers for who you'd like to see and match with. This can be changed later.
          </Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Age range</Text>
              <Text style={styles.rowValue}>{ageMin} - {ageMax}</Text>
              <RangeSlider
                minValue={18}
                maxValue={100}
                initialMinValue={preferences.ageRange?.[0] ?? defaultAgeMin}
                initialMaxValue={preferences.ageRange?.[1] ?? defaultAgeMax}
                step={1}
                onValueChange={(min, max) =>
                  setPref({ ageRange: [min, max] as [number, number] })
                }
                minimumTrackTintColor="#7C3AED"
                maximumTrackTintColor="#32384A"
              />
            </View>

            <Text style={styles.dealbreakerQuestion}>
              How central is physical and sexual compatibility for you in a relationship?
            </Text>
            <OptionPickerTrigger
              style={styles.dealbreakerPickRow}
              onOpen={(anchor) =>
                setOptionSheet({
                  title: 'Physical & sexual compatibility',
                  options: PREF_PHYSICAL_COMPAT_CENTRALITY_OPTIONS as unknown as string[],
                  selectedValue: prefPhysicalCompatImportance,
                  anchor,
                  onPick: (value) => {
                    onPrefPhysicalCompatImportanceChange?.(value);
                    setOptionSheet(null);
                  },
                })
              }
            >
              <Text style={styles.dealbreakerPickText}>
                {truncDealbreaker(prefPhysicalCompatImportance)}
              </Text>
            </OptionPickerTrigger>

            <Text style={styles.dealbreakerQuestion}>
              Do you want someone who shares your specific sexual interests?
            </Text>
            <OptionPickerTrigger
              style={styles.dealbreakerPickRow}
              onOpen={(anchor) =>
                setOptionSheet({
                  title: 'Partner shares your interests',
                  options: PREF_PARTNER_SHARES_SEXUAL_INTERESTS_OPTIONS as unknown as string[],
                  selectedValue: prefPartnerSharesSexualInterests,
                  anchor,
                  onPick: (value) => {
                    onPrefPartnerSharesSexualInterestsChange?.(value);
                    setOptionSheet(null);
                  },
                })
              }
            >
              <Text style={styles.dealbreakerPickText}>
                {truncDealbreaker(prefPartnerSharesSexualInterests)}
              </Text>
            </OptionPickerTrigger>

            <Text style={styles.dealbreakerQuestion}>
              Is it OK if your match already has children?
            </Text>
            <OptionPickerTrigger
              style={styles.dealbreakerPickRow}
              onOpen={(anchor) =>
                setOptionSheet({
                  title: "Partner already has children",
                  options: PREF_PARTNER_HAS_CHILDREN_OPTIONS as unknown as string[],
                  selectedValue: prefPartnerHasChildren,
                  anchor,
                  onPick: (value) => {
                    onPrefPartnerHasChildrenChange?.(value);
                    setOptionSheet(null);
                  },
                })
              }
            >
              <Text style={styles.dealbreakerPickText}>
                {prefPartnerHasChildren.trim()
                  ? truncDealbreaker(prefPartnerHasChildren)
                  : 'No preference'}
              </Text>
            </OptionPickerTrigger>

            <Text style={styles.dealbreakerQuestion}>
              Is it important for your partner to share the same political views as you?
            </Text>
            <OptionPickerTrigger
              style={styles.dealbreakerPickRow}
              onOpen={(anchor) =>
                setOptionSheet({
                  title: "Partner shares your political views",
                  options: PREF_PARTNER_POLITICAL_SHARING_OPTIONS as unknown as string[],
                  selectedValue: prefPartnerPoliticalAlignmentImportance,
                  anchor,
                  onPick: (value) => {
                    onPrefPartnerPoliticalAlignmentImportanceChange?.(value);
                    setOptionSheet(null);
                  },
                })
              }
            >
              <Text style={styles.dealbreakerPickText}>
                {prefPartnerPoliticalAlignmentImportance.trim()
                  ? truncDealbreaker(
                      normalizePartnerPoliticalAlignmentToYesNo(prefPartnerPoliticalAlignmentImportance)
                    )
                  : "Select"}
              </Text>
            </OptionPickerTrigger>

            {SUBSTANCE_PARTNER_DEALBREAKERS.map(({ key, question }) => (
              <View key={key}>
                <Text style={styles.dealbreakerQuestion}>{question}</Text>
                <OptionPickerTrigger
                  style={styles.dealbreakerPickRow}
                  onOpen={(anchor) =>
                    setOptionSheet({
                      title: question,
                      options: PARTNER_SUBSTANCE_ALIGNMENT_OPTIONS,
                      selectedValue: String((preferences as any)[key] ?? ''),
                      anchor,
                      onPick: (value) => {
                        setPref({ [key]: value } as Partial<DealbreakerPreferences>);
                        setOptionSheet(null);
                      },
                    })
                  }
                >
                  <Text style={styles.dealbreakerPickText}>
                    {String((preferences as any)[key] ?? '').trim()
                      ? truncDealbreaker(String((preferences as any)[key]))
                      : 'Select'}
                  </Text>
                </OptionPickerTrigger>
              </View>
            ))}

            <BodyTypeAttractionSelect
              value={parseBodyTypeAttraction(preferences.bodyTypeAttraction)}
              onChange={onBodyTypeAttractionChange}
            />

            {(
              [
                [
                  "Partner wants children",
                  PREF_DEALBREAKER_CHILDREN_OPTIONS as unknown as string[],
                  "childrenPreference",
                ],
                ["Politics", PREF_DEALBREAKER_POLITICS_OPTIONS as unknown as string[], "politicsPreference"],
                ["Religion", PREF_DEALBREAKER_RELIGION_OPTIONS as unknown as string[], "religionPreference"],
              ] as [string, string[], keyof DealbreakerPreferences][]
            ).map(([label, options, key]) => (
              <OptionPickerTrigger
                key={key}
                style={styles.row}
                onOpen={(anchor) =>
                  setOptionSheet({
                    title: label,
                    options,
                    selectedValue: String((preferences as any)[key] ?? ""),
                    anchor,
                    onPick: (value) =>
                      setPref({ [key]: value } as Partial<DealbreakerPreferences>),
                  })
                }
              >
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowValue}>
                  {String((preferences as any)[key] || "No preference")}
                </Text>
              </OptionPickerTrigger>
            ))}
          </View>
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
      <BottomSheet
        visible={!!optionSheet}
        title={optionSheet?.title}
        anchor={optionSheet?.anchor}
        onClose={() => setOptionSheet(null)}
      >
        {optionSheet ? (
          <SingleChoiceOptionList
            options={(optionSheet.options ?? []).map((o) => ({ label: o, value: o }))}
            value={optionSheet.selectedValue}
            onSelect={(v) => {
              optionSheet.onPick(v);
              setOptionSheet(null);
            }}
          />
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
};


