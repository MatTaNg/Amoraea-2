import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { handleApiError } from "@/shared/utils/errorHandling";
import { Button } from "@/shared/ui/Button";
import { Input } from "@/shared/ui/Input";
import { DatePicker, TimePicker } from "@/shared/components/DatePicker";
import { styles } from "../ProfileBuilderScreen.styled";
import { useProfile } from "@/shared/hooks/useProfile";
import { useLocationAutocomplete } from "@/shared/hooks/useLocationAutocomplete";
import { calculateAgeFromBirthdate } from "@/shared/utils/ageCalculator";

interface BirthInfoStepProps {
  guidance: string;
  birthDate: string;
  birthTime: string;
  birthLocation: string;
  validatedBirthLocation: string;
  birthLocationSuggestions: Array<{ label: string }>;
  showErrors: boolean;
  savingBasic: boolean;
  userId: string;
  onBirthDateChange: (value: string) => void;
  onBirthTimeChange: (value: string) => void;
  onBirthLocationChange: (value: string) => void;
  onValidatedBirthLocationChange: (value: string) => void;
  onBirthLocationSuggestionsChange: (suggestions: Array<{ label: string }>) => void;
  onShowErrorsChange: (show: boolean) => void;
  onStepChange: (step: "basic" | "filters") => void;
}

export const BirthInfoStep: React.FC<BirthInfoStepProps> = ({
  guidance,
  birthDate,
  birthTime,
  birthLocation,
  validatedBirthLocation,
  birthLocationSuggestions,
  showErrors,
  savingBasic,
  userId,
  onBirthDateChange,
  onBirthTimeChange,
  onBirthLocationChange,
  onValidatedBirthLocationChange,
  onBirthLocationSuggestionsChange,
  onShowErrorsChange,
  onStepChange,
}) => {
  const { updateProfile } = useProfile();

  // Use location autocomplete hook
  useLocationAutocomplete({
    value: birthLocation,
    validatedValue: validatedBirthLocation,
    onSuggestionsChange: onBirthLocationSuggestionsChange,
  });

  const handleContinue = async () => {
    if (!birthDate.trim() || !birthTime.trim() || !birthLocation.trim()) {
      onShowErrorsChange(true);
      return;
    }
    if (!validatedBirthLocation || validatedBirthLocation !== birthLocation.trim()) {
      onShowErrorsChange(true);
      return;
    }
    
    // Calculate age from birth date
    const calculatedAge = calculateAgeFromBirthdate(birthDate.trim());
    
    const profileUpdates: any = {
      birthDate: birthDate.trim(),
      birthTime: birthTime.trim(),
      birthLocation: validatedBirthLocation || birthLocation.trim(),
    };
    
    // Include age if calculated successfully
    if (calculatedAge !== null) {
      profileUpdates.age = calculatedAge;
    }
    
    const success = await updateProfile(profileUpdates);
    
    if (success) {
      // Go to Filters step
      onStepChange("filters");
    }
  };

  return (
    <View>
      <Text style={styles.title}>Birth Information</Text>
      <Text style={styles.help}>
        {guidance}
      </Text>

      {/* Birth Date */}
      <DatePicker
        label="Birth Date *"
        value={birthDate}
        onValueChange={onBirthDateChange}
        maxYear={new Date().getFullYear() - 18}
        error={showErrors && !birthDate.trim() ? "Birth date is required" : undefined}
      />

      {/* Birth Time */}
      <TimePicker
        label="Birth Time *"
        value={birthTime}
        onValueChange={onBirthTimeChange}
        error={showErrors && !birthTime.trim() ? "Birth time is required" : undefined}
      />

      <Input
        label="Birth Location *"
        value={birthLocation}
        onChangeText={(v) => {
          onBirthLocationChange(v);
          // Clear validated location when user types (unless it matches)
          if (validatedBirthLocation !== v) {
            onValidatedBirthLocationChange("");
          }
        }}
        placeholder="City, State/Country (e.g., New York, NY or London, UK)"
        keyboardType="default"
      />
      {showErrors && !birthLocation.trim() ? (
        <Text style={styles.error}>Birth location is required</Text>
      ) : null}
      {showErrors && birthLocation.trim() && !validatedBirthLocation ? (
        <Text style={styles.error}>
          {birthLocationSuggestions.length > 0 
            ? "Please select a birth location from the suggestions above" 
            : "Please wait for location suggestions or type at least 3 characters"}
        </Text>
      ) : null}
      {birthLocationSuggestions.length > 0 && !validatedBirthLocation && (
        <View style={styles.suggestionsContainer}>
          {birthLocationSuggestions.map((s, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.suggestionButton}
              onPress={() => {
                onBirthLocationChange(s.label);
                onValidatedBirthLocationChange(s.label);
                onBirthLocationSuggestionsChange([]);
              }}
            >
              <Text style={styles.suggestionText}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.row}>
        <Button
          title="Back"
          variant="outline"
          onPress={() => onStepChange("basic")}
        />
        <Button
          title={savingBasic ? "Saving…" : "Continue"}
          disabled={savingBasic}
          onPress={handleContinue}
        />
      </View>
    </View>
  );
};

