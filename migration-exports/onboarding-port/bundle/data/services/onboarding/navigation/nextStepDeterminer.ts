import { Result } from "@/src/types";
import { profilesRepo } from "@/data/repos/profilesRepo";
import { getOnboardingProgress } from "../progress/progressChecker";
import { hasBirthInfo, hasFilters, hasPhotos } from "../progress/profileCompletenessChecker";
import { checkLifeDomainsCompleted } from "../progress/lifeDomainChecker";

/**
 * Get the next required onboarding step for a user
 */
export async function getNextOnboardingStep(userId: string): Promise<Result<string | null>> {
  try {
    const progressResult = await getOnboardingProgress(userId);
    if (!progressResult.success) {
      return progressResult;
    }

    const progress = progressResult.data;

    // Required steps for simplified onboarding
    if (!progress.basicInfoCompleted) {
      return { success: true, data: "basic-info" };
    }

    if (!progress.availabilityCompleted) {
      return { success: true, data: "basic-info" }; // Availability is part of basic info now
    }

    // Check for birth info (required for typologies)
    const profileResult = await profilesRepo.getProfile(userId);
    if (profileResult.success && profileResult.data) {
      const profile = profileResult.data;
      
      if (!hasBirthInfo(profile)) {
        return { success: true, data: "birth-info" };
      }

      // Check for filters
      if (!hasFilters(profile)) {
        return { success: true, data: "filters" };
      }

      // Check for life domains
      if (!checkLifeDomainsCompleted(profile)) {
        return { success: true, data: "life-domains" };
      }

      // Check for photos
      if (!hasPhotos(profile)) {
        return { success: true, data: "photos" };
      }
    }

    // All required steps completed - onboarding is done
    return { success: true, data: null };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

