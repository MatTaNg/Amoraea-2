import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TextInput } from '@ui/components/TextInput';
import { SelectButton } from '@ui/components/SelectButton';
import { MultiSelectButton } from '@ui/components/MultiSelectButton';
import { Button } from '@ui/components/Button';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { Ionicons } from '@expo/vector-icons';
import { Profile, Gender, AttractedToOption } from '@domain/models/Profile';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { LocationPermissionService } from '@utilities/permissions/LocationPermissionService';
import { PhotoUseCase } from '@domain/useCases/PhotoUseCase';

const profileRepository = new ProfileRepository();
const locationService = new LocationPermissionService();
const photoUseCase = new PhotoUseCase(profileRepository);

const editProfileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  age: z.number().int().min(18).max(120),
  gender: z.enum(['Man', 'Woman', 'Non-binary']),
  attractedTo: z.array(z.enum(['Men', 'Women', 'Non-binary'])).min(1, 'Select at least one'),
  heightCentimeters: z.number().int().min(100).max(250),
  occupation: z.string().min(1).max(200),
});

type EditProfileFormData = z.infer<typeof editProfileSchema>;

interface EditProfileModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  profile: Profile | null | undefined;
  onSaved: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  onClose,
  userId,
  profile,
  onSaved,
}) => {
  const [locationLoading, setLocationLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);

  const { data: profilePhotos = [], refetch: refetchPhotos } = useQuery({
    queryKey: ['profilePhotos', userId],
    queryFn: () => profileRepository.getProfilePhotos(userId),
    enabled: !!userId && visible,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<EditProfileFormData>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      name: '',
      age: undefined,
      gender: undefined,
      attractedTo: [],
      heightCentimeters: undefined,
      occupation: '',
    },
  });

  const nameValue = watch('name');
  const ageValue = watch('age');
  const genderValue = watch('gender');
  const attractedToValue = watch('attractedTo') || [];
  const heightValue = watch('heightCentimeters');
  const occupationValue = watch('occupation');

  useEffect(() => {
    if (profile && visible) {
      reset({
        name: profile.name || '',
        age: profile.age ?? undefined,
        gender: profile.gender ?? undefined,
        attractedTo: profile.attractedTo || [],
        heightCentimeters: profile.heightCentimeters ?? undefined,
        occupation: profile.occupation || '',
      });
    }
  }, [profile, visible, reset]);

  useEffect(() => {
    register('name');
    register('age');
    register('gender');
    register('attractedTo');
    register('heightCentimeters');
    register('occupation');
  }, [register]);

  const addPhotos = async () => {
    try {
      const uris = await photoUseCase.pickPhotos();
      if (uris.length === 0) return;
      if (profilePhotos.length + uris.length > 6) {
        Alert.alert('Limit', 'You can have at most 6 photos.');
        return;
      }
      setPhotoUploading(true);
      await photoUseCase.addPhotos(userId, uris);
      refetchPhotos();
      onSaved();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to add photos');
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePhoto = async (photoId: string) => {
    try {
      await photoUseCase.removePhoto(userId, photoId, profile?.primaryPhotoUrl ?? null);
      refetchPhotos();
      onSaved();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to remove photo');
    }
  };

  const setAsPrimary = async (publicUrl: string) => {
    try {
      await profileRepository.upsertProfile(userId, { primaryPhotoUrl: publicUrl });
      onSaved();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to set primary photo');
    }
  };

  const updateLocation = async () => {
    setLocationLoading(true);
    try {
      const granted = await locationService.requestPermission();
      if (!granted) {
        Alert.alert('Permission needed', 'Location access is required to update your location.');
        return;
      }
      const location = await locationService.getCurrentLocation();
      await profileRepository.upsertProfile(userId, { location });
      onSaved();
      Alert.alert('Success', `Location updated: ${location.label || 'Saved'}`);
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to update location');
    } finally {
      setLocationLoading(false);
    }
  };

  const onSubmit = async (data: EditProfileFormData) => {
    try {
      await profileRepository.upsertProfile(userId, {
        name: data.name,
        age: data.age,
        gender: data.gender,
        attractedTo: data.attractedTo,
        heightCentimeters: data.heightCentimeters,
        occupation: data.occupation,
      });
      onSaved();
      onClose();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to save profile');
    }
  };

  const handleAgeChange = (text: string) => {
    const num = parseInt(text, 10);
    setValue('age', isNaN(num) ? undefined : num, { shouldValidate: true });
  };

  const handleHeightChange = (text: string) => {
    const num = parseInt(text, 10);
    setValue('heightCentimeters', isNaN(num) ? undefined : num, { shouldValidate: true });
  };

  const toggleAttractedTo = (option: AttractedToOption) => {
    const current = attractedToValue;
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    setValue('attractedTo', next, { shouldValidate: true });
  };

  const genders: Gender[] = ['Man', 'Woman', 'Non-binary'];
  const attractedToOptions: AttractedToOption[] = ['Men', 'Women', 'Non-binary'];

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.photosSection}>
                <Text style={styles.fieldLabel}>Photos</Text>
                <Text style={styles.photoHint}>3–6 photos. First photo is your main profile picture.</Text>
                <View style={styles.photosGrid}>
                  {profilePhotos.map((photo) => (
                    <View key={photo.id} style={styles.photoWrapper}>
                      <Image source={{ uri: photo.publicUrl }} style={styles.photo} />
                      <View style={styles.photoActions}>
                        {profile?.primaryPhotoUrl !== photo.publicUrl && (
                          <TouchableOpacity
                            style={styles.photoActionBtn}
                            onPress={() => setAsPrimary(photo.publicUrl)}
                          >
                            <Ionicons name="star-outline" size={18} color={colors.primary} />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.photoActionBtn}
                          onPress={() => removePhoto(photo.id)}
                        >
                          <Ionicons name="close-circle" size={22} color={colors.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                  {profilePhotos.length < 6 && (
                    <TouchableOpacity
                      style={styles.addPhotoButton}
                      onPress={addPhotos}
                      disabled={photoUploading}
                    >
                      <Ionicons
                        name="add"
                        size={28}
                        color={photoUploading ? colors.disabled : colors.textSecondary}
                      />
                      <Text style={styles.addPhotoText}>
                        {photoUploading ? 'Adding…' : 'Add'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.photoCount}>{profilePhotos.length} / 6 photos</Text>
              </View>

              <TextInput
                label="Name"
                value={nameValue}
                onChangeText={(t) => setValue('name', t)}
                placeholder="Your name"
                error={errors.name?.message}
              />

              <TextInput
                label="Age"
                value={ageValue?.toString() ?? ''}
                onChangeText={handleAgeChange}
                placeholder="18+"
                keyboardType="numeric"
                error={errors.age?.message}
              />

              <Text style={styles.fieldLabel}>Gender</Text>
              {genders.map((g) => (
                <SelectButton
                  key={g}
                  label={g}
                  selected={genderValue === g}
                  onPress={() => setValue('gender', g, { shouldValidate: true })}
                />
              ))}
              {errors.gender && <Text style={styles.errorText}>{errors.gender.message}</Text>}

              <Text style={styles.fieldLabel}>Attracted to</Text>
              {attractedToOptions.map((opt) => (
                <MultiSelectButton
                  key={opt}
                  label={opt}
                  selected={attractedToValue.includes(opt)}
                  onPress={() => toggleAttractedTo(opt)}
                />
              ))}
              {errors.attractedTo && (
                <Text style={styles.errorText}>{errors.attractedTo.message}</Text>
              )}

              <TextInput
                label="Height (cm)"
                value={heightValue?.toString() ?? ''}
                onChangeText={handleHeightChange}
                placeholder="100–250"
                keyboardType="numeric"
                error={errors.heightCentimeters?.message}
              />

              <TextInput
                label="Occupation"
                value={occupationValue}
                onChangeText={(t) => setValue('occupation', t)}
                placeholder="Your occupation"
                error={errors.occupation?.message}
              />

              <View style={styles.locationSection}>
                <Text style={styles.fieldLabel}>Location</Text>
                <Text style={styles.locationHint}>
                  {profile?.location?.label || 'Not set'}
                </Text>
                <Button
                  title={locationLoading ? 'Updating…' : 'Update location'}
                  onPress={updateLocation}
                  disabled={locationLoading}
                  variant="outline"
                />
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                title="Save"
                onPress={handleSubmit(onSubmit)}
                disabled={
                  !nameValue ||
                  !ageValue ||
                  ageValue < 18 ||
                  !genderValue ||
                  attractedToValue.length === 0 ||
                  !heightValue ||
                  heightValue < 100 ||
                  heightValue > 250 ||
                  !occupationValue?.trim()
                }
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '90%',
  },
  modal: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    padding: spacing.xs,
  },
  scrollView: {
    maxHeight: 500,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.xs,
  },
  photosSection: {
    marginBottom: spacing.lg,
  },
  photoHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  photoWrapper: {
    width: '31%',
    aspectRatio: 1,
    margin: '1%',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  photoActions: {
    position: 'absolute',
    top: -4,
    right: -4,
    flexDirection: 'row',
    gap: 4,
  },
  photoActionBtn: {
    backgroundColor: colors.background,
    borderRadius: 12,
  },
  addPhotoButton: {
    width: '31%',
    aspectRatio: 1,
    margin: '1%',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoText: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.textSecondary,
  },
  photoCount: {
    marginTop: spacing.sm,
    fontSize: 13,
    color: colors.textSecondary,
  },
  locationSection: {
    marginTop: spacing.lg,
  },
  locationHint: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  modalFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
