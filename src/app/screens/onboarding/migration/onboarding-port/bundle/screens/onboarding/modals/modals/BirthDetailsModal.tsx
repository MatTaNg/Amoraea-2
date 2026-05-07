import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '@/shared/ui/Input';
import { Button } from '@/shared/ui/Button';
import { DatePicker, TimePicker } from '@/shared/components/DatePicker';
import { useLocationAutocomplete } from '@/shared/hooks/useLocationAutocomplete';
import { OnboardingHeader } from '../components/OnboardingHeader';
import { styles } from '../BirthDetailsModal.styled';

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

  useLocationAutocomplete({
    value: birthPlace,
    validatedValue: validatedLocation,
    onSuggestionsChange: setLocationSuggestions,
  });

  const handleLocationSuggestionSelect = (selectedLocation: string) => {
    onBirthPlaceChange(selectedLocation);
    setValidatedLocation(selectedLocation);
    setLocationSuggestions([]);
  };

  const canContinue = birthPlace.trim() && birthDate.trim() && birthTime.trim() && validatedLocation;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <OnboardingHeader title="Birth Details" onBack={onBack} />
      <ScrollView 
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
            value={birthPlace}
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
          
          {birthPlace.trim() && locationSuggestions.length > 0 && (
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

          <DatePicker
            label="Birth Date *"
            value={birthDate}
            onValueChange={onBirthDateChange}
            maxYear={new Date().getFullYear() - 18}
          />

          <TimePicker
            label="Birth Time *"
            value={birthTime}
            onValueChange={onBirthTimeChange}
          />

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
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

