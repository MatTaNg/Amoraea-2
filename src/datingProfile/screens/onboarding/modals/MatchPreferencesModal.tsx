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

/** First unanswered lifestyle question, or the last one when every question is already answered. */
export function resumeLifestyleQuestionIndex(prefs: DealbreakerPreferences): number {
  const index = LIFESTYLE_DEALBREAKERS.findIndex(
    ({ key }) => !String(prefs[key] ?? '').trim(),
  );
  if (index === -1) return LIFESTYLE_DEALBREAKERS.length - 1;
  return index;
}

/** Back from the following step should reopen the last lifestyle question. */
export function initialLifestyleQuestionIndex(
  prefs: DealbreakerPreferences,
  startAtLastQuestion: boolean,
): number {
  if (startAtLastQuestion) return LIFESTYLE_DEALBREAKERS.length - 1;
  return resumeLifestyleQuestionIndex(prefs);
}

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
  /** When true, open on the relocate question instead of the first unanswered one. */
  startAtLastQuestion?: boolean;
  onMatchPreferencesChange: (preferences: DealbreakerPreferences) => void;
  onNext: () => void;
  onBack: () => void;
}

export const MatchPreferencesModal: React.FC<MatchPreferencesModalProps> = ({
  matchPreferences,
  startAtLastQuestion = false,
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
  const [questionIndex, setQuestionIndex] = useState(() =>
    initialLifestyleQuestionIndex(preferences, startAtLastQuestion),
  );
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  useEffect(() => {
    if (matchPreferences) {
      setPreferences(normalizeDealbreakerPreferences(withoutRelationshipType(matchPreferences)));
    }
  }, [matchPreferences]);

  useEffect(() => {
    if (startAtLastQuestion) {
      setQuestionIndex(LIFESTYLE_DEALBREAKERS.length - 1);
    }
  }, [startAtLastQuestion]);

  const setPref = useCallback(
    (patch: Partial<DealbreakerPreferences>) => {
      const nextPrefs = { ...preferencesRef.current, ...patch };
      preferencesRef.current = nextPrefs;
      setPreferences(nextPrefs);
      onMatchPreferencesChange(withoutRelationshipType(nextPrefs));
    },
    [onMatchPreferencesChange],
  );

  const currentQuestion = LIFESTYLE_DEALBREAKERS[questionIndex] ?? LIFESTYLE_DEALBREAKERS[0];

  const handleBack = () => {
    if (questionIndex > 0) {
      setQuestionIndex(questionIndex - 1);
      return;
    }
    onBack();
  };

  const handleSelect = (value: string) => {
    setPref({ [currentQuestion.key]: value } as Partial<DealbreakerPreferences>);
    if (questionIndex < LIFESTYLE_DEALBREAKERS.length - 1) {
      setQuestionIndex(questionIndex + 1);
      return;
    }
    onNext();
  };

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Lifestyle" onBack={handleBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.questionBlock}>
            <Text style={styles.questionTitle}>{currentQuestion.question}</Text>
            <SingleChoiceOptionList
              options={currentQuestion.options.map((o) => ({ label: o, value: o }))}
              value={String(preferences[currentQuestion.key] ?? '')}
              onSelect={handleSelect}
            />
          </View>
        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button title="Back" variant="outline" onPress={handleBack} style={styles.backButton} />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
