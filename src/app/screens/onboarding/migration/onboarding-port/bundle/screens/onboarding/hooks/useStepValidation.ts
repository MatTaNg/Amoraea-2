import { useMemo } from "react";

interface OnboardingState {
  displayName: string;
  gender: "man" | "woman" | "non-binary" | "";
  relationship: "monogamous" | "polyamorous" | "monogamous-ish" | "open" | "other" | "";
  location: string;
  validatedLocation: string;
  occupation: string;
  availability: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isRecurring: boolean;
  }>;
  contactPreference: "whatsapp" | "telegram" | "sms" | "instagram" | "facebook" | "";
  phoneNumber: string;
  birthDate: string;
  birthTime: string;
  birthLocation: string;
  validatedBirthLocation: string;
  photos: string[];
}

interface UseStepValidationParams {
  state: OnboardingState;
}

/**
 * Hook to validate onboarding steps
 * Centralizes validation logic for each step
 */
export const useStepValidation = ({ state }: UseStepValidationParams) => {
  /**
   * Validates the basic info step
   * All fields must be filled and valid
   */
  const canContinueBasic = useMemo(() => {
    return () => {
      if (!state.displayName.trim()) return false;
      if (!state.gender) return false;
      if (!state.relationship) return false;
      if (!state.location.trim() || !state.validatedLocation) return false;
      if (!state.occupation.trim()) return false;
      if (!state.availability || state.availability.length === 0) return false;
      if (!state.contactPreference || !state.phoneNumber) return false;
      return true;
    };
  }, [
    state.displayName,
    state.gender,
    state.relationship,
    state.location,
    state.validatedLocation,
    state.occupation,
    state.availability,
    state.contactPreference,
    state.phoneNumber,
  ]);

  /**
   * Validates the birth info step
   * Birth date, time, and location must be provided
   */
  const canContinueBirthInfo = useMemo(() => {
    if (!state.birthDate) return false;
    if (!state.birthTime) return false;
    if (!state.birthLocation.trim() || !state.validatedBirthLocation) return false;
    return true;
  }, [state.birthDate, state.birthTime, state.birthLocation, state.validatedBirthLocation]);

  /**
   * Validates the photos step
   * At least one photo must be uploaded
   */
  const canContinuePhotos = useMemo(() => {
    return state.photos && state.photos.length > 0;
  }, [state.photos]);

  return {
    canContinueBasic,
    canContinueBirthInfo,
    canContinuePhotos,
  };
};

