import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ONBOARDING_STEP_SCREEN_EDGES, ONBOARDING_STEP_SCREEN_EDGES_WITH_BOTTOM } from './onboardingStepScreenEdges';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { OnboardingHeader } from './components/OnboardingHeader';
import {
  MatchPreferences,
  defaultPreferences,
} from '@/shared/hooks/filterPreferences/types';
import {
  PREF_LIFESTYLE_OPTIONS,
  PREF_LONG_TERM_LOCATION_OPTIONS,
  PREF_RELOCATION_OPTIONS,
} from '@/screens/profile/editProfile/constants';
import { SingleChoiceOptionList } from '@/shared/components/profileFields/SingleChoiceOptionList';
import { styles } from './MatchPreferencesModal.styled';

type DealbreakerPreferences = MatchPreferences & {
  longTermLivingPreference?: string;
  lifestylePreference?: string;
  relocationPreference?: string;
};

const normalizeNoPreference = (value: unknown): string => {
  const v = String(value ?? '').trim();
  return v.toLowerCase() === 'any' ? 'No preference' : v;
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
  prefs: MatchPreferences | DealbreakerPreferences,
): DealbreakerPreferences {
  const { relationshipType: _, ...rest } = prefs as DealbreakerPreferences & {
    relationshipType?: string;
  };
  return rest as DealbreakerPreferences;
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
      withoutRelationshipType((matchPreferences || defaultPreferences) as DealbreakerPreferences),
    );
    return base;
  });
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  useEffect(() => {
    if (matchPreferences) {
      setPreferences(normalizeDealbreakerPreferences(withoutRelationshipType(matchPreferences)));
    }
  }, [matchPreferences]);

  const setPref = useCallback(
    (patch: Partial<DealbreakerPreferences>) => {
      const nextPrefs = { ...preferencesRef.current, ...patch };
      preferencesRef.current = nextPrefs;
      setPreferences(nextPrefs);
      onMatchPreferencesChange(withoutRelationshipType(nextPrefs));
    },
    [onMatchPreferencesChange],
  );

  const canContinue = REQUIRED_DEALBREAKER_KEYS.every((key) =>
    String((preferences as Record<string, unknown>)[key] ?? '').trim(),
  );

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Lifestyle" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {LIFESTYLE_DEALBREAKERS.map(({ key, question, options }, index) => (
            <View
              key={key}
              style={[styles.questionBlock, index > 0 && styles.questionBlockSpaced]}
            >
              <Text style={styles.questionTitle}>{question}</Text>
              <SingleChoiceOptionList
                options={options.map((o) => ({ label: o, value: o }))}
                value={String((preferences as Record<string, unknown>)[key] ?? '')}
                onSelect={(value) => setPref({ [key]: value } as Partial<DealbreakerPreferences>)}
              />
            </View>
          ))}
        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backButton} />
          <Button
            title="Next"
            onPress={onNext}
            disabled={!canContinue}
            style={styles.nextButton}
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
