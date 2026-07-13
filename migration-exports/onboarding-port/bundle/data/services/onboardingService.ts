import { UserProfile, TraitScores, Result, OnboardingProgress } from "@/src/types";
import { getOnboardingProgress } from "./onboarding/progress/progressChecker";
import { updateBasicInfo } from "./onboarding/updates/basicInfoUpdate";
import { updateAvailability } from "./onboarding/updates/availabilityUpdate";
import { updateTraitScores } from "./onboarding/updates/traitUpdate";
import { getNextOnboardingStep } from "./onboarding/navigation/nextStepDeterminer";
import { canAccessMatches } from "./onboarding/navigation/accessChecker";
import { getEstimatedTimeForStep } from "./onboarding/metadata/timeEstimates";
import { getStepGuidance } from "./onboarding/metadata/stepGuidance";

/**
 * Service for managing the onboarding process
 */
export class OnboardingService {
  /**
   * Check if a user has completed the required onboarding steps
   */
  async getOnboardingProgress(userId: string): Promise<Result<OnboardingProgress>> {
    return getOnboardingProgress(userId);
  }

  /**
   * Update basic profile information during onboarding
   */
  async updateBasicInfo(
    userId: string,
    basicInfo: {
      displayName: string;
      gender: UserProfile["gender"];
      attractedTo: UserProfile["attractedTo"];
      relationshipStyle: UserProfile["relationshipStyle"];
      location?: string;
      occupation?: string;
      bio?: string;
      phoneNumber?: string;
      contactPreference?: UserProfile["contactPreference"];
    }
  ): Promise<Result<UserProfile>> {
    return updateBasicInfo(userId, basicInfo);
  }

  /**
   * Update availability and contact information
   */
  async updateAvailability(
    userId: string,
    availabilityInfo: {
      phoneNumber: string;
      contactPreference: UserProfile["contactPreference"];
    }
  ): Promise<Result<UserProfile>> {
    return updateAvailability(userId, availabilityInfo);
  }

  /**
   * Update trait scores from completed assessments
   */
  async updateTraitScores(
    userId: string,
    traitUpdates: Partial<Omit<TraitScores, "userId" | "updatedAt">>
  ): Promise<Result<TraitScores>> {
    return updateTraitScores(userId, traitUpdates);
  }

  /**
   * Get the next required onboarding step for a user
   */
  async getNextOnboardingStep(userId: string): Promise<Result<string | null>> {
    return getNextOnboardingStep(userId);
  }

  /**
   * Check if user can access matches (profile is complete)
   */
  async canAccessMatches(userId: string): Promise<Result<boolean>> {
    return canAccessMatches(userId);
  }

  /**
   * Get estimated time for remaining onboarding steps
   */
  getEstimatedTimeForStep(step: string): number {
    return getEstimatedTimeForStep(step);
  }

  /**
   * Get guidance text for onboarding steps
   */
  getStepGuidance(step: string): string {
    return getStepGuidance(step);
  }
}

export const onboardingService = new OnboardingService();
