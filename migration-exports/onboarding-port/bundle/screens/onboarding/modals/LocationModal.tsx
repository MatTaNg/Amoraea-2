import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView, Text, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import * as Location from 'expo-location';
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
    // Web browsers are more reliable when geolocation permission is requested from an explicit user action.
    if (Platform.OS === 'web') return;
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
    
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.isSecureContext) {
      setLocationError(
        'Browser location permission requires a secure context (https). Please open this page over https and try again.',
      );
      setHasAttemptedLocation(true);
      setIsGettingLocation(false);
      return;
    }

    setIsGettingLocation(true);
    setLocationError(null);
    setHasAttemptedLocation(true);
    locationReceivedRef.current = false;
    
    // Slow GPS + reverse geocode often exceeds a few seconds; a short timeout caused a false "Try Again" flash
    // before success. Re-check after the tick so we don't race the same frame as a late resolve.
    const LOCATION_STALL_MS = 22_000;
    const timeoutId = setTimeout(() => {
      const showStallError = () => {
        if (locationReceivedRef.current) return;
        setIsGettingLocation(false);
        setLocationError(
          'Location is required to continue. Please enable location services in your device settings and try again.',
        );
      };
      requestAnimationFrame(showStallError);
    }, LOCATION_STALL_MS);
    
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setIsGettingLocation(false);
        setLocationError(
          perm.canAskAgain
            ? 'Location permission is required to continue. Please allow location access and try again.'
            : 'Location permission is required to continue. Please enable location access in device/browser settings, then try again.',
        );
        return;
      }
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
            We use your location to find matches nearby. Location is detected automatically and must be enabled to continue.
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
                {hasAttemptedLocation
                  ? 'Location could not be detected. Please try again.'
                  : 'Tap below to detect your location.'}
              </Text>
              <Button
                title={hasAttemptedLocation ? 'Try Again' : 'Detect Location'}
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

