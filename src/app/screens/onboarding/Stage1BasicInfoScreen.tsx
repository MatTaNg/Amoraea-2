import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { TextInput } from '@ui/components/TextInput';
import { SelectButton } from '@ui/components/SelectButton';
import { MultiSelectButton } from '@ui/components/MultiSelectButton';
import { Button } from '@ui/components/Button';
import { Stepper } from '@ui/components/Stepper';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { LocationPermissionService } from '@utilities/permissions/LocationPermissionService';
import type { BasicInfo } from '@domain/models/Profile';

const profileRepository = new ProfileRepository();
const locationService = new LocationPermissionService();

const GENDERS = ['Man', 'Woman', 'Non-binary', 'Prefer not to say'] as const;
const ATTRACTED_TO_OPTIONS = ['Men', 'Women', 'Non-binary'] as const;

const TOTAL_STEPS = 9;

function heightCmFromFtIn(ft: number, inVal: number): number {
  return Math.round(ft * 30.48 + inVal * 2.54);
}
function kgFromLbs(lbs: number): number {
  return Math.round(lbs * 0.453592 * 10) / 10;
}
function bmi(weightKg: number, heightCm: number): number {
  if (heightCm <= 0) return 0;
  return Math.round((weightKg / ((heightCm / 100) ** 2)) * 10) / 10;
}

