import React, { useMemo, useState, useCallback } from 'react';
import { ONBOARDING_STEP_SCREEN_EDGES, ONBOARDING_STEP_SCREEN_EDGES_WITH_BOTTOM } from './onboardingStepScreenEdges';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { DatePicker } from '@/shared/components/DatePicker';
import { BirthTimeQuarterHourPicker, isValidOptionalBirthTime24h } from '@/shared/components/BirthTimeQuarterHourPicker';
import { Input } from '@/shared/ui/Input';
import { OnboardingHeader } from './components/OnboardingHeader';
import { calculateAgeFromBirthdate, MIN_USER_AGE } from '@/shared/utils/ageCalculator';
import { useLocationAutocomplete } from '@/shared/hooks/useLocationAutocomplete';
import { theme } from '@/shared/theme/theme';
import { styles } from './DateOfBirthModal.styled';

const MIN_AGE = MIN_USER_AGE;

interface DateOfBirthModalProps {
  dateOfBirth: string;
  onDateOfBirthChange: (date: string) => void;
  birthTime: string;
  onBirthTimeChange: (value: string) => void;
  birthLocation: string;
  onBirthLocationChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const DateOfBirthModal: React.FC<DateOfBirthModalProps> = ({
  dateOfBirth,
  onDateOfBirthChange,
  birthTime,
  onBirthTimeChange,
  birthLocation,
  onBirthLocationChange,
  onNext,
  onBack,
}) => {
  const age = useMemo(
    () => (dateOfBirth ? calculateAgeFromBirthdate(dateOfBirth) : null),
    [dateOfBirth]
  );
  const [birthLocationSuggestions, setBirthLocationSuggestions] = useState<
    Array<{ label: string }>
  >([]);
  const [validatedBirthLocation, setValidatedBirthLocation] = useState<string | undefined>(
    undefined
  );

  const isUnderage = age !== null && age < MIN_AGE;
  const timeOk = isValidOptionalBirthTime24h(birthTime);
  const birthLocationTrimmed = birthLocation.trim();
  const birthLocationOk =
    !birthLocationTrimmed || validatedBirthLocation === birthLocationTrimmed;

  const canContinue =
    !!dateOfBirth && !!dateOfBirth.trim() && !isUnderage && timeOk && birthLocationOk;

  const onBirthSuggestionsChange = useCallback((suggestions: Array<{ label: string }>) => {
    setBirthLocationSuggestions(suggestions);
  }, []);

  const { isSearchingPlaces: birthLocationPlacesLoading } = useLocationAutocomplete({
    value: birthLocation,
    validatedValue: validatedBirthLocation,
    onSuggestionsChange: onBirthSuggestionsChange,
    minLength: 3,
  });

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Date of Birth" onBack={onBack} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <DatePicker
            label="Date of birth"
            value={dateOfBirth || ''}
            onValueChange={onDateOfBirthChange}
            minYear={1900}
            minimumAge={MIN_AGE}
          />
          {isUnderage && (
            <Text style={styles.errorText}>
              You must be 18 or older to use this app.
            </Text>
          )}

          <View style={styles.optionalSection}>
            <Text style={styles.optionalHint}>
              The following fields are optional. They can improve astrology and
              compatibility insights if you choose to add them.
            </Text>
            <BirthTimeQuarterHourPicker
              label="Time of birth (optional)"
              value={birthTime}
              onValueChange={onBirthTimeChange}
            />
            <View style={styles.optionalLocationNarrow}>
              <Input
                label="Location of birth (optional)"
                value={birthLocation}
                onChangeText={(v) => {
                  onBirthLocationChange(v);
                  if (v.trim() === '') {
                    setValidatedBirthLocation(undefined);
                  } else if (
                    validatedBirthLocation !== undefined &&
                    v.trim() !== validatedBirthLocation
                  ) {
                    setValidatedBirthLocation(undefined);
                  }
                }}
                placeholder="e.g. city, region, or hospital"
                autoCapitalize="words"
              />
              {birthLocationPlacesLoading ? (
                <View style={styles.placeSearchLoadingRow}>
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                  <Text style={styles.placeSearchLoadingText}>Looking up places…</Text>
                </View>
              ) : null}
              {birthLocationSuggestions.length > 0 && !validatedBirthLocation && (
                <View style={styles.suggestionsContainer}>
                  {birthLocationSuggestions.map((s, idx) => (
                    <TouchableOpacity
                      key={`${idx}-${s.label.slice(0, 40)}`}
                      style={styles.suggestionButton}
                      onPress={() => {
                        onBirthLocationChange(s.label);
                        setValidatedBirthLocation(s.label);
                        setBirthLocationSuggestions([]);
                      }}
                    >
                      <Text style={styles.suggestionText}>{s.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {birthLocationTrimmed && !birthLocationOk && !birthLocationPlacesLoading ? (
                <Text style={styles.errorText}>
                  {birthLocationSuggestions.length > 0
                    ? 'Please select a location from the suggestions above.'
                    : 'Keep typing until matching places appear, then select one from the list.'}
                </Text>
              ) : null}
            </View>
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
    </SafeAreaView>
  );
};
