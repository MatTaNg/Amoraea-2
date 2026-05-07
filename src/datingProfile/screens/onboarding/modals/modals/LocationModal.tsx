import React, { useEffect } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { LocationInput } from '@/shared/components/BasicInfoForm/LocationInput';
import { useLocationAutocomplete } from '@/shared/hooks/useLocationAutocomplete';
import { requestMyLocationLabel } from '@/screens/profile/utils/locationHelpers';
import { OnboardingHeader } from '../components/OnboardingHeader';
import { styles } from '../LocationModal.styled';

interface LocationModalProps {
  location: string;
  onLocationChange: (location: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  location,
  onLocationChange,
  onNext,
  onBack,
}) => {
  const [locationSuggestions, setLocationSuggestions] = React.useState<Array<{ label: string }>>([]);
  const [validatedLocation, setValidatedLocation] = React.useState<string | undefined>(undefined);

  useLocationAutocomplete({
    value: location,
    validatedValue: validatedLocation,
    onSuggestionsChange: setLocationSuggestions,
  });

  // Auto-fill location when screen mounts if empty
  useEffect(() => {
    if (location.trim()) return;
    let cancelled = false;
    (async () => {
      const loc = await requestMyLocationLabel();
      if (cancelled || !loc) return;
      onLocationChange(loc);
      setValidatedLocation(loc);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLocationSuggestionSelect = (selectedLocation: string) => {
    onLocationChange(selectedLocation);
    setValidatedLocation(selectedLocation);
    setLocationSuggestions([]);
  };

  const handleUseMyLocation = async () => {
    const loc = await requestMyLocationLabel();
    if (!loc) return;
    onLocationChange(loc);
    setValidatedLocation(loc);
    setLocationSuggestions([]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <OnboardingHeader title="I am located at" onBack={onBack} />
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <LocationInput
            value={location}
            onChangeText={onLocationChange}
            locationSuggestions={locationSuggestions}
            onLocationSuggestionSelect={handleLocationSuggestionSelect}
            onUseMyLocation={handleUseMyLocation}
            validatedLocation={validatedLocation}
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
              disabled={!location.trim() || !validatedLocation}
              style={styles.nextButton}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

