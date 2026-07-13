import { UserProfile } from "@/src/types";
import { checkBasicInfoCompleted } from "./basicInfoChecker";
import { checkAvailabilityCompleted } from "./basicInfoChecker";
import { checkLifeDomainsCompleted } from "./lifeDomainChecker";

/**
 * Check if profile has birth info
 */
export function hasBirthInfo(profile: UserProfile | null): boolean {
  return !!(
    profile?.birthDate &&
    profile?.birthTime &&
    profile?.birthLocation
  );
}

/**
 * Check if profile has filters
 */
export function hasFilters(profile: UserProfile | null): boolean {
  return !!(
    profile?.matchPreferences?.distanceRange &&
    profile?.matchPreferences?.ageRange &&
    profile?.matchPreferences?.genderPreference
  );
}

/**
 * Check if profile has photos
 */
export function hasPhotos(profile: UserProfile | null): boolean {
  return !!(profile?.photos && profile.photos.length > 0);
}

/**
 * Check if profile is complete for matching
 */
export function isProfileComplete(profile: UserProfile | null): boolean {
  return (
    checkBasicInfoCompleted(profile) &&
    hasBirthInfo(profile) &&
    hasFilters(profile) &&
    checkLifeDomainsCompleted(profile) &&
    hasPhotos(profile) &&
    checkAvailabilityCompleted(profile)
  );
}

