import { Result, OnboardingProgress, UserProfile, TraitScores } from "@/src/types";
import { profilesRepo } from "@/data/repos/profilesRepo";
import { traitsRepo } from "@/data/repos/traitsRepo";
import { checkBasicInfoCompleted, checkAdditionalInfoCompleted, checkAvailabilityCompleted } from "./basicInfoChecker";
import { checkAttachmentTestCompleted, checkBigFiveTestCompleted, checkSpiralDynamicsTestCompleted, checkHumanDesignCompleted } from "./typologyChecker";
import { checkLifeDomainsCompleted } from "./lifeDomainChecker";
import { isProfileComplete } from "./profileCompletenessChecker";

/**
 * Get onboarding progress for a user
 */
export async function getOnboardingProgress(
  userId: string
): Promise<Result<OnboardingProgress>> {
  try {
    // Get profile completeness
    const profileResult = await profilesRepo.getProfile(userId);
    if (!profileResult.success) {
      return profileResult;
    }

    const profile = profileResult.data;

    // Check basic info completion
    const basicInfoCompleted = checkBasicInfoCompleted(profile);
    const additionalInfoCompleted = checkAdditionalInfoCompleted(profile);
    const availabilityCompleted = checkAvailabilityCompleted(profile);

    // Get trait scores completeness
    const traitsResult = await traitsRepo.getTraitScores(userId);
    if (!traitsResult.success) {
      return traitsResult;
    }

    const traits = traitsResult.data;

    // Check individual test completions
    const attachmentTestCompleted = checkAttachmentTestCompleted(traits);
    const bigFiveTestCompleted = checkBigFiveTestCompleted(traits);
    const spiralDynamicsTestCompleted = checkSpiralDynamicsTestCompleted(traits);
    const humanDesignCompleted = checkHumanDesignCompleted(traits);

    // Check life domains
    const lifeDomainsCompleted = checkLifeDomainsCompleted(profile);

    // Check overall profile completeness
    const profileComplete = isProfileComplete(profile);

    const progress: OnboardingProgress = {
      userId,
      basicInfoCompleted,
      additionalInfoCompleted,
      availabilityCompleted,
      attachmentTestCompleted,
      bigFiveTestCompleted,
      spiralDynamicsTestCompleted,
      humanDesignCompleted,
      lifeDomainsCompleted,
      isProfileComplete: profileComplete,
      updatedAt: new Date().toISOString(),
    };

    return { success: true, data: progress };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

