import { useEffect } from "react";
import { useProfile } from "@/shared/hooks/useProfile";
import { milesToKm, lbsToKg, inchesToCm } from "@/shared/utils/metricHelpers";
import { useBasicInfoState } from "./useBasicInfoState";
import { useBirthInfoState } from "./useBirthInfoState";
import { useFilterPreferencesState } from "./useFilterPreferencesState";
import { useLifeDomainsState } from "./useLifeDomainsState";
import { usePhotosState } from "./usePhotosState";

interface OnboardingState {
  // Basic info
  displayName: string;
  gender: "man" | "woman" | "non-binary" | "";
  relationship: "monogamous" | "polyamorous" | "monogamous-ish" | "open" | "other" | "";
  location: string;
  validatedLocation: string;
  locationSuggestions: Array<{ label: string }>;
  occupation: string;
  bio: string;
  phoneNumber: string;
  phoneNumberError: string;
  contactPreference: "whatsapp" | "telegram" | "sms" | "instagram" | "facebook" | "";
  availability: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isRecurring: boolean;
  }>;
  
  // Birth info
  birthDate: string;
  birthTime: string;
  birthLocation: string;
  validatedBirthLocation: string;
  birthLocationSuggestions: Array<{ label: string }>;
  
  // Filters
  distanceRangeMin: number;
  distanceRangeMax: number;
  ageRangeMin: number;
  ageRangeMax: number;
  genderPreference: string[];
  smokingPreference: string;
  drinkingPreference: string;
  cannabisPreference: string;
  workoutPreference: string;
  dietaryPreference: string;
  useWeightFilter: boolean;
  useIncomeFilter: boolean;
  useHeightFilter: boolean;
  weightRangeMin: number;
  weightRangeMax: number;
  incomeRangeMinInput: string;
  heightRangeMin: number;
  heightRangeMax: number;
  weightStrict: boolean;
  incomeStrict: boolean;
  heightStrict: boolean;
  isMetric: boolean;
  
  // Life domains
  lifeDomainValues: {
    intimacy: number;
    finance: number;
    spirituality: number;
    family: number;
    physicalHealth: number;
  };
  
  // Photos
  photos: string[];
  uploadingPhotosCount: number;
  
  // UI state
  showErrors: boolean;
  savingBasic: boolean;
  savingLifeDomains: boolean;
}

interface UseOnboardingStateReturn {
  state: OnboardingState;
  setters: {
    setDisplayName: (value: string) => void;
    setGender: (value: "man" | "woman" | "non-binary" | "") => void;
    setRelationship: (value: "monogamous" | "polyamorous" | "monogamous-ish" | "open" | "other" | "") => void;
    setLocation: (value: string) => void;
    setValidatedLocation: (value: string) => void;
    setLocationSuggestions: (value: Array<{ label: string }>) => void;
    setOccupation: (value: string) => void;
    setBio: (value: string) => void;
    setPhoneNumber: (value: string) => void;
    setPhoneNumberError: (value: string) => void;
    setContactPreference: (value: "whatsapp" | "telegram" | "sms" | "instagram" | "facebook" | "") => void;
    setAvailability: (value: Array<{ id: string; dayOfWeek: number; startTime: string; endTime: string; isRecurring: boolean }>) => void;
    setBirthDate: (value: string) => void;
    setBirthTime: (value: string) => void;
    setBirthLocation: (value: string) => void;
    setValidatedBirthLocation: (value: string) => void;
    setBirthLocationSuggestions: (value: Array<{ label: string }>) => void;
    setDistanceRangeMin: (value: number) => void;
    setDistanceRangeMax: (value: number) => void;
    setAgeRangeMin: (value: number) => void;
    setAgeRangeMax: (value: number) => void;
    setGenderPreference: (value: string[]) => void;
    setSmokingPreference: (value: string) => void;
    setDrinkingPreference: (value: string) => void;
    setCannabisPreference: (value: string) => void;
    setWorkoutPreference: (value: string) => void;
    setDietaryPreference: (value: string) => void;
    setUseWeightFilter: (value: boolean) => void;
    setUseIncomeFilter: (value: boolean) => void;
    setUseHeightFilter: (value: boolean) => void;
    setWeightRangeMin: (value: number) => void;
    setWeightRangeMax: (value: number) => void;
    setIncomeRangeMinInput: (value: string) => void;
    setHeightRangeMin: (value: number) => void;
    setHeightRangeMax: (value: number) => void;
    setWeightStrict: (value: boolean) => void;
    setIncomeStrict: (value: boolean) => void;
    setHeightStrict: (value: boolean) => void;
    setIsMetric: (value: boolean) => void;
    setLifeDomainValues: (value: {
      intimacy: number;
      finance: number;
      spirituality: number;
      family: number;
      physicalHealth: number;
    }) => void;
    setPhotos: (value: string[]) => void;
    setUploadingPhotosCount: (value: number) => void;
    setShowErrors: (value: boolean) => void;
    setSavingBasic: (value: boolean) => void;
    setSavingLifeDomains: (value: boolean) => void;
  };
  loadProfileData: () => Promise<void>;
}

