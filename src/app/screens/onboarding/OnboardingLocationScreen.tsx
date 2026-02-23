import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { ProgressBar } from '@ui/components/ProgressBar';
import { Button } from '@ui/components/Button';
import { OnboardingNavigation } from '@ui/components/OnboardingNavigation';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { useOnboarding } from '@features/onboarding/hooks/useOnboarding';
import { LocationPermissionService } from '@utilities/permissions/LocationPermissionService';
import { AppState } from 'react-native';

const locationService = new LocationPermissionService();

export const OnboardingLocationScreen: React.FC<{ navigation: any; userId: string }> = ({ navigation, userId }) => {
  const { state, updateStep, isLoading, currentStep, totalSteps, canGoBack } = useOnboarding(userId);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    checkPermission();
    
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkPermission();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const checkPermission = async () => {
    const granted = await locationService.checkPermission();
    setPermissionGranted(granted);
    if (granted && !state.location) {
      getLocation();
    }
  };

  const requestPermission = async () => {
    const granted = await locationService.requestPermission();
    setPermissionGranted(granted);
    if (granted) {
      getLocation();
    } else {
      setError('Location permission is required to continue');
    }
  };

  const getLocation = async () => {
    setLocationLoading(true);
    setError(null);
    try {
      const location = await locationService.getCurrentLocation();
      await updateStep({
        step: currentStep + 1,
        update: { location },
      });
      navigation.navigate('OnboardingPhotos');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get location');
    } finally {
      setLocationLoading(false);
    }
  };

  const openSettings = () => {
    Linking.openSettings();
  };

  const onNext = async () => {
    if (!state.location) {
      if (!permissionGranted) {
        await requestPermission();
      } else {
        await getLocation();
      }
    } else {
      navigation.navigate('OnboardingPhotos');
    }
  };

  const onBack = () => {
    navigation.goBack();
  };

  const hasLocation = !!state.location;

  return (
    <SafeAreaContainer>
      <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Where are you located?</Text>
          <Text style={styles.subtitle}>We need your location to help you find matches nearby</Text>

          {locationLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Getting your location...</Text>
            </View>
          ) : !permissionGranted ? (
            <View style={styles.permissionContainer}>
              <Text style={styles.permissionText}>
                Location permission is required to continue. Please enable location services in your device settings.
              </Text>
              <Button
                title="Open Settings"
                onPress={openSettings}
                style={styles.settingsButton}
              />
            </View>
          ) : hasLocation ? (
            <View style={styles.locationContainer}>
              <Text style={styles.locationLabel}>Location captured:</Text>
              <Text style={styles.locationText}>
                {state.location.label || `${state.location.latitude.toFixed(4)}, ${state.location.longitude.toFixed(4)}`}
              </Text>
            </View>
          ) : (
            <Button
              title="Get My Location"
              onPress={getLocation}
              style={styles.getLocationButton}
            />
          )}

          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>
      </ScrollView>
      <OnboardingNavigation
        onBack={onBack}
        onNext={onNext}
        canGoBack={canGoBack}
        nextDisabled={!hasLocation && !permissionGranted}
        nextLoading={isLoading || locationLoading}
      />
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  loadingContainer: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textSecondary,
  },
  permissionContainer: {
    marginTop: spacing.xl,
  },
  permissionText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  settingsButton: {
    marginTop: spacing.md,
  },
  getLocationButton: {
    marginTop: spacing.xl,
  },
  locationContainer: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  locationLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  locationText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});