export const Stage1BasicInfoScreen: React.FC<{ navigation: any; route: { params: { userId: string } } }> = ({
  navigation,
  route,
}) => {
  const { userId } = route.params;
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => profileRepository.getProfile(userId),
    staleTime: 0,
  });
  const { data: existingPhotos = [] } = useQuery({
    queryKey: ['profile-photos', userId],
    queryFn: () => profileRepository.getProfilePhotos(userId),
    enabled: !!userId && (profile?.onboardingStage === 'basic_info' || !!profile?.primaryPhotoUrl),
  });

  const [step, setStep] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [ageStr, setAgeStr] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [attractedTo, setAttractedTo] = useState<string[]>([]);
  const [locationCity, setLocationCity] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [occupation, setOccupation] = useState('');
  const [photoUris, setPhotoUris] = useState<string[]>([]);
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ftin'>('cm');
  const [heightCm, setHeightCm] = useState('');
  const [heightFt, setHeightFt] = useState('');
  const [heightIn, setHeightIn] = useState('');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [weightKg, setWeightKg] = useState('');
  const [weightLbs, setWeightLbs] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const locationError = errors.location ?? null;
  const locationAutoRequestedRef = useRef(false);

  // Hydrate form and step from profile when we're in basic_info stage (only once profile has loaded)
  useEffect(() => {
    if (hydrated || profile === undefined) return;
    if (profile?.onboardingStage !== 'basic_info') {
      setHydrated(true);
      return;
    }
    const info = profile.basicInfo;
    if (info) {
      setFirstName(info.firstName || '');
      setAgeStr(info.age > 0 ? String(info.age) : '');
      setGender(info.gender || null);
      setAttractedTo(Array.isArray(info.attractedTo) ? [...info.attractedTo] : []);
      setLocationCity(info.locationCity || '');
      setLocationCountry(info.locationCountry || '');
      setOccupation(info.occupation || '');
      setHeightCm(info.heightCm > 0 ? String(info.heightCm) : '');
      setHeightFt(info.heightCm > 0 ? String(Math.floor(info.heightCm / 30.48)) : '');
      setHeightIn(info.heightCm > 0 ? String(Math.round((info.heightCm % 30.48) / 2.54)) : '');
      setWeightKg(info.weightKg > 0 ? String(info.weightKg) : '');
      setWeightLbs(info.weightKg > 0 ? String(Math.round(info.weightKg / 0.453592)) : '');
    }
    // Start at name (step 0) unless they've clearly passed it: onboarding_step > 1 AND they have a name saved.
    const firstNameSaved = (info?.firstName ?? '').trim().length > 0;
    const savedStepNum = typeof profile.onboardingStep === 'number' ? profile.onboardingStep : 0;
    const shouldResume = savedStepNum > 1 && firstNameSaved;
    const stepToUse = shouldResume
      ? Math.min(Math.max(0, savedStepNum), TOTAL_STEPS - 1)
      : 0;
    setStep(stepToUse);
    setHydrated(true);
  }, [profile, hydrated]);

  const existingPhotoUrls = existingPhotos.map((p) => p.publicUrl);
  const totalPhotoCount = existingPhotoUrls.length + photoUris.length;

  const fetchLocation = async () => {
    setLocationLoading(true);
    setErrors((e) => ({ ...e, location: undefined }));
    try {
      const granted = await locationService.requestPermission();
      if (!granted) {
        setErrors((e) => ({ ...e, location: 'Location permission is required to continue.' }));
        setLocationLoading(false);
        return;
      }
      const loc = await locationService.getCurrentLocation();
      if (loc.label) {
        const parts = loc.label.split(',').map((p) => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
          setLocationCountry(parts[parts.length - 1]);
          setLocationCity(parts.slice(0, -1).join(', '));
        } else {
          setLocationCity(loc.label);
        }
      } else {
        setErrors((e) => ({ ...e, location: 'Could not determine your location. Please try again.' }));
      }
    } catch (err) {
      setErrors((e) => ({ ...e, location: err instanceof Error ? err.message : 'Failed to get location' }));
    } finally {
      setLocationLoading(false);
    }
  };

  useEffect(() => {
    if (step === 4 && !locationAutoRequestedRef.current) {
      locationAutoRequestedRef.current = true;
      fetchLocation();
    }
  }, [step]);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library access is required to add profile photos.');
      return;
    }
    const limit = Math.max(0, 6 - totalPhotoCount);
    if (limit === 0) return;
    // Use lower quality when picking multiple to avoid browser/extension 64MB message limits (e.g. 6 large photos).
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.5,
      selectionLimit: Math.min(limit, 3),
    });
    if (result.canceled || result.assets.length === 0) return;
    const newUris = result.assets.map((a) => a.uri);
    setPhotoUris((prev) => [...prev, ...newUris].slice(0, 6 - existingPhotoUrls.length));
  };

  const removePhotoAt = (index: number) => {
    setPhotoUris((prev) => prev.filter((_, i) => i !== index));
  };

  const validateStep = (s: number): boolean => {
    const next: Record<string, string> = {};
    if (s === 0) {
      if (!firstName.trim()) next.firstName = 'First name is required';
    }
    if (s === 1) {
      const age = parseInt(ageStr, 10);
      if (!ageStr || isNaN(age)) next.age = 'Age is required';
      else if (age < 18) next.age = 'You must be at least 18 to use this app';
      else if (age > 120) next.age = 'Please enter a valid age';
    }
    if (s === 2) {
      if (gender === null || gender === '') next.gender = 'Please select a gender';
    }
    if (s === 3) {
      if (attractedTo.length === 0) next.attractedTo = 'Please select at least one';
    }
    if (s === 4) {
      if (locationError) next.location = locationError;
      else if (!locationCity.trim()) next.location = 'Location is required';
    }
    if (s === 5) {
      if (!occupation.trim()) next.occupation = 'Occupation is required';
    }
    if (s === 6) {
      if (heightUnit === 'cm') {
        const val = parseInt(heightCm, 10);
        if (!heightCm || isNaN(val) || val < 100 || val > 250) next.height = 'Enter height between 100–250 cm';
      } else {
        const ft = parseInt(heightFt, 10);
        const inVal = parseInt(heightIn, 10);
        const val = heightCmFromFtIn(ft, inVal);
        if (isNaN(ft) || isNaN(inVal) || val < 100 || val > 250) next.height = 'Enter valid height (e.g. 5 ft 7 in)';
      }
    }
    if (s === 7) {
      if (weightUnit === 'kg') {
        const val = parseFloat(weightKg);
        if (!weightKg || isNaN(val) || val < 30 || val > 300) next.weight = 'Enter weight between 30–300 kg';
      } else {
        const lbs = parseFloat(weightLbs);
        if (!weightLbs || isNaN(lbs) || lbs < 66 || lbs > 660) next.weight = 'Enter weight between 66–660 lbs';
      }
    }
    if (s === 8) {
      if (totalPhotoCount === 0) next.photo = 'At least one profile photo is required';
      else if (totalPhotoCount > 6) next.photo = 'Maximum 6 photos';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    if (step < TOTAL_STEPS - 1) {
      saveProgressAndGoTo(step + 1);
    } else {
      submit();
    }
  };

  /** Build basicInfo from current form state, merged with existing saved data. */
  const buildMergedBasicInfo = (): BasicInfo => {
    const age = parseInt(ageStr, 10) || 0;
    let heightCmVal = 0;
    if (heightUnit === 'cm') {
      heightCmVal = parseInt(heightCm, 10) || 0;
    } else {
      heightCmVal = heightCmFromFtIn(parseInt(heightFt, 10) || 0, parseInt(heightIn, 10) || 0);
    }
    let weightKgVal = 0;
    if (weightUnit === 'kg') {
      weightKgVal = parseFloat(weightKg) || 0;
    } else {
      weightKgVal = kgFromLbs(parseFloat(weightLbs) || 0);
    }
    const bmiVal = heightCmVal > 0 ? bmi(weightKgVal, heightCmVal) : 0;
    const existing = profile?.basicInfo;
    return {
      firstName: firstName.trim() || (existing?.firstName ?? ''),
      age: age || (existing?.age ?? 0),
      gender: (gender ?? '') || (existing?.gender ?? ''),
      attractedTo: attractedTo.length > 0 ? [...attractedTo] : (existing?.attractedTo ?? []),
      locationCity: locationCity.trim() || (existing?.locationCity ?? ''),
      locationCountry: locationCountry.trim() || (existing?.locationCountry ?? ''),
      occupation: occupation.trim() || (existing?.occupation ?? ''),
      photoUrl: existing?.photoUrl ?? '', // updated below when we have uploads
      heightCm: heightCmVal || (existing?.heightCm ?? 0),
      weightKg: weightKgVal || (existing?.weightKg ?? 0),
      bmi: bmiVal || (existing?.bmi ?? 0),
    };
  };

  const saveProgressAndGoTo = async (nextStep: number) => {
    setSavingProgress(true);
    try {
      let primaryPhotoUrl: string | null = profile?.primaryPhotoUrl ?? null;
      if (step === 8 && photoUris.length > 0) {
        for (let i = 0; i < photoUris.length; i++) {
          const uri = photoUris[i];
          const fileName = uri.split('/').pop() || `photo_${Date.now()}_${i}.jpg`;
          const { publicUrl, storagePath } = await profileRepository.uploadPhoto(userId, uri, fileName);
          const existingCount = existingPhotoUrls.length;
          await profileRepository.savePhotoRecord({
            profileId: userId,
            storagePath,
            publicUrl,
            displayOrder: existingCount + i,
          });
          if (i === 0 && !primaryPhotoUrl) primaryPhotoUrl = publicUrl;
        }
        if (primaryPhotoUrl) {
          await profileRepository.upsertProfile(userId, { primaryPhotoUrl });
        }
      }
      const merged = buildMergedBasicInfo();
      if (primaryPhotoUrl) merged.photoUrl = primaryPhotoUrl;
      else if (profile?.primaryPhotoUrl) merged.photoUrl = profile.primaryPhotoUrl;
      const update: Parameters<typeof profileRepository.upsertProfile>[1] = {
        basicInfo: merged,
        onboardingStep: nextStep,
      };
      if (merged.firstName) update.name = merged.firstName;
      if (merged.age > 0) update.age = merged.age;
      if (merged.gender && merged.gender !== 'Prefer not to say') {
        update.gender = merged.gender as 'Man' | 'Woman' | 'Non-binary';
      }
      if (merged.attractedTo.length > 0) update.attractedTo = merged.attractedTo as ('Men' | 'Women' | 'Non-binary')[];
      if (merged.heightCm > 0) update.heightCentimeters = merged.heightCm;
      if (merged.occupation) update.occupation = merged.occupation;
      await profileRepository.upsertProfile(userId, update);
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      queryClient.invalidateQueries({ queryKey: ['profile-photos', userId] });
      setStep(nextStep);
      if (step === 8 && photoUris.length > 0) setPhotoUris([]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save progress');
    } finally {
      setSavingProgress(false);
    }
  };

  const goBack = () => {
    if (step > 0) {
      setErrors({});
      setStep((s) => s - 1);
    }
  };

  const submit = async () => {
    const age = parseInt(ageStr, 10);
    let heightCmVal = 0;
    if (heightUnit === 'cm') {
      heightCmVal = parseInt(heightCm, 10);
    } else {
      heightCmVal = heightCmFromFtIn(parseInt(heightFt, 10), parseInt(heightIn, 10));
    }
    let weightKgVal = 0;
    if (weightUnit === 'kg') {
      weightKgVal = parseFloat(weightKg);
    } else {
      weightKgVal = kgFromLbs(parseFloat(weightLbs));
    }
    const bmiVal = bmi(weightKgVal, heightCmVal);

    setSubmitting(true);
    try {
      let photoUrlFinal: string | null = profile?.primaryPhotoUrl ?? null;
      if (photoUris.length > 0) {
        for (let i = 0; i < photoUris.length; i++) {
          const uri = photoUris[i];
          const fileName = uri.split('/').pop() || `photo_${Date.now()}_${i}.jpg`;
          const { publicUrl, storagePath } = await profileRepository.uploadPhoto(userId, uri, fileName);
          const existingCount = existingPhotoUrls.length;
          await profileRepository.savePhotoRecord({
            profileId: userId,
            storagePath,
            publicUrl,
            displayOrder: existingCount + i,
          });
          if (i === 0) photoUrlFinal = publicUrl;
        }
        if (photoUrlFinal) {
          await profileRepository.upsertProfile(userId, { primaryPhotoUrl: photoUrlFinal });
        }
      }
      if (!photoUrlFinal) {
        Alert.alert('Error', 'At least one profile photo is required');
        setSubmitting(false);
        return;
      }

      const basicInfo: BasicInfo = {
        firstName: firstName.trim(),
        age,
        gender: gender ?? '',
        attractedTo: [...attractedTo],
        locationCity: locationCity.trim(),
        locationCountry: locationCountry.trim(),
        occupation: occupation.trim(),
        photoUrl: photoUrlFinal,
        heightCm: heightCmVal,
        weightKg: weightKgVal,
        bmi: bmiVal,
      };

      await profileRepository.upsertProfile(userId, {
        name: basicInfo.firstName,
        age: basicInfo.age,
        gender: basicInfo.gender === 'Prefer not to say' ? null : (basicInfo.gender as 'Man' | 'Woman' | 'Non-binary'),
        attractedTo: basicInfo.attractedTo as ('Men' | 'Women' | 'Non-binary')[],
        heightCentimeters: basicInfo.heightCm,
        occupation: basicInfo.occupation,
        basicInfo,
        onboardingStage: 'interview',
      });

      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      navigation.replace('OnboardingInterview', { userId });
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <>
            <Text style={styles.stepTitle}>What's your first name?</Text>
            <TextInput
              label="First name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Your first name"
              error={errors.firstName}
            />
          </>
        );
      case 1:
        return (
          <>
            <Text style={styles.stepTitle}>How old are you?</Text>
            <Text style={styles.stepHint}>You must be 18 or older to use this app.</Text>
            <TextInput
              value={ageStr}
              onChangeText={setAgeStr}
              placeholder="Age"
              keyboardType="numeric"
              error={errors.age}
            />
          </>
        );
      case 2:
        return (
          <>
            <Text style={styles.stepTitle}>What's your gender?</Text>
            {GENDERS.map((g) => (
              <SelectButton key={g} label={g} selected={gender === g} onPress={() => setGender(g)} />
            ))}
            {errors.gender ? <Text style={styles.errorText}>{errors.gender}</Text> : null}
          </>
        );
      case 3:
        return (
          <>
            <Text style={styles.stepTitle}>Who are you attracted to?</Text>
            <Text style={styles.stepHint}>Select all that apply.</Text>
            {ATTRACTED_TO_OPTIONS.map((opt) => (
              <MultiSelectButton
                key={opt}
                label={opt}
                selected={attractedTo.includes(opt)}
                onPress={() => {
                  setAttractedTo((prev) =>
                    prev.includes(opt) ? prev.filter((x) => x !== opt) : [...prev, opt]
                  );
                }}
              />
            ))}
            {errors.attractedTo ? <Text style={styles.errorText}>{errors.attractedTo}</Text> : null}
          </>
        );
      case 4:
        return (
          <>
            <Text style={styles.stepTitle}>Where are you based?</Text>
            <Text style={styles.stepHint}>We'll use your device location.</Text>
            {locationLoading ? (
              <View style={styles.locationAutoBox}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.locationAutoText}>Getting your location…</Text>
              </View>
            ) : locationError ? (
              <View style={styles.locationAutoBox}>
                <Text style={styles.errorText}>{locationError}</Text>
                <Button title="Retry" onPress={fetchLocation} variant="outline" style={styles.locationRetryButton} />
              </View>
            ) : locationCity || locationCountry ? (
              <View style={styles.locationAutoBox}>
                <Ionicons name="location" size={24} color={colors.primary} />
                <Text style={styles.locationResolvedText}>
                  {[locationCity, locationCountry].filter(Boolean).join(', ')}
                </Text>
                <Text style={styles.stepHint}>Tap Next to continue.</Text>
              </View>
            ) : null}
          </>
        );
      case 5:
        return (
          <>
            <Text style={styles.stepTitle}>What do you do?</Text>
            <Text style={styles.stepHint}>Your occupation or main focus.</Text>
            <TextInput
              value={occupation}
              onChangeText={setOccupation}
              placeholder="e.g. Teacher, Designer"
              error={errors.occupation}
            />
          </>
        );
      case 6:
        return (
          <>
            <Text style={styles.stepTitle}>What's your height?</Text>
            <View style={styles.unitRow}>
              <SelectButton
                label="cm"
                selected={heightUnit === 'cm'}
                onPress={() => setHeightUnit('cm')}
              />
              <SelectButton
                label="ft / in"
                selected={heightUnit === 'ftin'}
                onPress={() => setHeightUnit('ftin')}
              />
            </View>
            {heightUnit === 'cm' ? (
              <TextInput
                value={heightCm}
                onChangeText={setHeightCm}
                placeholder="e.g. 170"
                keyboardType="numeric"
                error={errors.height}
              />
            ) : (
              <View style={styles.ftInRow}>
                <View style={styles.ftInInput}>
                  <TextInput
                    value={heightFt}
                    onChangeText={setHeightFt}
                    placeholder="ft"
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.ftInInput}>
                  <TextInput
                    value={heightIn}
                    onChangeText={setHeightIn}
                    placeholder="in"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            )}
            {errors.height ? <Text style={styles.errorText}>{errors.height}</Text> : null}
          </>
        );
      case 7:
        return (
          <>
            <Text style={styles.stepTitle}>What's your weight?</Text>
            <View style={styles.unitRow}>
              <SelectButton label="kg" selected={weightUnit === 'kg'} onPress={() => setWeightUnit('kg')} />
              <SelectButton label="lbs" selected={weightUnit === 'lbs'} onPress={() => setWeightUnit('lbs')} />
            </View>
            <TextInput
              value={weightUnit === 'kg' ? weightKg : weightLbs}
              onChangeText={weightUnit === 'kg' ? setWeightKg : setWeightLbs}
              placeholder={weightUnit === 'kg' ? 'e.g. 70' : 'e.g. 154'}
              keyboardType="numeric"
              error={errors.weight}
            />
          </>
        );
      case 8:
        return (
          <>
            <Text style={styles.stepTitle}>Add profile photos</Text>
            <Text style={styles.stepHint}>Add 1–6 photos. The first is your main profile picture. Add up to 3 at a time.</Text>
            <View style={styles.photosGrid}>
              {existingPhotoUrls.map((url, index) => (
                <View key={`existing-${url}`} style={styles.photoWrapper}>
                  <Image source={{ uri: url }} style={styles.photoThumb} />
                  {index === 0 && (
                    <View style={styles.photoPrimaryBadge}>
                      <Text style={styles.photoPrimaryText}>Main</Text>
                    </View>
                  )}
                </View>
              ))}
              {photoUris.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.photoWrapper}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  {index === 0 && (
                    <View style={styles.photoPrimaryBadge}>
                      <Text style={styles.photoPrimaryText}>Main</Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => removePhotoAt(index)}
                  >
                    <Ionicons name="close-circle" size={26} color={colors.error} />
                  </TouchableOpacity>
                </View>
              ))}
              {totalPhotoCount < 6 && (
                <TouchableOpacity style={styles.photoAdd} onPress={pickPhoto}>
                  <Ionicons name="add" size={32} color={colors.textSecondary} />
                  <Text style={styles.photoAddText}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.photoCountText}>{totalPhotoCount} / 6 photos</Text>
            {errors.photo ? <Text style={styles.errorText}>{errors.photo}</Text> : null}
          </>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaContainer>
      <Stepper currentStep={step} totalSteps={TOTAL_STEPS} />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderStepContent()}
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity onPress={goBack} style={styles.backBtn} disabled={step === 0}>
            <Ionicons name="arrow-back" size={22} color={step === 0 ? colors.textSecondary : colors.primary} />
            <Text style={[styles.backBtnText, step === 0 && styles.backBtnTextDisabled]}>Back</Text>
          </TouchableOpacity>
          <Button
            title={
              step === TOTAL_STEPS - 1
                ? (submitting ? 'Saving…' : 'Continue')
                : savingProgress
                  ? 'Saving…'
                  : 'Next'
            }
            onPress={goNext}
            disabled={
              submitting ||
              savingProgress ||
              (step === 4 && (locationLoading || !!locationError || !locationCity.trim())) ||
              (step === 8 && totalPhotoCount === 0)
            }
            style={styles.nextBtn}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: spacing.lg, paddingBottom: spacing.md },
  stepTitle: { fontSize: 22, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  stepHint: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.lg },
  errorText: { fontSize: 12, color: colors.error, marginTop: spacing.xs },
  locationAutoBox: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
  locationAutoText: { fontSize: 16, color: colors.textSecondary },
  locationRetryButton: { marginTop: spacing.sm },
  locationResolvedText: { fontSize: 18, color: colors.text, fontWeight: '600' },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  photoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photoThumb: { width: '100%', height: '100%' },
  photoPrimaryBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  photoPrimaryText: { fontSize: 10, color: '#fff', fontWeight: '600' },
  photoPreview: { width: 140, height: 140, borderRadius: 8, overflow: 'hidden', marginBottom: spacing.md, position: 'relative' },
  photoImage: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: -4, right: -4 },
  photoAdd: {
    width: 100,
    height: 100,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoAddText: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.xs },
  photoCountText: { fontSize: 14, color: colors.textSecondary, marginBottom: spacing.md },
  unitRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  ftInRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  ftInInput: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingRight: spacing.sm },
  backBtnText: { fontSize: 16, color: colors.primary, fontWeight: '500' },
  backBtnTextDisabled: { color: colors.textSecondary },
  nextBtn: { minWidth: 120 },
});