/**
 * Composed hook that manages all onboarding state by combining smaller domain-specific hooks.
 * This maintains the same external API while internally using modular hooks.
 */
export const useOnboardingState = (userId: string | undefined): UseOnboardingStateReturn => {
  const { profile } = useProfile();
  
  // Use smaller domain-specific hooks
  const basicInfo = useBasicInfoState();
  const birthInfo = useBirthInfoState();
  const lifeDomains = useLifeDomainsState();
  const photos = usePhotosState();
  
  // Filter preferences depends on basic info (location, gender) and birth info (birthDate)
  const filterPrefs = useFilterPreferencesState({
    userLocation: basicInfo.state.location,
    userGender: basicInfo.state.gender,
    birthDate: birthInfo.state.birthDate,
  });

  const loadProfileData = async () => {
    if (!profile) return;
    
    // Load basic info
    basicInfo.setters.setDisplayName(profile.displayName || "");
    basicInfo.setters.setGender((profile.gender as any) || "");
    basicInfo.setters.setRelationship((profile.relationshipStyle as any) || "");
    const savedLocation = profile.location || "";
    basicInfo.setters.setLocation(savedLocation);
    if (savedLocation) {
      basicInfo.setters.setValidatedLocation(savedLocation);
    }
    basicInfo.setters.setOccupation(profile.occupation || "");
    basicInfo.setters.setBio(profile.bio || "");
    basicInfo.setters.setContactPreference((profile.contactPreference as any) || "");
    basicInfo.setters.setPhoneNumber(profile.phoneNumber || "");
    basicInfo.setters.setAvailability(profile.availability || []);
    
    // Load birth info
    birthInfo.setters.setBirthDate((profile as any)?.birthDate || "");
    birthInfo.setters.setBirthTime((profile as any)?.birthTime || "");
    const savedBirthLocation = (profile as any)?.birthLocation || "";
    birthInfo.setters.setBirthLocation(savedBirthLocation);
    if (savedBirthLocation) {
      birthInfo.setters.setValidatedBirthLocation(savedBirthLocation);
    }
    
    // Load filter preferences with metric conversion
    const matchPrefs = profile.matchPreferences || {};
    const userIsMetric = filterPrefs.state.isMetric;
    
    if (matchPrefs.distanceRange) {
      filterPrefs.setters.setDistanceRangeMin(
        userIsMetric ? milesToKm(matchPrefs.distanceRange[0] || 1) : (matchPrefs.distanceRange[0] || 1)
      );
      filterPrefs.setters.setDistanceRangeMax(
        userIsMetric ? milesToKm(matchPrefs.distanceRange[1] || 50) : (matchPrefs.distanceRange[1] || 50)
      );
    } else {
      filterPrefs.setters.setDistanceRangeMin(userIsMetric ? 1 : 1);
      filterPrefs.setters.setDistanceRangeMax(userIsMetric ? 16 : 10);
    }
    
    if (matchPrefs.ageRange) {
      filterPrefs.setters.setAgeRangeMin(matchPrefs.ageRange[0] || 18);
      filterPrefs.setters.setAgeRangeMax(matchPrefs.ageRange[1] || 100);
    } else if (profile.birthDate) {
      const birthDateStr = (profile as any)?.birthDate;
      if (birthDateStr && /^\d{4}-\d{2}-\d{2}$/.test(birthDateStr)) {
        const [year, month, day] = birthDateStr.split('-').map(Number);
        const birthDateObj = new Date(year, month - 1, day);
        const today = new Date();
        let age = today.getFullYear() - birthDateObj.getFullYear();
        const monthDiff = today.getMonth() - birthDateObj.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
          age--;
        }
        const minAge = Math.max(18, Math.floor(age / 2) + 7);
        const maxAge = Math.min(100, age + 15);
        filterPrefs.setters.setAgeRangeMin(minAge);
        filterPrefs.setters.setAgeRangeMax(maxAge);
      }
    }
    
    if (matchPrefs.genderPreference) {
      if (Array.isArray(matchPrefs.genderPreference)) {
        filterPrefs.setters.setGenderPreference(matchPrefs.genderPreference);
      } else if (matchPrefs.genderPreference === "all") {
        filterPrefs.setters.setGenderPreference(["men", "women", "non-binary"]);
      } else {
        filterPrefs.setters.setGenderPreference([matchPrefs.genderPreference]);
      }
    } else if (profile.gender) {
      const userGender = profile.gender as string;
      if (userGender === "man") {
        filterPrefs.setters.setGenderPreference(["women"]);
      } else if (userGender === "woman") {
        filterPrefs.setters.setGenderPreference(["men"]);
      } else {
        filterPrefs.setters.setGenderPreference(["men", "women", "non-binary"]);
      }
    }
    
    // Load lifestyle preferences
    filterPrefs.setters.setSmokingPreference(matchPrefs.smokingPreference || "any");
    filterPrefs.setters.setDrinkingPreference(matchPrefs.drinkingPreference || "any");
    filterPrefs.setters.setCannabisPreference(matchPrefs.cannabisPreference || "any");
    filterPrefs.setters.setWorkoutPreference(matchPrefs.workoutPreference || "any");
    filterPrefs.setters.setDietaryPreference(matchPrefs.dietaryPreference || "any");
    
    // Load premium filters with metric conversion
    if (matchPrefs.weightRange) {
      filterPrefs.setters.setWeightRangeMin(
        userIsMetric ? lbsToKg(matchPrefs.weightRange[0] || 100) : (matchPrefs.weightRange[0] || 100)
      );
      filterPrefs.setters.setWeightRangeMax(
        userIsMetric ? lbsToKg(matchPrefs.weightRange[1] || 300) : (matchPrefs.weightRange[1] || 300)
      );
    }
    if (matchPrefs.incomeRange) {
      filterPrefs.setters.setIncomeRangeMinInput(String(matchPrefs.incomeRange[0] || 0));
    }
    if (matchPrefs.heightRange) {
      filterPrefs.setters.setHeightRangeMin(
        userIsMetric ? inchesToCm(matchPrefs.heightRange[0] || 48) : (matchPrefs.heightRange[0] || 48)
      );
      filterPrefs.setters.setHeightRangeMax(
        userIsMetric ? inchesToCm(matchPrefs.heightRange[1] || 96) : (matchPrefs.heightRange[1] || 96)
      );
    }
    
    // Load strict flags
    filterPrefs.setters.setWeightStrict(matchPrefs.weightStrict || false);
    filterPrefs.setters.setIncomeStrict(matchPrefs.incomeStrict || false);
    filterPrefs.setters.setHeightStrict(matchPrefs.heightStrict || false);
    
    // Load photos
    photos.setters.setPhotos(profile.photos || []);

    // Load life domains
    if (profile.lifeDomains) {
      const values = profile.lifeDomains as {
        intimacy?: number;
        finance?: number;
        spirituality?: number;
        family?: number;
        physicalHealth?: number;
      };
      // Normalize to ensure sum is 100
      const sum =
        (values.intimacy ?? 0) +
        (values.finance ?? 0) +
        (values.spirituality ?? 0) +
        (values.family ?? 0) +
        (values.physicalHealth ?? 0);
      if (sum === 100) {
        lifeDomains.setters.setLifeDomainValues({
          intimacy: values.intimacy ?? 0,
          finance: values.finance ?? 0,
          spirituality: values.spirituality ?? 0,
          family: values.family ?? 0,
          physicalHealth: values.physicalHealth ?? 0,
        });
      } else if (sum > 0) {
        // Normalize to 100
        const factor = 100 / sum;
        lifeDomains.setters.setLifeDomainValues({
          intimacy: Math.round((values.intimacy ?? 0) * factor),
          finance: Math.round((values.finance ?? 0) * factor),
          spirituality: Math.round((values.spirituality ?? 0) * factor),
          family: Math.round((values.family ?? 0) * factor),
          physicalHealth: Math.round((values.physicalHealth ?? 0) * factor),
        });
      }
    }
  };

  useEffect(() => {
    if (profile) {
      loadProfileData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Combine all state into single object
  const state: OnboardingState = {
    // Basic info
    ...basicInfo.state,
    // Birth info
    ...birthInfo.state,
    // Filters
    ...filterPrefs.state,
    // Life domains
    ...lifeDomains.state,
    // Photos
    ...photos.state,
  };

  // Combine all setters
  return {
    state,
    setters: {
      ...basicInfo.setters,
      ...birthInfo.setters,
      ...filterPrefs.setters,
      ...lifeDomains.setters,
      ...photos.setters,
    },
    loadProfileData,
  };
};
