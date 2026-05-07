import { useState } from "react";
import { AvailabilitySlot } from "@/src/types";

export interface BasicInfoState {
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
  availability: AvailabilitySlot[];
  showErrors: boolean;
  savingBasic: boolean;
}

export const useBasicInfoState = (initialLocation?: string) => {
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<"man" | "woman" | "non-binary" | "">("");
  const [relationship, setRelationship] = useState<"monogamous" | "polyamorous" | "monogamous-ish" | "open" | "other" | "">("");
  const [location, setLocation] = useState(initialLocation || "");
  const [validatedLocation, setValidatedLocation] = useState<string>(initialLocation || "");
  const [locationSuggestions, setLocationSuggestions] = useState<Array<{ label: string }>>([]);
  const [occupation, setOccupation] = useState("");
  const [bio, setBio] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberError, setPhoneNumberError] = useState<string>("");
  const [contactPreference, setContactPreference] = useState<"whatsapp" | "telegram" | "sms" | "instagram" | "facebook" | "">("");
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [savingBasic, setSavingBasic] = useState(false);

  const state: BasicInfoState = {
    displayName,
    gender,
    relationship,
    location,
    validatedLocation,
    locationSuggestions,
    occupation,
    bio,
    phoneNumber,
    phoneNumberError,
    contactPreference,
    availability,
    showErrors,
    savingBasic,
  };

  return {
    state,
    setters: {
      setDisplayName,
      setGender,
      setRelationship,
      setLocation,
      setValidatedLocation,
      setLocationSuggestions,
      setOccupation,
      setBio,
      setPhoneNumber,
      setPhoneNumberError,
      setContactPreference,
      setAvailability,
      setShowErrors,
      setSavingBasic,
    },
  };
};

