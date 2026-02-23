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
import { Profile, Gender, AttractedToOption, ProfilePromptAnswer } from '@domain/models/Profile';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { LocationPermissionService } from '@utilities/permissions/LocationPermissionService';
import { PhotoUseCase } from '@domain/useCases/PhotoUseCase';
import {
  PROMPT_CATEGORIES,
  MAX_PROMPTS,
  getPromptById,
} from '@features/profile/promptsByCategory';
import type { PromptCategory, PromptOption } from '@features/profile/promptsByCategory';

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
  const [promptFlowOpen, setPromptFlowOpen] = useState(false);
  const [promptFlowStep, setPromptFlowStep] = useState<'category' | 'prompt' | 'answer'>('category');
  const [promptFlowCategory, setPromptFlowCategory] = useState<PromptCategory | null>(null);
  const [promptFlowPrompt, setPromptFlowPrompt] = useState<PromptOption | null>(null);
  const [promptFlowAnswer, setPromptFlowAnswer] = useState('');
  const [editingPromptIndex, setEditingPromptIndex] = useState<number | null>(null);
  const [editingAnswer, setEditingAnswer] = useState('');
  const [promptsSaving, setPromptsSaving] = useState(false);

  const currentPrompts: ProfilePromptAnswer[] = profile?.prompts ?? [];
  const canAddPrompt = currentPrompts.length < MAX_PROMPTS;

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

  const openAddPrompt = () => {
    setPromptFlowCategory(null);
    setPromptFlowPrompt(null);
    setPromptFlowAnswer('');
    setPromptFlowStep('category');
    setPromptFlowOpen(true);
  };

  const closePromptFlow = () => {
    setPromptFlowOpen(false);
    setPromptFlowCategory(null);
    setPromptFlowPrompt(null);
    setPromptFlowAnswer('');
    setEditingPromptIndex(null);
    setEditingAnswer('');
  };

  const saveNewPrompt = async () => {
    if (!promptFlowPrompt || !promptFlowAnswer.trim()) return;
    const next: ProfilePromptAnswer[] = [
      ...currentPrompts,
      { promptId: promptFlowPrompt.id, answer: promptFlowAnswer.trim() },
    ];
    setPromptsSaving(true);
    try {
      await profileRepository.upsertProfile(userId, { prompts: next });
      onSaved();
      closePromptFlow();
    } catch {
      Alert.alert('Error', 'Failed to save prompt');
    } finally {
      setPromptsSaving(false);
    }
  };

  const updatePromptAnswer = async (index: number, newAnswer: string) => {
    const next = [...currentPrompts];
    next[index] = { ...next[index], answer: newAnswer.trim() };
    setPromptsSaving(true);
    try {
      await profileRepository.upsertProfile(userId, { prompts: next });
      onSaved();
      setEditingPromptIndex(null);
      setEditingAnswer('');
    } catch {
      Alert.alert('Error', 'Failed to update prompt');
    } finally {
      setPromptsSaving(false);
    }
  };

  const removePrompt = async (index: number) => {
    const next = currentPrompts.filter((_, i) => i !== index);
    setPromptsSaving(true);
    try {
      await profileRepository.upsertProfile(userId, { prompts: next });
      onSaved();
      setEditingPromptIndex(null);
    } catch {
      Alert.alert('Error', 'Failed to remove prompt');
    } finally {
      setPromptsSaving(false);
    }
  };

  const selectedPromptIds = new Set(currentPrompts.map((p) => p.promptId));
  const availablePromptsInCategory = promptFlowCategory
    ? promptFlowCategory.prompts.filter((p) => !selectedPromptIds.has(p.id))
    : [];

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

              <View style={styles.promptsSection}>
                <Text style={styles.fieldLabel}>Prompts</Text>
                <Text style={styles.photoHint}>
                  Add up to 3 prompts. Pick a category, then a question, then answer in your own words.
                </Text>
                {currentPrompts.map((p, index) => {
                  const promptMeta = getPromptById(p.promptId);
                  const isEditing = editingPromptIndex === index;
                  return (
                    <View key={`${p.promptId}-${index}`} style={styles.promptCard}>
                      <Text style={styles.promptQuestion}>
                        {promptMeta?.text ?? p.promptId}
                      </Text>
                      {isEditing ? (
                        <View style={styles.promptEditRow}>
                          <TextInput
                            value={editingAnswer}
                            onChangeText={setEditingAnswer}
                            placeholder="Your answer"
                            multiline
                            style={styles.promptAnswerInput}
                          />
                          <View style={styles.promptEditActions}>
                            <Button
                              title="Save"
                              onPress={() => updatePromptAnswer(index, editingAnswer)}
                              disabled={!editingAnswer.trim() || promptsSaving}
                              variant="outline"
                              style={styles.promptEditBtn}
                            />
                            <Button
                              title="Cancel"
                              onPress={() => { setEditingPromptIndex(null); setEditingAnswer(''); }}
                              variant="outline"
                              style={styles.promptEditBtn}
                            />
                          </View>
                        </View>
                      ) : (
                        <>
                          <Text style={styles.promptAnswer} numberOfLines={2}>
                            {p.answer || 'No answer yet'}
                          </Text>
                          <View style={styles.promptActions}>
                            <TouchableOpacity
                              onPress={() => {
                                setEditingPromptIndex(index);
                                setEditingAnswer(p.answer);
                              }}
                              style={styles.promptActionLink}
                            >
                              <Ionicons name="pencil" size={16} color={colors.primary} />
                              <Text style={styles.promptActionText}>Edit</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => removePrompt(index)}
                              disabled={promptsSaving}
                              style={styles.promptActionLink}
                            >
                              <Ionicons name="trash-outline" size={16} color={colors.error} />
                              <Text style={[styles.promptActionText, { color: colors.error }]}>Remove</Text>
                            </TouchableOpacity>
                          </View>
                        </>
                      )}
                    </View>
                  );
                })}
                {canAddPrompt && (
                  <TouchableOpacity
                    style={styles.addPromptButton}
                    onPress={openAddPrompt}
                  >
                    <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
                    <Text style={styles.addPromptButtonText}>Add prompt</Text>
                  </TouchableOpacity>
                )}
                {currentPrompts.length > 0 && (
                  <Text style={styles.photoCount}>
                    {currentPrompts.length} / {MAX_PROMPTS} prompts
                  </Text>
                )}
              </View>

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

      <Modal visible={promptFlowOpen} animationType="slide" transparent>
        <View style={styles.overlay}>
          <View style={[styles.modal, styles.promptFlowModal]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {promptFlowStep === 'category' && 'Choose a category'}
                {promptFlowStep === 'prompt' && 'Choose a prompt'}
                {promptFlowStep === 'answer' && 'Your answer'}
              </Text>
              <TouchableOpacity onPress={closePromptFlow} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {promptFlowStep === 'category' && (
                <>
                  {PROMPT_CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={styles.promptCategoryCard}
                      onPress={() => {
                        setPromptFlowCategory(cat);
                        setPromptFlowStep('prompt');
                      }}
                    >
                      <Text style={styles.promptCategoryTitle}>{cat.title}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              {promptFlowStep === 'prompt' && promptFlowCategory && (
                <>
                  {availablePromptsInCategory.length === 0 ? (
                    <Text style={styles.promptHint}>
                      You've already selected all prompts in this category. Pick another category.
                    </Text>
                  ) : (
                    availablePromptsInCategory.map((opt) => (
                      <TouchableOpacity
                        key={opt.id}
                        style={styles.promptCategoryCard}
                        onPress={() => {
                          setPromptFlowPrompt(opt);
                          setPromptFlowAnswer('');
                          setPromptFlowStep('answer');
                        }}
                      >
                        <Text style={styles.promptOptionText}>{opt.text}</Text>
                      </TouchableOpacity>
                    ))
                  )}
                  <Button
                    title="Back to categories"
                    onPress={() => { setPromptFlowCategory(null); setPromptFlowStep('category'); }}
                    variant="outline"
                    style={styles.promptFlowBack}
                  />
                </>
              )}
              {promptFlowStep === 'answer' && promptFlowPrompt && (
                <>
                  <Text style={styles.promptQuestionDisplay}>{promptFlowPrompt.text}</Text>
                  <TextInput
                    value={promptFlowAnswer}
                    onChangeText={setPromptFlowAnswer}
                    placeholder="Type your answer..."
                    multiline
                    style={styles.promptAnswerInputLarge}
                  />
                  <Button
                    title={promptsSaving ? 'Saving…' : 'Save prompt'}
                    onPress={saveNewPrompt}
                    disabled={!promptFlowAnswer.trim() || promptsSaving}
                    style={styles.promptFlowBack}
                  />
                  <Button
                    title="Back"
                    onPress={() => setPromptFlowStep('prompt')}
                    variant="outline"
                    style={styles.promptFlowBack}
                  />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  promptsSection: {
    marginTop: spacing.lg,
  },
  promptCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  promptQuestion: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  promptAnswer: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  promptEditRow: {
    marginTop: spacing.xs,
  },
  promptAnswerInput: {
    minHeight: 64,
    marginBottom: spacing.sm,
  },
  promptEditActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  promptEditBtn: {
    flex: 1,
  },
  promptActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  promptActionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  promptActionText: {
    fontSize: 13,
    color: colors.primary,
  },
  addPromptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 8,
    marginTop: spacing.xs,
  },
  addPromptButtonText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  promptFlowModal: {
    maxHeight: '85%',
  },
  promptCategoryCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  promptCategoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  promptOptionText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  promptHint: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  promptFlowBack: {
    marginTop: spacing.sm,
  },
  promptQuestionDisplay: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  promptAnswerInputLarge: {
    minHeight: 120,
    marginBottom: spacing.md,
  },
  modalFooter: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
