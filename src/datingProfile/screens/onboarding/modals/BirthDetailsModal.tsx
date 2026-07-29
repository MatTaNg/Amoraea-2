import React from 'react';
import { ONBOARDING_STEP_SCREEN_EDGES, ONBOARDING_STEP_SCREEN_EDGES_WITH_BOTTOM } from './onboardingStepScreenEdges';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { DatePicker, TimePicker } from '@/shared/components/DatePicker';
import { useLocationAutocomplete } from '@/shared/hooks/useLocationAutocomplete';
import { theme } from '@/shared/theme/theme';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './BirthDetailsModal.styled';

interface BirthDetailsModalProps {
  birthPlace: string;
  birthDate: string;
  birthTime: string;
  onBirthPlaceChange: (place: string) => void;
  onBirthDateChange: (date: string) => void;
  onBirthTimeChange: (time: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const BirthDetailsModal: React.FC<BirthDetailsModalProps> = ({
  birthPlace,
  birthDate,
  birthTime,
  onBirthPlaceChange,
  onBirthDateChange,
  onBirthTimeChange,
  onNext,
  onBack,
}) => {
  const [locationSuggestions, setLocationSuggestions] = React.useState<Array<{ label: string }>>([]);
  const [validatedLocation, setValidatedLocation] = React.useState<string | undefined>(undefined);

  // Memoize the callback to prevent infinite loops
  const handleSuggestionsChange = React.useCallback((suggestions: Array<{ label: string }>) => {
    setLocationSuggestions(suggestions);
  }, []);

  const { isSearchingPlaces: birthPlacePlacesLoading } = useLocationAutocomplete({
    value: birthPlace,
    validatedValue: validatedLocation,
    onSuggestionsChange: handleSuggestionsChange,
  });

  const handleLocationSuggestionSelect = (selectedLocation: string) => {
    onBirthPlaceChange(selectedLocation);
    setValidatedLocation(selectedLocation);
    setLocationSuggestions([]);
  };

  const birthPlaceTrimmed = birthPlace.trim();
  const locationOk = !!validatedLocation && validatedLocation === birthPlaceTrimmed;
  const canContinue =
    !!birthPlaceTrimmed && !!birthDate.trim() && !!birthTime.trim() && locationOk;

  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Birth Details" onBack={onBack} />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.note}>
            We use this data to pull from ancient wisdom such as Vedic astrology and Human Design
            to help you find more meaningful connections.
          </Text>

          <Input
            label="Birth Place *"
            value={birthPlace || ''}
            onChangeText={(text) => {
              onBirthPlaceChange(text);
              if (text.trim() === '') {
                setValidatedLocation(undefined);
              } else if (
                validatedLocation !== undefined &&
                text.trim() !== validatedLocation
              ) {
                setValidatedLocation(undefined);
              }
            }}
            placeholder="City, State or City, Country"
          />

          {birthPlacePlacesLoading ? (
            <View style={styles.placeSearchLoadingRow}>
              <ActivityIndicator size="small" color={theme.colors.primary} />
              <Text style={styles.placeSearchLoadingText}>Looking up places…</Text>
            </View>
          ) : null}

          {birthPlaceTrimmed && locationSuggestions.length > 0 && !validatedLocation && (
            <View style={styles.suggestionsContainer}>
              {locationSuggestions.map((s, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.suggestionButton}
                  onPress={() => handleLocationSuggestionSelect(s.label)}
                >
                  <Text style={styles.suggestionText}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          {birthPlaceTrimmed && !locationOk && !birthPlacePlacesLoading ? (
            <Text style={styles.errorText}>
              {locationSuggestions.length > 0
                ? 'Please select a birth place from the suggestions above.'
                : 'Keep typing until matching places appear, then select one from the list.'}
            </Text>
          ) : null}

          <DatePicker
            label="Birth Date *"
            value={birthDate}
            onValueChange={onBirthDateChange}
          />

          <TimePicker
            label="Birth Time *"
            value={birthTime}
            onValueChange={onBirthTimeChange}
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

