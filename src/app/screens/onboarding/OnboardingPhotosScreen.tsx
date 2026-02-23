import React, { useState } from 'react';
import { View, StyleSheet, Text, ScrollView, Image, TouchableOpacity, Alert } from 'react-native';
import { ProgressBar } from '@ui/components/ProgressBar';
import { OnboardingNavigation } from '@ui/components/OnboardingNavigation';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { useOnboarding } from '@features/onboarding/hooks/useOnboarding';
import { PhotoUseCase } from '@domain/useCases/PhotoUseCase';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { Ionicons } from '@expo/vector-icons';

const photoUseCase = new PhotoUseCase(new ProfileRepository());

export const OnboardingPhotosScreen: React.FC<{ navigation: any; userId: string }> = ({ navigation, userId }) => {
  const { state, updateStep, completeOnboarding, isLoading, currentStep, totalSteps, canGoBack } = useOnboarding(userId);
  const [uploading, setUploading] = useState(false);
  const [photoUris, setPhotoUris] = useState<string[]>(state.photoUris || []);

  const pickPhotos = async () => {
    try {
      const uris = await photoUseCase.pickPhotos();
      if (uris.length > 0) {
        const newUris = [...photoUris, ...uris].slice(0, 6);
        setPhotoUris(newUris);
        await updateStep({
          step: currentStep,
          update: { photoUris: newUris },
        });
      }
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to pick photos');
    }
  };

  const removePhoto = async (index: number) => {
    const newUris = photoUris.filter((_, i) => i !== index);
    setPhotoUris(newUris);
    await updateStep({
      step: currentStep,
      update: { photoUris: newUris },
    });
  };

  const onNext = async () => {
    if (photoUris.length < 3) {
      Alert.alert('Error', 'Please select at least 3 photos');
      return;
    }

    if (photoUris.length > 6) {
      Alert.alert('Error', 'Please select at most 6 photos');
      return;
    }

    setUploading(true);
    try {
      await photoUseCase.uploadPhotos(userId, photoUris);
      await completeOnboarding();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Home' }],
      });
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to upload photos');
    } finally {
      setUploading(false);
    }
  };

  const onBack = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaContainer>
      <ProgressBar currentStep={currentStep} totalSteps={totalSteps} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <Text style={styles.title}>Add your photos</Text>
          <Text style={styles.subtitle}>Select 3 to 6 photos to showcase yourself</Text>

          <View style={styles.photosContainer}>
            {photoUris.map((uri, index) => (
              <View key={index} style={styles.photoWrapper}>
                <Image source={{ uri }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removePhoto(index)}
                >
                  <Ionicons name="close-circle" size={24} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}
            {photoUris.length < 6 && (
              <TouchableOpacity style={styles.addButton} onPress={pickPhotos}>
                <Ionicons name="add" size={32} color={colors.textSecondary} />
                <Text style={styles.addButtonText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.photoCount}>
            {photoUris.length} / 6 photos selected
          </Text>
          {photoUris.length < 3 && (
            <Text style={styles.warningText}>
              Please select at least 3 photos to continue
            </Text>
          )}
        </View>
      </ScrollView>
      <OnboardingNavigation
        onBack={onBack}
        onNext={onNext}
        canGoBack={canGoBack}
        nextDisabled={photoUris.length < 3 || photoUris.length > 6}
        nextLoading={isLoading || uploading}
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
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
  },
  photoWrapper: {
    width: '48%',
    aspectRatio: 1,
    margin: '1%',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  addButton: {
    width: '48%',
    aspectRatio: 1,
    margin: '1%',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: 12,
  },
  photoCount: {
    marginTop: spacing.md,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  warningText: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
});

