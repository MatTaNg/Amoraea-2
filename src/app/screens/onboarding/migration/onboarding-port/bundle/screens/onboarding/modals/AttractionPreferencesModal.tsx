import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { RangeSlider } from '@/shared/ui/RangeSlider';
import { BodyTypeAttractionSelect } from '@/shared/components/BodyTypeAttractionSelect';
import { type BodyTypeAttractionId } from '@/shared/constants/bodyTypeAttraction';
import {
  ETHNICITY_ATTRACTION_OPTIONS,
  ETHNICITY_ATTRACTION_OPEN_TO_ALL,
  normalizeEthnicityAttractionStored,
} from '@/shared/constants/ethnicityAttractionOptions';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './AttractionPreferencesModal.styled';

type AttractionPreferences = Record<string, unknown> & {
  ageRange?: [number, number];
  bodyTypeAttraction?: BodyTypeAttractionId[];
  heightDynamicPreference?: string;
  ethnicityAttraction?: string[];
};

const HEIGHT_DYNAMIC_OPTIONS = [
  'Much taller than me',
  'Slightly taller than me',
  'Around my height',
  'Shorter than me',
  'No strong preference',
] as const;

const ETHNICITY_ATTRACTION_OPTIONS = [
  'Black / African',
  'East Asian',
  'South Asian',
  'Southeast Asian',
  'Hispanic / Latino',
  'Middle Eastern',
  'White / European',
  'Mixed',
  'Indigenous',
  'Open to all',
] as const;

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

interface AttractionPreferencesModalProps {
  matchPreferences?: AttractionPreferences;
  userAge?: number;
  onMatchPreferencesChange: (preferences: AttractionPreferences) => void;
  onNext: () => void;
  onBack: () => void;
}

export const AttractionPreferencesModal: React.FC<AttractionPreferencesModalProps> = ({
  matchPreferences,
  userAge,
  onMatchPreferencesChange,
  onNext,
  onBack,
}) => {
  const defaultAgeMin = userAge != null ? Math.max(18, userAge - 5) : 18;
  const defaultAgeMax = userAge != null ? Math.min(100, userAge + 5) : 65;

  const [preferences, setPreferences] = useState<AttractionPreferences>(() => {
    const base = { ...(matchPreferences ?? {}) };
    const baseAgeRange = Array.isArray(base.ageRange) ? base.ageRange : null;
    if (baseAgeRange && baseAgeRange[0] === 18 && baseAgeRange[1] === 65 && userAge != null) {
      return { ...base, ageRange: [defaultAgeMin, defaultAgeMax] };
    }
    if (!baseAgeRange) {
      return { ...base, ageRange: [defaultAgeMin, defaultAgeMax] };
    }
    return base;
  });

  useEffect(() => {
    if (matchPreferences) {
      const baseAgeRange = Array.isArray(matchPreferences.ageRange) ? matchPreferences.ageRange : null;
      setPreferences(
        baseAgeRange ? matchPreferences : { ...matchPreferences, ageRange: [defaultAgeMin, defaultAgeMax] },
      );
    }
  }, [defaultAgeMax, defaultAgeMin, matchPreferences]);

  const setPref = (patch: Partial<AttractionPreferences>) => {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    onMatchPreferencesChange(next);
  };

  const preferencesAgeRange = Array.isArray(preferences.ageRange) ? preferences.ageRange : null;
  const ageMin = preferencesAgeRange?.[0] ?? defaultAgeMin;
  const ageMax = preferencesAgeRange?.[1] ?? defaultAgeMax;
  const heightDynamicPreference = String(preferences.heightDynamicPreference ?? '').trim();
  const ethnicityAttraction = useMemo(
    () => normalizeEthnicityAttractionStored(preferences.ethnicityAttraction),
    [preferences.ethnicityAttraction],
  );

  const toggleEthnicity = (option: string) => {
    if (option === ETHNICITY_ATTRACTION_OPEN_TO_ALL) {
      setPref({ ethnicityAttraction: [ETHNICITY_ATTRACTION_OPEN_TO_ALL] });
      return;
    }
    const withoutOpen = ethnicityAttraction.filter(
      (item) => item !== ETHNICITY_ATTRACTION_OPEN_TO_ALL,
    );
    const next = withoutOpen.includes(option)
      ? withoutOpen.filter((item) => item !== option)
      : [...withoutOpen, option];
    setPref({ ethnicityAttraction: next });
  };

  const canContinue =
    Array.isArray(preferencesAgeRange) &&
    heightDynamicPreference.length > 0 &&
    ethnicityAttraction.length > 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="What are you usually attracted to?" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Age range</Text>
              <Text style={styles.rowValue}>
                {ageMin} - {ageMax}
              </Text>
              <RangeSlider
                minValue={18}
                maxValue={100}
                initialMinValue={ageMin}
                initialMaxValue={ageMax}
                step={1}
                onValueChange={(min, max) =>
                  setPref({ ageRange: [min, max] as [number, number] })
                }
                minimumTrackTintColor="#7C3AED"
                maximumTrackTintColor="#32384A"
                showValueLabels={false}
              />
            </View>

            <View style={styles.row}>
              <BodyTypeAttractionSelect
                value={preferences.bodyTypeAttraction}
                onChange={(bodyTypeAttraction) => setPref({ bodyTypeAttraction })}
              />
            </View>

            <View style={styles.row}>
              <Text style={styles.question}>What height dynamic do you typically prefer?</Text>
              <View style={styles.optionList}>
                {HEIGHT_DYNAMIC_OPTIONS.map((option) => {
                  const selected = heightDynamicPreference === option;
                  return (
                    <Pressable
                      key={option}
                      style={[styles.optionRow, selected && styles.optionRowSelected]}
                      onPress={() => setPref({ heightDynamicPreference: option })}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={[styles.row, styles.lastRow]}>
              <Text style={styles.question}>Which ethnicities are you generally attracted to?</Text>
              <Text style={styles.helperText}>Select all that apply.</Text>
              <View style={styles.optionList}>
                {ETHNICITY_ATTRACTION_OPTIONS.map((option) => {
                  const selected = ethnicityAttraction.includes(option);
                  return (
                    <Pressable
                      key={option}
                      style={[styles.optionRow, selected && styles.optionRowSelected]}
                      onPress={() => toggleEthnicity(option)}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
      <SafeAreaView style={styles.buttonContainer} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonRow}>
          <Button title="Back" variant="outline" onPress={onBack} style={styles.backButton} />
          <Button
            title="Next"
            onPress={() => {
              onMatchPreferencesChange(preferences);
              onNext();
            }}
            disabled={!canContinue}
            style={styles.nextButton}
          />
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
};
