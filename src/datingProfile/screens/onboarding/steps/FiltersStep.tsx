import React from "react";
import { View, Text } from "react-native";
import { Button } from "@/shared/ui/Button";
import { styles } from "../ProfileBuilderScreen.styled";
import { useProfile } from "@/shared/hooks/useProfile";
import { kgToLbs, cmToInches, kmToMiles } from "@/shared/utils/metricHelpers";
import { BasicFiltersSection } from "@/shared/components/filters/BasicFiltersSection";
import { LifestyleFiltersSection } from "@/shared/components/filters/LifestyleFiltersSection";
import { PremiumFiltersSection } from "@/shared/components/filters/PremiumFiltersSection";
import { GenderPreferenceMultiSelect } from "@/shared/components/filters/GenderPreferenceMultiSelect";

interface FiltersState {
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
  heightRangeMin: number;
  heightRangeMax: number;
  incomeRangeMinInput: string;
  weightStrict: boolean;
  incomeStrict: boolean;
  heightStrict: boolean;
  isMetric: boolean;
}

interface FiltersHandlers {
  onDistanceRangeMinChange: (value: number) => void;
  onDistanceRangeMaxChange: (value: number) => void;
  onAgeRangeMinChange: (value: number) => void;
  onAgeRangeMaxChange: (value: number) => void;
  onGenderPreferenceChange: (value: string[]) => void;
  onSmokingPreferenceChange: (value: string) => void;
  onDrinkingPreferenceChange: (value: string) => void;
  onCannabisPreferenceChange: (value: string) => void;
  onWorkoutPreferenceChange: (value: string) => void;
  onDietaryPreferenceChange: (value: string) => void;
  onUseWeightFilterChange: (value: boolean) => void;
  onUseIncomeFilterChange: (value: boolean) => void;
  onUseHeightFilterChange: (value: boolean) => void;
  onWeightRangeMinChange: (value: number) => void;
  onWeightRangeMaxChange: (value: number) => void;
  onHeightRangeMinChange: (value: number) => void;
  onHeightRangeMaxChange: (value: number) => void;
  onIncomeRangeMinInputChange: (value: string) => void;
  onWeightStrictChange: (value: boolean) => void;
  onIncomeStrictChange: (value: boolean) => void;
  onHeightStrictChange: (value: boolean) => void;
}

interface FiltersStepProps {
  guidance: string;
  filters: FiltersState;
  handlers: FiltersHandlers;
  config: {
    showErrors: boolean;
    savingBasic: boolean;
    userId: string;
  };
  onShowErrorsChange: (show: boolean) => void;
  onStepChange: (step: "birthinfo" | "lifedomains") => void;
}

