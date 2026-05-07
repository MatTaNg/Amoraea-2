import { profilesRepo } from "@/data/repos/profilesRepo";
import { Result, UserProfile } from "@/src/types";

/**
 * Update availability and contact information
 */
export async function updateAvailability(
  userId: string,
  availabilityInfo: {
    phoneNumber: string;
    contactPreference: UserProfile["contactPreference"];
  }
): Promise<Result<UserProfile>> {
  try {
    // Update the profile with availability information
    const result = await profilesRepo.updateProfile(userId, availabilityInfo);
    return result;
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

