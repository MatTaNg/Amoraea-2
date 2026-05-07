import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { OnboardingHeader } from '../components/OnboardingHeader';
import { BasicFiltersSection } from '@/shared/components/filters/BasicFiltersSection';
import { NarrowMatchFiltersSection } from '@/shared/components/filters/NarrowMatchFiltersSection';
import { isMetricCountry } from '@/shared/utils/metricHelpers';
import { MatchPreferences, defaultPreferences } from '@/shared/hooks/filterPreferences/types';
import { styles } from './MatchPreferencesModal.styled';

interface MatchPreferencesModalProps {
  matchPreferences?: MatchPreferences;
  location?: string;
  onMatchPreferencesChange: (preferences: MatchPreferences) => void;
  onNext: () => void;
  onBack: () => void;
}

export const MatchPreferencesModal: React.FC<MatchPreferencesModalProps> = ({
  matchPreferences,
  location,
  onMatchPreferencesChange,
  onNext,
  onBack,
}) => {
  const isMetric = useMemo(() => isMetricCountry(location || ''), [location]);
  
  const [preferences, setPreferences] = useState<MatchPreferences>(
    matchPreferences || defaultPreferences
  );

  useEffect(() => {
    if (matchPreferences) {
      setPreferences(matchPreferences);
    }
  }, [matchPreferences]);

  const handleDistanceChange = (min: number, max: number) => {
    const newPrefs = { ...preferences, distanceRange: [min, max] as [number, number] };
    setPreferences(newPrefs);
    onMatchPreferencesChange(newPrefs);
  };

  const handleAgeChange = (min: number, max: number) => {
    const newPrefs = { ...preferences, ageRange: [min, max] as [number, number] };
    setPreferences(newPrefs);
    onMatchPreferencesChange(newPrefs);
  };

  const handleGenderChange = (_value: string | string[]) => {
    // Gender not shown in this modal; kept for BasicFiltersSection API
  };

  const canContinue = true;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="Match Preferences" />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.description}>
            Set your preferences for who you'd like to see and match with.
          </Text>

          <BasicFiltersSection
            distanceRange={preferences.distanceRange}
            ageRange={preferences.ageRange}
            genderPreference={[]}
            isMetric={isMetric}
            onDistanceChange={handleDistanceChange}
            onAgeChange={handleAgeChange}
            onGenderChange={handleGenderChange}
          />

          <NarrowMatchFiltersSection
            politicsPreference={preferences.politicsPreference ?? 'any'}
            religionPreference={preferences.religionPreference ?? 'any'}
            onPoliticsChange={(value) => {
              const newPrefs = { ...preferences, politicsPreference: value };
              setPreferences(newPrefs);
              onMatchPreferencesChange(newPrefs);
            }}
            onReligionChange={(value) => {
              const newPrefs = { ...preferences, religionPreference: value };
              setPreferences(newPrefs);
              onMatchPreferencesChange(newPrefs);
            }}
          />
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
    </SafeAreaView>
  );
};


