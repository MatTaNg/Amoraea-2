export function isMetricCountry(_countryCode?: string): boolean {
  return false;
}

export function lbsToKg(lbs: number): number {
  return Math.round(lbs * 0.453592 * 10) / 10;
}
export function kgToLbs(kg: number): number {
  return Math.round((kg / 0.453592) * 10) / 10;
}
export function inchesToCm(inches: number): number {
  return Math.round(inches * 2.54 * 10) / 10;
}
export function cmToInches(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}
export function milesToKm(mi: number): number {
  return Math.round(mi * 1.60934 * 10) / 10;
}
export function kmToMiles(km: number): number {
  return Math.round((km / 1.60934) * 10) / 10;
}
