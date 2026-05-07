import { useCallback } from "react";
import { isMetricCountry, lbsToKg, kgToLbs, inchesToCm, cmToInches, milesToKm, kmToMiles } from "@/shared/utils/metricHelpers";

interface UseLocationConversionProps {
  isMetric: boolean;
  weightRangeMin: number;
  weightRangeMax: number;
  heightRangeMin: number;
  heightRangeMax: number;
  distanceRangeMin: number;
  distanceRangeMax: number;
  onMetricChange: (isMetric: boolean) => void;
  onWeightRangeMinChange: (value: number) => void;
  onWeightRangeMaxChange: (value: number) => void;
  onHeightRangeMinChange: (value: number) => void;
  onHeightRangeMaxChange: (value: number) => void;
  onDistanceRangeMinChange: (value: number) => void;
  onDistanceRangeMaxChange: (value: number) => void;
}

/**
 * Hook to handle metric conversion when location changes
 * Automatically converts weight, height, and distance ranges based on location
 */
export const useLocationConversion = ({
  isMetric,
  weightRangeMin,
  weightRangeMax,
  heightRangeMin,
  heightRangeMax,
  distanceRangeMin,
  distanceRangeMax,
  onMetricChange,
  onWeightRangeMinChange,
  onWeightRangeMaxChange,
  onHeightRangeMinChange,
  onHeightRangeMaxChange,
  onDistanceRangeMinChange,
  onDistanceRangeMaxChange,
}: UseLocationConversionProps) => {
  /**
   * Converts all metric values when location changes
   * @param newLocation - The new location string
   * @param convertDistance - Whether to also convert distance range (default: true)
   */
  const handleLocationChange = useCallback((newLocation: string, convertDistance: boolean = true) => {
    const newIsMetric = isMetricCountry(newLocation);
    const wasMetric = isMetric;

    // Only convert if metric status changed
    if (newIsMetric !== wasMetric) {
      if (newIsMetric) {
        // Converting from imperial to metric
        onWeightRangeMinChange(lbsToKg(weightRangeMin));
        onWeightRangeMaxChange(lbsToKg(weightRangeMax));
        onHeightRangeMinChange(inchesToCm(heightRangeMin));
        onHeightRangeMaxChange(inchesToCm(heightRangeMax));
        if (convertDistance) {
          onDistanceRangeMinChange(milesToKm(distanceRangeMin));
          onDistanceRangeMaxChange(milesToKm(distanceRangeMax));
        }
      } else {
        // Converting from metric to imperial
        onWeightRangeMinChange(kgToLbs(weightRangeMin));
        onWeightRangeMaxChange(kgToLbs(weightRangeMax));
        onHeightRangeMinChange(cmToInches(heightRangeMin));
        onHeightRangeMaxChange(cmToInches(heightRangeMax));
        if (convertDistance) {
          onDistanceRangeMinChange(kmToMiles(distanceRangeMin));
          onDistanceRangeMaxChange(kmToMiles(distanceRangeMax));
        }
      }
    }
    onMetricChange(newIsMetric);
  }, [
    isMetric,
    weightRangeMin,
    weightRangeMax,
    heightRangeMin,
    heightRangeMax,
    distanceRangeMin,
    distanceRangeMax,
    onMetricChange,
    onWeightRangeMinChange,
    onWeightRangeMaxChange,
    onHeightRangeMinChange,
    onHeightRangeMaxChange,
    onDistanceRangeMinChange,
    onDistanceRangeMaxChange,
  ]);

  return {
    handleLocationChange,
  };
};

