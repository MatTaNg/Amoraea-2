import { useCallback } from "react";
import { onboardingService } from "@/data/services/onboardingService";
import { useProfile } from "@/shared/hooks/useProfile";
import { handleApiError } from "@/shared/utils/errorHandling";

interface UseOnboardingSaveProps {
  userId: string;
  displayName: string;
  gender: "man" | "woman" | "non-binary" | "";
  relationship: "monogamous" | "polyamorous" | "monogamous-ish" | "open" | "other" | "";
  location: string;
  validatedLocation: string;
  occupation: string;
  bio: string;
  availability: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isRecurring: boolean;
  }>;
  contactPreference: "whatsapp" | "telegram" | "sms" | "instagram" | "facebook" | "";
  phoneNumber: string;
}

/**
 * Hook to handle saving basic info during onboarding
 * Encapsulates the save logic for the basic info step
 */
export const useOnboardingSave = ({
  userId,
  displayName,
  gender,
  relationship,
  location,
  validatedLocation,
  occupation,
  bio,
  availability,
  contactPreference,
  phoneNumber,
}: UseOnboardingSaveProps) => {
  const { updateProfile } = useProfile();
  
  const saveBasicInfo = useCallback(async () => {
    const res = await onboardingService.updateBasicInfo(userId, {
      displayName: displayName.trim(),
      gender: gender as any,
      attractedTo: undefined,
      relationshipStyle: relationship as any,
      location: validatedLocation || location.trim(),
      occupation: occupation.trim(),
      bio: bio.trim() || undefined,
    });
    
    if (availability && availability.length > 0) {
      await updateProfile({
        availability: availability,
        contactPreference: contactPreference as any,
        phoneNumber: phoneNumber.trim(),
      });
    }
    
    if (!res.success) {
      const errorMsg = res.error?.message || "Failed to save your information. Please try again.";
      handleApiError(new Error(errorMsg), "Save failed");
      throw new Error(errorMsg);
    }
  }, [
    userId,
    displayName,
    gender,
    relationship,
    location,
    validatedLocation,
    occupation,
    bio,
    availability,
    contactPreference,
    phoneNumber,
  ]);

  return {
    saveBasicInfo,
  };
};

