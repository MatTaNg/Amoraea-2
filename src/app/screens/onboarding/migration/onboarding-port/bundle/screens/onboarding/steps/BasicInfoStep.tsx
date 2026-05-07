import React from "react";
import { View, Text } from "react-native";
import { Button } from "@/shared/ui/Button";
import { BasicInfoForm } from "@/shared/components/BasicInfoForm";
import { AvailabilityModal } from "@/screens/profile/components/AvailabilityModal";
import { requestMyLocationLabel } from "@/screens/profile/utils/locationHelpers";
import { styles } from "../ProfileBuilderScreen.styled";
import { useAvailabilityAndContact } from "../hooks/useAvailabilityAndContact";
import { useLocationConversion } from "../hooks/useLocationConversion";
import { useLocationAutocomplete } from "@/shared/hooks/useLocationAutocomplete";
import { AvailabilitySlot } from "@/src/types";

interface BasicInfoStepProps {
  guidance: string;
  basicInfo: {
    displayName: string;
    gender: "man" | "woman" | "non-binary" | "";
    relationship: "monogamous" | "polyamorous" | "monogamous-ish" | "open" | "other" | "";
    location: string;
    validatedLocation: string;
    occupation: string;
    bio: string;
    locationSuggestions: Array<{ label: string }>;
    availability: AvailabilitySlot[];
    contactPreference?: "whatsapp" | "telegram" | "sms" | "instagram" | "facebook" | "";
    phoneNumber?: string;
  };
  metricConversion: {
    isMetric: boolean;
    weightRangeMin: number;
    weightRangeMax: number;
    heightRangeMin: number;
    heightRangeMax: number;
    distanceRangeMin: number;
    distanceRangeMax: number;
  };
  handlers: {
    onDisplayNameChange: (value: string) => void;
    onGenderChange: (value: any) => void;
    onRelationshipChange: (value: any) => void;
    onLocationChange: (value: string) => void;
    onValidatedLocationChange: (value: string) => void;
    onOccupationChange: (value: string) => void;
    onBioChange: (value: string) => void;
    onLocationSuggestionsChange: (suggestions: Array<{ label: string }>) => void;
    onAvailabilityChange: (availability: AvailabilitySlot[]) => void;
    onContactPreferenceChange: (value: any) => void;
    onPhoneNumberChange: (value: string) => void;
    onMetricChange: (isMetric: boolean) => void;
    onWeightRangeMinChange: (value: number) => void;
    onWeightRangeMaxChange: (value: number) => void;
    onHeightRangeMinChange: (value: number) => void;
    onHeightRangeMaxChange: (value: number) => void;
    onDistanceRangeMinChange: (value: number) => void;
    onDistanceRangeMaxChange: (value: number) => void;
  };
  config: {
    userId: string;
    showErrors: boolean;
    savingBasic: boolean;
  };
  onSave: () => Promise<void>;
  onLogout: () => Promise<void>;
  canContinue: () => boolean;
  onShowErrorsChange: (show: boolean) => void;
  onStepChange: (step: "birthinfo") => void;
}

