/**
 * Hook for managing AdditionalInfoScreen form state
 */

import { useState } from 'react';
import { Platform } from 'react-native';
import { HabitLevel, SleepSchedule } from '../constants/additionalInfoConstants';

export interface AdditionalInfoFormState {
  height: string;
  heightUnit: 'ft' | 'cm';
  weight: string;
  weightUnit: 'lbs' | 'kg';
  yearlyIncome: string;
  yearlyIncomeCurrency: string;
  drinking: HabitLevel;
  smoking: HabitLevel;
  cannabis: HabitLevel;
  workout: HabitLevel;
  diet: string;
  sleepSchedule: SleepSchedule;
}

export interface AdditionalInfoFormData {
  height?: string;
  weight?: string;
  yearlyIncome?: string;
  yearlyIncomeCurrency?: string; // Optional now, kept for backward compatibility
  drinking: HabitLevel;
  smoking: HabitLevel;
  cannabis: HabitLevel;
  workout: HabitLevel;
  diet?: string;
  sleepSchedule: SleepSchedule;
}

export const useAdditionalInfoForm = () => {
  const [loading, setLoading] = useState(false);
  const [formState, setFormState] = useState<AdditionalInfoFormState>({
    height: '',
    heightUnit: Platform.OS === 'ios' ? 'ft' : 'cm',
    weight: '',
    weightUnit: Platform.OS === 'ios' ? 'lbs' : 'kg',
    yearlyIncome: '',
    yearlyIncomeCurrency: 'USD',
    drinking: 'never',
    smoking: 'never',
    cannabis: 'never',
    workout: 'never',
    diet: '',
    sleepSchedule: 'early-bird',
  });

  const updateField = <K extends keyof AdditionalInfoFormState>(
    field: K,
    value: AdditionalInfoFormState[K]
  ) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const getFormData = (): AdditionalInfoFormData => {
    // Height is now stored in the format from HeightSlider (e.g., "5'10"" or "178 cm")
    // If it's still in the old format (just a number), convert it
    let heightValue = formState.height;
    if (heightValue && !heightValue.includes("'") && !heightValue.includes('cm')) {
      // Old format: separate value and unit - convert to HeightSlider format
      if (formState.heightUnit === 'cm') {
        heightValue = `${formState.height} cm`;
      } else {
        // For feet, we need to parse the number - assume it's inches or feet
        // This is a fallback for old data
        const numValue = parseInt(formState.height, 10);
        if (numValue < 12) {
          // Probably feet, convert to feet/inches format
          heightValue = `${numValue}'0"`;
        } else {
          // Probably inches, convert to feet/inches
          const feet = Math.floor(numValue / 12);
          const inches = numValue % 12;
          heightValue = `${feet}'${inches}"`;
        }
      }
    }
    
    // Weight is now stored in the format from WeightInput (e.g., "150 lbs" or "68 kg")
    // If it's still in the old format (just a number), convert it
    let weightValue = formState.weight;
    if (weightValue && !weightValue.includes('kg') && !weightValue.includes('lbs')) {
      // Old format: separate value and unit - convert to WeightInput format
      weightValue = `${formState.weight} ${formState.weightUnit}`;
    }
    
    return {
      height: heightValue || undefined,
      weight: weightValue || undefined,
      yearlyIncome: formState.yearlyIncome || undefined,
      yearlyIncomeCurrency: formState.yearlyIncomeCurrency || undefined, // Optional now
      drinking: formState.drinking,
      smoking: formState.smoking,
      cannabis: formState.cannabis,
      workout: formState.workout,
      diet: formState.diet || undefined,
      sleepSchedule: formState.sleepSchedule,
    };
  };

  return {
    loading,
    setLoading,
    formState,
    updateField,
    getFormData,
  };
};

