import React from "react";
import {
  View,
  Text,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Button } from "@/shared/ui/Button";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { useProfile } from "@/shared/hooks/useProfile";
import { HeightSlider } from "@/shared/components/HeightSlider";
import { WeightInput } from "@/shared/components/WeightInput";
import { IncomeDropdown } from "@/shared/components/IncomeDropdown";
import { DietDropdown } from "@/shared/components/DietDropdown";
import { styles } from "./AdditionalInfoScreen.styled";
import { useAdditionalInfoForm } from "./hooks/useAdditionalInfoForm";
import { DualInputField } from "./components/DualInputField";
import { PickerField } from "./components/PickerField";
import {
  CURRENCIES,
  DIETS,
  HABIT_OPTIONS,
  SLEEP_OPTIONS,
  HabitLevel,
} from "./constants/additionalInfoConstants";

export default function AdditionalInfoScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { formState, updateField, getFormData } = useAdditionalInfoForm();

  const handleContinue = () => {
    if (!user) return;

    const formData = getFormData();
    void updateProfile(formData).catch((err) => {
      if (__DEV__) console.warn('[AdditionalInfoScreen] background save failed', err);
    });

    navigation.goBack();
  };

  const handleSkip = () => {
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>Additional Information</Text>
        <Text style={styles.subtitle}>
          All of these values are optional - you can skip any field you're not
          comfortable sharing.
        </Text>

        {/* Height */}
        <HeightSlider
          label="Height"
          value={(() => {
            // Convert from onboarding format to HeightSlider format
            if (!formState.height) return '';
            
            // Handle special min/max values
            if (formState.height.includes('<5\'0"') || formState.height.includes('< 5\'0"')) {
              return "<5'0\"";
            }
            if (formState.height.includes('>8\'0"') || formState.height.includes('> 8\'0"')) {
              return ">8'0\"";
            }
            if (formState.height.includes('<152') || formState.height.includes('< 152')) {
              return '<152 cm';
            }
            if (formState.height.includes('>244') || formState.height.includes('> 244')) {
              return '>244 cm';
            }
            
            if (formState.heightUnit === 'cm') {
              return `${formState.height} cm`;
            } else {
              // If it's already in feet/inches format, use it directly
              if (formState.height.includes("'")) {
                return formState.height;
              }
              // Otherwise, assume it's just a number and format it
              return formState.height;
            }
          })()}
          onChange={(value) => {
            // Parse the value from HeightSlider format and update form state
            if (value.includes('cm')) {
              // Handle special cases for min/max
              if (value.includes('<152') || value.includes('< 152')) {
                updateField('height', '<152 cm');
                updateField('heightUnit', 'cm');
              } else if (value.includes('>244') || value.includes('> 244')) {
                updateField('height', '>244 cm');
                updateField('heightUnit', 'cm');
              } else {
                const cmMatch = value.match(/(\d+)/);
                if (cmMatch) {
                  updateField('height', cmMatch[1]);
                  updateField('heightUnit', 'cm');
                }
              }
            } else {
              // Handle special cases for min/max in feet/inches
              if (value.includes('<5\'0"') || value.includes('< 5\'0"')) {
                updateField('height', "<5'0\"");
                updateField('heightUnit', 'ft');
              } else if (value.includes('>8\'0"') || value.includes('> 8\'0"')) {
                updateField('height', ">8'0\"");
                updateField('heightUnit', 'ft');
              } else {
                // Feet/inches format like "5'10""
                const match = value.match(/(\d+)'(\d+)"/);
                if (match) {
                  updateField('height', value); // Store the full format
                  updateField('heightUnit', 'ft');
                }
              }
            }
          }}
          userLocation={profile?.location}
        />

        {/* Weight */}
        <WeightInput
          label="Weight"
          value={(() => {
            // Convert from onboarding format to WeightInput format
            if (!formState.weight) return '';
            if (formState.weightUnit === 'kg') {
              return `${formState.weight} kg`;
            } else {
              return `${formState.weight} lbs`;
            }
          })()}
          onChange={(value) => {
            // Parse the value from WeightInput format and update form state
            if (value.includes('kg')) {
              const kgMatch = value.match(/(\d+(?:\.\d+)?)/);
              if (kgMatch) {
                updateField('weight', kgMatch[1]);
                updateField('weightUnit', 'kg');
              }
            } else if (value.includes('lbs')) {
              const lbsMatch = value.match(/(\d+(?:\.\d+)?)/);
              if (lbsMatch) {
                updateField('weight', lbsMatch[1]);
                updateField('weightUnit', 'lbs');
              }
            }
          }}
          userLocation={profile?.location}
        />

        {/* Yearly Income */}
        <IncomeDropdown
          label="Yearly Income"
          value={formState.yearlyIncome}
          onChange={(value) => updateField('yearlyIncome', value)}
        />

        {/* Drinking */}
        <PickerField
          label="Drinking"
          value={formState.drinking}
          options={HABIT_OPTIONS}
          onValueChange={(value) => updateField('drinking', value)}
          activityType="drinking"
        />

        {/* Smoking */}
        <PickerField
          label="Smoking"
          value={formState.smoking}
          options={HABIT_OPTIONS}
          onValueChange={(value) => updateField('smoking', value)}
          activityType="smoking"
        />

        {/* Cannabis */}
        <PickerField
          label="Cannabis"
          value={formState.cannabis}
          options={HABIT_OPTIONS}
          onValueChange={(value) => updateField('cannabis', value)}
          activityType="cannabis"
        />

        {/* Workout */}
        <PickerField
          label="Workout"
          value={formState.workout}
          options={HABIT_OPTIONS}
          onValueChange={(value) => updateField('workout', value)}
          activityType="workout"
        />

        {/* Diet */}
        <DietDropdown
          label="Diet"
          diet={formState.diet}
          onDietChange={(value) => updateField('diet', value)}
        />

        {/* Sleep Schedule */}
        <PickerField
          label="Sleeping Habits"
          value={formState.sleepSchedule}
          options={SLEEP_OPTIONS}
          onValueChange={(value) => updateField('sleepSchedule', value)}
        />

        <View style={styles.buttonContainer}>
          <Button
            title="Skip All"
            variant="outline"
            onPress={handleSkip}
            style={styles.skipButton}
          />
          <Button title="Continue" onPress={handleContinue} style={styles.continueButton} />
        </View>
      </ScrollView>
    </View>
  );
}
