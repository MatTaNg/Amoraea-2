import { useMemo } from "react";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { handleApiError } from "@/shared/utils/errorHandling";
import { onboardingService } from "@/data/services/onboardingService";

interface UseStepPropsParams {
  step: "basic" | "birthinfo" | "filters" | "lifedomains" | "photos" | "done";
  state: any; // OnboardingState type
  setters: any; // OnboardingStateSetters type
  userId: string | undefined;
  canContinueBasic: () => boolean;
  setStep: (step: "basic" | "birthinfo" | "filters" | "lifedomains" | "photos" | "done") => void;
  saveBasicInfo: () => Promise<void>;
  guidance?: {
    basic?: string;
    lifedomains?: string;
  };
}

/**
 * Hook to generate props for each onboarding step component
 * Reduces prop drilling by grouping related props together
 */
export const useStepProps = ({
  step,
  state,
  setters,
  userId,
  canContinueBasic,
  setStep,
  saveBasicInfo,
  guidance,
}: UseStepPropsParams) => {
  const { signOut } = useAuth();

  const basicInfoProps = useMemo(() => ({
    guidance: guidance?.basic || onboardingService.getStepGuidance("basic-info"),
    basicInfo: {
      displayName: state.displayName,
      gender: state.gender,
      relationship: state.relationship,
      location: state.location,
      validatedLocation: state.validatedLocation,
      occupation: state.occupation,
      bio: state.bio,
      locationSuggestions: state.locationSuggestions,
      availability: state.availability,
      contactPreference: state.contactPreference,
      phoneNumber: state.phoneNumber,
    },
    metricConversion: {
      isMetric: state.isMetric,
      weightRangeMin: state.weightRangeMin,
      weightRangeMax: state.weightRangeMax,
      heightRangeMin: state.heightRangeMin,
      heightRangeMax: state.heightRangeMax,
      distanceRangeMin: state.distanceRangeMin,
      distanceRangeMax: state.distanceRangeMax,
    },
    handlers: {
      onDisplayNameChange: setters.setDisplayName,
      onGenderChange: setters.setGender,
      onRelationshipChange: setters.setRelationship,
      onLocationChange: setters.setLocation,
      onValidatedLocationChange: setters.setValidatedLocation,
      onOccupationChange: setters.setOccupation,
      onBioChange: setters.setBio,
      onLocationSuggestionsChange: setters.setLocationSuggestions,
      onAvailabilityChange: setters.setAvailability,
      onContactPreferenceChange: setters.setContactPreference,
      onPhoneNumberChange: setters.setPhoneNumber,
      onMetricChange: setters.setIsMetric,
      onWeightRangeMinChange: setters.setWeightRangeMin,
      onWeightRangeMaxChange: setters.setWeightRangeMax,
      onHeightRangeMinChange: setters.setHeightRangeMin,
      onHeightRangeMaxChange: setters.setHeightRangeMax,
      onDistanceRangeMinChange: setters.setDistanceRangeMin,
      onDistanceRangeMaxChange: setters.setDistanceRangeMax,
    },
    config: {
      userId: userId || "",
      showErrors: state.showErrors,
      savingBasic: state.savingBasic,
    },
    onSave: saveBasicInfo,
    onLogout: async () => {
      try {
        await signOut();
      } catch (e: any) {
        handleApiError(e, 'Log out failed');
      }
    },
    canContinue: canContinueBasic,
    onShowErrorsChange: setters.setShowErrors,
    onStepChange: setStep,
  }), [state, setters, userId, canContinueBasic, setStep, saveBasicInfo, signOut, guidance]);

  const birthInfoProps = useMemo(() => ({
    guidance: "We'll use your birth date, time, and location to calculate your astrology chart, numerology, and Human Design profile automatically.",
    birthDate: state.birthDate,
    birthTime: state.birthTime,
    birthLocation: state.birthLocation,
    validatedBirthLocation: state.validatedBirthLocation,
    birthLocationSuggestions: state.birthLocationSuggestions,
    showErrors: state.showErrors,
    savingBasic: state.savingBasic,
    userId: userId || "",
    onBirthDateChange: setters.setBirthDate,
    onBirthTimeChange: setters.setBirthTime,
    onBirthLocationChange: setters.setBirthLocation,
    onValidatedBirthLocationChange: setters.setValidatedBirthLocation,
    onBirthLocationSuggestionsChange: setters.setBirthLocationSuggestions,
    onShowErrorsChange: setters.setShowErrors,
    onStepChange: setStep,
  }), [state, setters, userId, setStep]);

  const filtersProps = useMemo(() => ({
    guidance: "Set your preferences for who you'd like to see in your matches.",
    filters: {
      distanceRangeMin: state.distanceRangeMin,
      distanceRangeMax: state.distanceRangeMax,
      ageRangeMin: state.ageRangeMin,
      ageRangeMax: state.ageRangeMax,
      genderPreference: state.genderPreference,
      smokingPreference: state.smokingPreference,
      drinkingPreference: state.drinkingPreference,
      cannabisPreference: state.cannabisPreference,
      workoutPreference: state.workoutPreference,
      dietaryPreference: state.dietaryPreference,
      useWeightFilter: state.useWeightFilter,
      useIncomeFilter: state.useIncomeFilter,
      useHeightFilter: state.useHeightFilter,
      weightRangeMin: state.weightRangeMin,
      weightRangeMax: state.weightRangeMax,
      heightRangeMin: state.heightRangeMin,
      heightRangeMax: state.heightRangeMax,
      incomeRangeMinInput: state.incomeRangeMinInput,
      weightStrict: state.weightStrict,
      incomeStrict: state.incomeStrict,
      heightStrict: state.heightStrict,
      isMetric: state.isMetric,
    },
    handlers: {
      onDistanceRangeMinChange: setters.setDistanceRangeMin,
      onDistanceRangeMaxChange: setters.setDistanceRangeMax,
      onAgeRangeMinChange: setters.setAgeRangeMin,
      onAgeRangeMaxChange: setters.setAgeRangeMax,
      onGenderPreferenceChange: setters.setGenderPreference,
      onSmokingPreferenceChange: setters.setSmokingPreference,
      onDrinkingPreferenceChange: setters.setDrinkingPreference,
      onCannabisPreferenceChange: setters.setCannabisPreference,
      onWorkoutPreferenceChange: setters.setWorkoutPreference,
      onDietaryPreferenceChange: setters.setDietaryPreference,
      onUseWeightFilterChange: setters.setUseWeightFilter,
      onUseIncomeFilterChange: setters.setUseIncomeFilter,
      onUseHeightFilterChange: setters.setUseHeightFilter,
      onWeightRangeMinChange: setters.setWeightRangeMin,
      onWeightRangeMaxChange: setters.setWeightRangeMax,
      onHeightRangeMinChange: setters.setHeightRangeMin,
      onHeightRangeMaxChange: setters.setHeightRangeMax,
      onIncomeRangeMinInputChange: setters.setIncomeRangeMinInput,
      onWeightStrictChange: setters.setWeightStrict,
      onIncomeStrictChange: setters.setIncomeStrict,
      onHeightStrictChange: setters.setHeightStrict,
    },
    config: {
      showErrors: state.showErrors,
      savingBasic: state.savingBasic,
      userId: userId || "",
    },
    onShowErrorsChange: setters.setShowErrors,
    onStepChange: setStep,
  }), [state, setters, userId, setStep]);

  const lifeDomainsProps = useMemo(() => ({
    guidance: guidance?.lifedomains || onboardingService.getStepGuidance("life-domains"),
    lifeDomainValues: state.lifeDomainValues,
    savingLifeDomains: state.savingLifeDomains,
    userId: userId || "",
    onValuesChange: setters.setLifeDomainValues,
    onStepChange: setStep,
  }), [state, setters, userId, setStep]);

  const photosProps = useMemo(() => ({
    guidance: "Upload at least one photo. You can add up to 5 photos total.",
    photos: state.photos,
    uploadingPhotosCount: state.uploadingPhotosCount,
    showErrors: state.showErrors,
    userId: userId || "",
    onPhotosChange: setters.setPhotos,
    onUploadingPhotosCountChange: setters.setUploadingPhotosCount,
    onShowErrorsChange: setters.setShowErrors,
    onStepChange: setStep,
  }), [state, setters, userId, setStep]);

  return {
    basicInfoProps,
    birthInfoProps,
    filtersProps,
    lifeDomainsProps,
    photosProps,
  };
};

