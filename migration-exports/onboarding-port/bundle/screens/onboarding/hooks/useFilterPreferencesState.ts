import { useState, useEffect } from "react";
import { isMetricCountry, milesToKm, lbsToKg, inchesToCm } from "@/shared/utils/metricHelpers";

export interface FilterPreferencesState {
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
}

interface UseFilterPreferencesStateProps {
  userLocation?: string;
  userGender?: string;
  birthDate?: string;
}

export const useFilterPreferencesState = ({
  userLocation,
  userGender,
  birthDate,
}: UseFilterPreferencesStateProps = {}) => {
  const [distanceRangeMin, setDistanceRangeMin] = useState(1);
  const [distanceRangeMax, setDistanceRangeMax] = useState(10);
  const [ageRangeMin, setAgeRangeMin] = useState(18);
  const [ageRangeMax, setAgeRangeMax] = useState(100);
  const [genderPreference, setGenderPreference] = useState<string[]>([]);
  const [smokingPreference, setSmokingPreference] = useState<string>("any");
  const [drinkingPreference, setDrinkingPreference] = useState<string>("any");
  const [cannabisPreference, setCannabisPreference] = useState<string>("any");
  const [workoutPreference, setWorkoutPreference] = useState<string>("any");
  const [dietaryPreference, setDietaryPreference] = useState<string>("any");
  const [useWeightFilter, setUseWeightFilter] = useState(false);
  const [useIncomeFilter, setUseIncomeFilter] = useState(false);
  const [useHeightFilter, setUseHeightFilter] = useState(false);
  const [weightRangeMin, setWeightRangeMin] = useState(100);
  const [weightRangeMax, setWeightRangeMax] = useState(200);
  const [incomeRangeMinInput, setIncomeRangeMinInput] = useState("0");
  const [heightRangeMin, setHeightRangeMin] = useState(60);
  const [heightRangeMax, setHeightRangeMax] = useState(84);
  const [weightStrict, setWeightStrict] = useState(false);
  const [incomeStrict, setIncomeStrict] = useState(false);
  const [heightStrict, setHeightStrict] = useState(false);
  const [isMetric, setIsMetric] = useState(userLocation ? isMetricCountry(userLocation) : true);

  // Calculate age range defaults when birthDate changes
  useEffect(() => {
    if (birthDate && /^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
      const [year, month, day] = birthDate.split('-').map(Number);
      const birthDateObj = new Date(year, month - 1, day);
      const today = new Date();
      let age = today.getFullYear() - birthDateObj.getFullYear();
      const monthDiff = today.getMonth() - birthDateObj.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
      }
      const minAge = Math.max(18, Math.floor(age / 2) + 7);
      const maxAge = Math.min(100, age + 15);
      if (ageRangeMin === 18 && ageRangeMax === 100) {
        setAgeRangeMin(minAge);
        setAgeRangeMax(maxAge);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [birthDate]);

  // Set gender preference default when gender is set
  useEffect(() => {
    if (userGender && genderPreference.length === 0) {
      if (userGender === "man") {
        setGenderPreference(["women"]);
      } else if (userGender === "woman") {
        setGenderPreference(["men"]);
      } else {
        setGenderPreference(["men", "women", "non-binary"]);
      }
    }
  }, [userGender, genderPreference.length]);

  // Update metric when location changes
  useEffect(() => {
    if (userLocation) {
      setIsMetric(isMetricCountry(userLocation));
    }
  }, [userLocation]);

  const state: FilterPreferencesState = {
    distanceRangeMin,
    distanceRangeMax,
    ageRangeMin,
    ageRangeMax,
    genderPreference,
    smokingPreference,
    drinkingPreference,
    cannabisPreference,
    workoutPreference,
    dietaryPreference,
    useWeightFilter,
    useIncomeFilter,
    useHeightFilter,
    weightRangeMin,
    weightRangeMax,
    incomeRangeMinInput,
    heightRangeMin,
    heightRangeMax,
    weightStrict,
    incomeStrict,
    heightStrict,
    isMetric,
  };

  return {
    state,
    setters: {
      setDistanceRangeMin,
      setDistanceRangeMax,
      setAgeRangeMin,
      setAgeRangeMax,
      setGenderPreference,
      setSmokingPreference,
      setDrinkingPreference,
      setCannabisPreference,
      setWorkoutPreference,
      setDietaryPreference,
      setUseWeightFilter,
      setUseIncomeFilter,
      setUseHeightFilter,
      setWeightRangeMin,
      setWeightRangeMax,
      setIncomeRangeMinInput,
      setHeightRangeMin,
      setHeightRangeMax,
      setWeightStrict,
      setIncomeStrict,
      setHeightStrict,
      setIsMetric,
    },
  };
};

