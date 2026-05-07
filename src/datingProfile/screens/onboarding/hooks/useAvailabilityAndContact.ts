import { useState, useEffect, useRef } from "react";
import { UserProfile, AvailabilitySlot } from "@/src/types";
import { profilesRepo } from "@/data/repos/profilesRepo";
import { showError, handleApiError } from "@/shared/utils/errorHandling";

interface UseAvailabilityAndContactProps {
  userId: string;
  displayName: string;
  availability: AvailabilitySlot[];
  contactPreference?: "whatsapp" | "telegram" | "sms" | "instagram" | "facebook" | "";
  phoneNumber?: string;
  onAvailabilityChange: (availability: AvailabilitySlot[]) => void;
  onContactPreferenceChange: (value: any) => void;
  onPhoneNumberChange: (value: string) => void;
}

/**
 * Hook to manage availability modal and contact information state
 * Encapsulates modal visibility, profile state, and save logic
 */
export const useAvailabilityAndContact = ({
  userId,
  displayName,
  availability,
  contactPreference,
  phoneNumber,
  onAvailabilityChange,
  onContactPreferenceChange,
  onPhoneNumberChange,
}: UseAvailabilityAndContactProps) => {
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [savingAvailability, setSavingAvailability] = useState(false);
  
  // Track contact preference and phone number locally
  const [localContactPreference, setLocalContactPreference] = useState<any>(contactPreference);
  const [localPhoneNumber, setLocalPhoneNumber] = useState<string>(phoneNumber || "");

  // Initialize contact info from props when they change
  useEffect(() => {
    setLocalContactPreference(contactPreference);
    setLocalPhoneNumber(phoneNumber || "");
  }, [contactPreference, phoneNumber]);

  // Create a profile-like object for AvailabilityModal
  const [profileForModal, setProfileForModal] = useState<UserProfile>({
    id: userId,
    email: "",
    displayName,
    tier: "FREE",
    availability: availability || [],
    contactPreference: localContactPreference,
    phoneNumber: localPhoneNumber,
    createdAt: new Date().toISOString(),
  });

  // Use a ref to always get the latest profileForModal state
  const profileForModalRef = useRef(profileForModal);
  
  // Update ref whenever profileForModal changes
  useEffect(() => {
    profileForModalRef.current = profileForModal;
  }, [profileForModal]);

  // Update profileForModal when availability or local contact fields change
  // BUT only if the modal is closed (to avoid overwriting user edits in the modal)
  useEffect(() => {
    if (!showAvailabilityModal) {
      setProfileForModal(prev => ({
        ...prev,
        availability: availability || [],
        contactPreference: localContactPreference,
        phoneNumber: localPhoneNumber,
      }));
    }
  }, [availability, localContactPreference, localPhoneNumber, showAvailabilityModal]);

  // Update profileForModal when displayName changes
  useEffect(() => {
    setProfileForModal(prev => ({
      ...prev,
      displayName,
    }));
  }, [displayName]);

  // Handle opening the modal
  const handleOpenModal = () => {
    setProfileForModal(prev => ({
      ...prev,
      availability: availability || [],
      contactPreference: contactPreference || undefined,
      phoneNumber: phoneNumber || "",
    }));
    setLocalContactPreference(contactPreference);
    setLocalPhoneNumber(phoneNumber || "");
    setShowAvailabilityModal(true);
  };

  // Handle closing the modal
  const handleCloseModal = () => {
    setShowAvailabilityModal(false);
  };

  // Handle profile update from modal
  const handleProfileUpdate = (updatedProfile: UserProfile) => {
    setProfileForModal(updatedProfile);
    profileForModalRef.current = updatedProfile;
  };

  // Handle saving availability and contact info
  const handleSave = async (profileFromModal: UserProfile) => {
    const latestAvailability = profileFromModal?.availability ?? [];
    const latestContactPreference = profileFromModal?.contactPreference ?? "";
    const latestPhoneNumber = profileFromModal?.phoneNumber ?? "";
    
    // Validate contact information
    if (!latestContactPreference || !latestPhoneNumber) {
      showError("Please provide your contact preference and contact information.", "Validation Error");
      return;
    }
    
    setSavingAvailability(true);
    try {
      const result = await profilesRepo.updateProfile(userId, {
        availability: latestAvailability,
        contactPreference: latestContactPreference || undefined,
        phoneNumber: latestPhoneNumber || undefined,
      });
      
      if (result.success) {
        // Update parent state
        onAvailabilityChange(latestAvailability);
        setLocalContactPreference(latestContactPreference);
        setLocalPhoneNumber(latestPhoneNumber);
        onContactPreferenceChange(latestContactPreference);
        onPhoneNumberChange(latestPhoneNumber);
      } else {
        handleApiError(
          result.error || new Error("Save failed"),
          "Failed to save availability and contact information."
        );
        throw new Error(result.error?.message || "Save failed");
      }
    } catch (error: any) {
      handleApiError(error, "Failed to save availability and contact information.");
      // Failed to save availability - handled by error state
      throw error; // Re-throw so modal doesn't close on error
    } finally {
      setSavingAvailability(false);
    }
  };

  return {
    showAvailabilityModal,
    savingAvailability,
    profileForModal,
    handleOpenModal,
    handleCloseModal,
    handleProfileUpdate,
    handleSave,
  };
};