export const BasicInfoStep: React.FC<BasicInfoStepProps> = ({
  guidance,
  basicInfo,
  metricConversion,
  handlers,
  config,
  onSave,
  onLogout,
  canContinue,
  onShowErrorsChange,
  onStepChange,
}) => {
  const {
    displayName,
    gender,
    relationship,
    location,
    validatedLocation,
    occupation,
    bio,
    availability,
    locationSuggestions,
    contactPreference,
    phoneNumber,
  } = basicInfo;
  
  const {
    isMetric,
    weightRangeMin,
    weightRangeMax,
    heightRangeMin,
    heightRangeMax,
    distanceRangeMin,
    distanceRangeMax,
  } = metricConversion;
  
  const { userId, showErrors, savingBasic } = config;
  // Use hook to manage availability modal and contact info
  const {
    showAvailabilityModal,
    savingAvailability,
    profileForModal,
    handleOpenModal,
    handleCloseModal,
    handleProfileUpdate,
    handleSave,
  } = useAvailabilityAndContact({
    userId,
    displayName,
    availability,
    contactPreference,
    phoneNumber,
    onAvailabilityChange: handlers.onAvailabilityChange,
    onContactPreferenceChange: handlers.onContactPreferenceChange,
    onPhoneNumberChange: handlers.onPhoneNumberChange,
  });

  // Use hook to handle location conversion
  const { handleLocationChange } = useLocationConversion({
    isMetric,
    weightRangeMin,
    weightRangeMax,
    heightRangeMin,
    heightRangeMax,
    distanceRangeMin,
    distanceRangeMax,
    onMetricChange: handlers.onMetricChange,
    onWeightRangeMinChange: handlers.onWeightRangeMinChange,
    onWeightRangeMaxChange: handlers.onWeightRangeMaxChange,
    onHeightRangeMinChange: handlers.onHeightRangeMinChange,
    onHeightRangeMaxChange: handlers.onHeightRangeMaxChange,
    onDistanceRangeMinChange: handlers.onDistanceRangeMinChange,
    onDistanceRangeMaxChange: handlers.onDistanceRangeMaxChange,
  });

  // Use location autocomplete hook
  useLocationAutocomplete({
    value: location,
    validatedValue: validatedLocation,
    onSuggestionsChange: handlers.onLocationSuggestionsChange,
  });

  const handleLocationSuggestionSelect = (selectedLocation: string) => {
    handlers.onLocationChange(selectedLocation);
    handlers.onValidatedLocationChange(selectedLocation);
    handlers.onLocationSuggestionsChange([]);
    handleLocationChange(selectedLocation, true);
  };

  const handleUseMyLocation = async () => {
    const loc = await requestMyLocationLabel();
    if (!loc) return;
    handlers.onLocationChange(loc);
    handlers.onValidatedLocationChange(loc);
    handlers.onLocationSuggestionsChange([]);
    handleLocationChange(loc, false); // Don't convert distance for "use my location"
  };


  const handleContinue = async () => {
    if (!canContinue()) {
      onShowErrorsChange(true);
      return;
    }
    try {
      await onSave();
      // Navigate to next step after successful save
      onStepChange("birthinfo");
    } catch (error: any) {
      // Error handling is done in onSave, but we don't navigate if save fails
      // Error saving basic info - handled silently
    }
  };

  return (
    <View>
      <Text style={styles.title}>Basic dating information</Text>
      <Text style={styles.help}>{guidance}</Text>
      <BasicInfoForm
        profile={{
          displayName,
          gender: gender || undefined,
          relationshipStyle: relationship || undefined,
          location: location || undefined,
          occupation: occupation || undefined,
          bio: bio || undefined,
        }}
        mode="create"
        showErrors={showErrors}
        showSaveButton={false}
        showCancelButton={false}
        onSave={async () => false}
        onFieldChange={(field, value) => {
          if (field === 'displayName') handlers.onDisplayNameChange(value as string);
          else if (field === 'gender') handlers.onGenderChange(value as any);
          else if (field === 'relationshipStyle') handlers.onRelationshipChange(value as any);
          else if (field === 'location') {
            handlers.onLocationChange(value as string);
            // Clear validated location when user types (unless it matches)
            if (validatedLocation !== value) {
              handlers.onValidatedLocationChange("");
            }
          }
          else if (field === 'occupation') handlers.onOccupationChange(value as string);
          else if (field === 'bio') handlers.onBioChange(value as string);
        }}
        onLocationChange={async (query: string) => {
          // Location autocomplete is handled by the hook
          // This callback is kept for BasicInfoForm compatibility but can be simplified
        }}
        locationSuggestions={locationSuggestions}
        onLocationSuggestionSelect={handleLocationSuggestionSelect}
        onUseMyLocation={handleUseMyLocation}
        validatedLocation={validatedLocation}
      />

      {/* Availability and Contact Info Button */}
      <View style={{ marginTop: 16, marginBottom: 16 }}>
        <Button
          title={availability && availability.length > 0 
            ? `Availability: ${availability.length} slot${availability.length !== 1 ? 's' : ''} set`
            : "Set Availability & Contact Info"}
          variant={availability && availability.length > 0 ? "primary" : "outline"}
          onPress={handleOpenModal}
        />
        {showErrors && (!availability || availability.length === 0 || !contactPreference || !phoneNumber) && (
          <Text style={[styles.error, { marginTop: 8 }]}>
            Please add at least one availability time slot and provide your contact information
          </Text>
        )}
      </View>

      <AvailabilityModal
        visible={showAvailabilityModal}
        onClose={handleCloseModal}
        profile={profileForModal}
        loading={savingAvailability}
        onProfileUpdate={handleProfileUpdate}
        onSave={handleSave}
      />

      <View style={styles.row}>
        <Button
          title="Logout"
          variant="outline"
          onPress={onLogout}
        />
        <Button
          title={config.savingBasic ? "Saving…" : "Continue"}
          disabled={config.savingBasic}
          onPress={handleContinue}
        />
      </View>
    </View>
  );
};

