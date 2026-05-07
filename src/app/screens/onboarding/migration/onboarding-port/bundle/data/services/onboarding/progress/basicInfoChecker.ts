import { UserProfile } from "@/src/types";

/**
 * Check if basic info is completed
 * Note: occupation is optional
 */
export function checkBasicInfoCompleted(profile: UserProfile | null): boolean {
  return !!(
    profile?.displayName &&
    profile?.gender &&
    profile?.relationshipStyle &&
    profile?.location
  );
}

/**
 * Check if additional info is completed (optional, so any field filled counts)
 */
export function checkAdditionalInfoCompleted(profile: UserProfile | null): boolean {
  return !!(
    profile?.height ||
    profile?.weight ||
    profile?.yearlyIncome ||
    profile?.drinking ||
    profile?.smoking ||
    profile?.cannabis ||
    profile?.workout ||
    profile?.diet ||
    profile?.sleepSchedule
  );
}

/**
 * Check if availability is completed
 */
export function checkAvailabilityCompleted(profile: UserProfile | null): boolean {
  return !!(
    profile?.phoneNumber && profile?.contactPreference
  );
}

