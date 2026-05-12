import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { OnboardingHeader } from './components/OnboardingHeader';
import {
  MatchPreferences,
  defaultPreferences,
} from '@/shared/hooks/filterPreferences/types';

import { formControlStyles } from '@/shared/ui/FormField';
import {
  PREF_LIFESTYLE_OPTIONS,
  PREF_LONG_TERM_LOCATION_OPTIONS,
  PREF_RELOCATION_OPTIONS,
} from '@/screens/profile/editProfile/constants';
import { BottomSheet, OptionPickerTrigger, type OptionAnchor } from '@/screens/profile/editProfile/BottomSheet';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
import { styles } from './MatchPreferencesModal.styled';

type DealbreakerPreferences = MatchPreferences & {
  longTermLivingPreference?: string;
  lifestylePreference?: string;
  relocationPreference?: string;
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
});

const LIFESTYLE_DEALBREAKERS: {
  key: keyof Pick<
    DealbreakerPreferences,
    'longTermLivingPreference' | 'lifestylePreference' | 'relocationPreference'
  >;
  question: string;
  options: readonly string[];
}[] = [
  {
    key: 'longTermLivingPreference',
    question: 'Where do you see yourself living long term?',
    options: PREF_LONG_TERM_LOCATION_OPTIONS,
  },
  {
    key: 'lifestylePreference',
    question: 'Which lifestyle feels most like you?',
    options: PREF_LIFESTYLE_OPTIONS,
  },
  {
    key: 'relocationPreference',
    question: 'Would you relocate for the right relationship?',
    options: PREF_RELOCATION_OPTIONS,
  },
];

const REQUIRED_DEALBREAKER_KEYS: (keyof DealbreakerPreferences)[] = [
  'longTermLivingPreference',
  'lifestylePreference',
  'relocationPreference',
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
  onMatchPreferencesChange: (preferences: DealbreakerPreferences) => void;
  onNext: () => void;
  onBack: () => void;
}

export const MatchPreferencesModal: React.FC<MatchPreferencesModalProps> = ({
  matchPreferences,
  onMatchPreferencesChange,
  onNext,
  onBack,
}) => {
  const [preferences, setPreferences] = useState<DealbreakerPreferences>(() => {
    const base = normalizeDealbreakerPreferences(
      withoutRelationshipType((matchPreferences || defaultPreferences) as DealbreakerPreferences)
    );
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

  const canContinue = REQUIRED_DEALBREAKER_KEYS.every((key) =>
    String((preferences as Record<string, unknown>)[key] ?? '').trim(),
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="Lifestyle" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.card}>
            {LIFESTYLE_DEALBREAKERS.map(({ key, question, options }) => (
              <View key={key}>
                <Text style={styles.dealbreakerQuestion}>{question}</Text>
                <OptionPickerTrigger
                  style={[styles.dealbreakerPickRow, formControlStyles.control]}
                  onOpen={(anchor) =>
                    setOptionSheet({
                      title: question,
                      options,
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