export const FiltersStep: React.FC<FiltersStepProps> = ({
  guidance,
  filters,
  handlers,
  config,
  onShowErrorsChange,
  onStepChange,
}) => {
  const { updateProfile } = useProfile();

  const handleContinue = () => {
    if (!filters.genderPreference.length) {
      onShowErrorsChange(true);
      return;
    }
    void updateProfile({
      matchPreferences: {
        distanceRange: filters.isMetric
          ? [kmToMiles(filters.distanceRangeMin), kmToMiles(filters.distanceRangeMax)]
          : [Math.round(filters.distanceRangeMin), Math.round(filters.distanceRangeMax)],
        ageRange: [Math.round(filters.ageRangeMin), Math.round(filters.ageRangeMax)],
        genderPreference:
          filters.genderPreference.length === 3
            ? 'all'
            : filters.genderPreference.length === 1
              ? filters.genderPreference[0]
              : ((filters.genderPreference.length > 0
                  ? filters.genderPreference.join(',')
                  : undefined) as string | undefined),
        smokingPreference: filters.smokingPreference,
        drinkingPreference: filters.drinkingPreference,
        cannabisPreference: filters.cannabisPreference,
        workoutPreference: filters.workoutPreference,
        dietaryPreference: filters.dietaryPreference,
        ...(filters.useWeightFilter && {
          weightRange: filters.isMetric
            ? [kgToLbs(filters.weightRangeMin), kgToLbs(filters.weightRangeMax)]
            : [Math.round(filters.weightRangeMin), Math.round(filters.weightRangeMax)],
          weightStrict: filters.weightStrict,
        }),
        ...(filters.useIncomeFilter && {
          incomeRange: [parseInt(filters.incomeRangeMinInput || '0') || 0, 999999],
          incomeStrict: filters.incomeStrict,
        }),
        ...(filters.useHeightFilter && {
          heightRange: filters.isMetric
            ? [cmToInches(filters.heightRangeMin), cmToInches(filters.heightRangeMax)]
            : [Math.round(filters.heightRangeMin), Math.round(filters.heightRangeMax)],
          heightStrict: filters.heightStrict,
        }),
      },
    }).catch((err) => {
      if (__DEV__) console.warn('[FiltersStep] background save failed', err);
    });

    onStepChange('lifedomains');
  };

  return (
    <View>
      <Text style={styles.title}>Filter Settings</Text>
      <Text style={styles.help}>
        {guidance}
      </Text>

      {/* Basic Filters */}
      <BasicFiltersSection
        distanceRange={[filters.distanceRangeMin, filters.distanceRangeMax]}
        ageRange={[filters.ageRangeMin, filters.ageRangeMax]}
        genderPreference={filters.genderPreference}
        isMetric={filters.isMetric}
        onDistanceChange={(min, max) => {
          handlers.onDistanceRangeMinChange(min);
          handlers.onDistanceRangeMaxChange(max);
        }}
        onAgeChange={(min, max) => {
          handlers.onAgeRangeMinChange(min);
          handlers.onAgeRangeMaxChange(max);
        }}
        onGenderChange={(value) => {
          if (Array.isArray(value)) {
            handlers.onGenderPreferenceChange(value);
          } else {
            handlers.onGenderPreferenceChange([value]);
          }
        }}
        styles={{
          section: { marginBottom: 24 },
          sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16, color: "#333" },
          filterContainer: { marginBottom: 16 },
          filterLabel: { fontSize: 14, fontWeight: "600", marginBottom: 8, color: "#333" },
        }}
      />

      {/* Gender Preference Multi-Select */}
      <GenderPreferenceMultiSelect
        value={filters.genderPreference}
        onChange={handlers.onGenderPreferenceChange}
        error={config.showErrors && !filters.genderPreference.length ? "Please select at least one option" : undefined}
      />

      {/* Lifestyle Preferences */}
      <LifestyleFiltersSection
        smokingPreference={filters.smokingPreference}
        drinkingPreference={filters.drinkingPreference}
        cannabisPreference={filters.cannabisPreference}
        workoutPreference={filters.workoutPreference}
        dietaryPreference={filters.dietaryPreference}
        onSmokingChange={handlers.onSmokingPreferenceChange}
        onDrinkingChange={handlers.onDrinkingPreferenceChange}
        onCannabisChange={handlers.onCannabisPreferenceChange}
        onWorkoutChange={handlers.onWorkoutPreferenceChange}
        onDietaryChange={handlers.onDietaryPreferenceChange}
        styles={{
          section: { marginBottom: 24 },
          sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 16, color: "#333" },
          fieldContainer: { marginBottom: 16 },
        }}
      />

      {/* Premium Filters */}
      <PremiumFiltersSection
        useWeightFilter={filters.useWeightFilter}
        weightRange={[filters.weightRangeMin, filters.weightRangeMax]}
        weightStrict={filters.weightStrict}
        onUseWeightFilterChange={handlers.onUseWeightFilterChange}
        onWeightRangeChange={(min, max) => {
          handlers.onWeightRangeMinChange(min);
          handlers.onWeightRangeMaxChange(max);
        }}
        onWeightStrictChange={handlers.onWeightStrictChange}
        useIncomeFilter={filters.useIncomeFilter}
        incomeRangeMinInput={filters.incomeRangeMinInput}
        incomeStrict={filters.incomeStrict}
        onUseIncomeFilterChange={handlers.onUseIncomeFilterChange}
        onIncomeRangeMinInputChange={handlers.onIncomeRangeMinInputChange}
        onIncomeStrictChange={handlers.onIncomeStrictChange}
        useHeightFilter={filters.useHeightFilter}
        heightRange={[filters.heightRangeMin, filters.heightRangeMax]}
        heightStrict={filters.heightStrict}
        onUseHeightFilterChange={handlers.onUseHeightFilterChange}
        onHeightRangeChange={(min, max) => {
          handlers.onHeightRangeMinChange(min);
          handlers.onHeightRangeMaxChange(max);
        }}
        onHeightStrictChange={handlers.onHeightStrictChange}
        isMetric={filters.isMetric}
        showOptionalNote={true}
        showSwitches={true}
        styles={{
          section: { marginBottom: 24 },
          sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 8, color: "#333" },
          filterContainer: { marginBottom: 16 },
          switchContainer: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
          switchLabel: { fontSize: 14, fontWeight: "600", marginLeft: 8 },
          optionalNote: { fontSize: 12, color: "#666666", marginBottom: 12, fontStyle: "italic" },
        }}
      />

      <View style={styles.row}>
        <Button
          title="Back"
          variant="outline"
          onPress={() => onStepChange("birthinfo")}
        />
        <Button
          title={config.savingBasic ? 'Saving…' : 'Continue'}
          disabled={config.savingBasic}
          onPress={handleContinue}
        />
      </View>
    </View>
  );
};
