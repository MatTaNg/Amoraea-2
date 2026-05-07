import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView, Text, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { requestMyLocationLabel } from '@/screens/profile/utils/locationHelpers';
import { OnboardingHeader } from './components/OnboardingHeader';
import { styles } from './LocationModal.styled';

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
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [hasAttemptedLocation, setHasAttemptedLocation] = useState(false);
  const locationReceivedRef = useRef(false);

  // Automatically get location when screen mounts
  useEffect(() => {
    if (!location.trim() && !hasAttemptedLocation) {
      getLocation();
    } else if (location.trim()) {
      // If location is already set, mark as attempted
      setHasAttemptedLocation(true);
    }
  }, []);

  // Clear error when location is successfully set
  useEffect(() => {
    if (location.trim() && locationError) {
      setLocationError(null);
    }
  }, [location]);

  const getLocation = async () => {
    if (isGettingLocation) return; // Prevent multiple calls
    
    setIsGettingLocation(true);
    setLocationError(null);
    setHasAttemptedLocation(true);
    locationReceivedRef.current = false;
    
    // Set timeout before making the async call
    // This handles cases where permission is denied and callback isn't called
    const timeoutId = setTimeout(() => {
      if (!locationReceivedRef.current) {
        setIsGettingLocation(false);
        // Only set error if location hasn't been set yet
        // This prevents showing error when location was actually received
        if (!location.trim()) {
          setLocationError('Location is required to continue. Please enable location services in your device settings and try again.');
        }
      }
    }, 5000); // 5 second timeout to check if callback was called
    
    try {
      const loc = await requestMyLocationLabel();
      clearTimeout(timeoutId);
      locationReceivedRef.current = true;
      if (loc?.trim()) {
        onLocationChange(loc.trim());
        setIsGettingLocation(false);
        setLocationError(null);
      } else {
        setIsGettingLocation(false);
        setLocationError('Location could not be determined. Please try again.');
      }
    } catch (error) {
      clearTimeout(timeoutId);
      setIsGettingLocation(false);
      setLocationError('Unable to get your location. Please try again.');
    }
  };

  const canContinue = location.trim().length > 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <OnboardingHeader title="I am located at" onBack={onBack} />
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.description}>
            We use your location to find matches nearby. Location is detected automatically — you don't need to enter it manually.
          </Text>

          {isGettingLocation && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#007AFF" />
              <Text style={styles.loadingText}>Finding your location...</Text>
            </View>
          )}

          {!isGettingLocation && location.trim() && (
            <View style={styles.locationContainer}>
              <Text style={styles.locationLabel}>Your location:</Text>
              <Text style={styles.locationValue}>{location}</Text>
            </View>
          )}

          {!isGettingLocation && locationError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{locationError}</Text>
              <Button
                title="Try Again"
                variant="outline"
                onPress={getLocation}
                style={styles.retryButton}
              />
            </View>
          )}

          {!isGettingLocation && !location.trim() && !locationError && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>
                Location could not be detected. Please try again.
              </Text>
              <Button
                title="Try Again"
                variant="outline"
                onPress={getLocation}
                style={styles.retryButton}
              />
            </View>
          )}
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

