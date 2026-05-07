import { Result } from "@/src/types";
import { getOnboardingProgress } from "../progress/progressChecker";

/**
 * Check if user can access matches (profile is complete)
 */
export async function canAccessMatches(userId: string): Promise<Result<boolean>> {
  try {
    const progressResult = await getOnboardingProgress(userId);
    if (!progressResult.success) {
      return progressResult;
    }

    return { success: true, data: progressResult.data.isProfileComplete };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

