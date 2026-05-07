import { supabase } from "@/data/supabaseClient";
import { profilesRepo } from "@/data/repos/profilesRepo";
import { Result, UserProfile } from "@/src/types";

/**
 * Update basic profile information during onboarding
 */
export async function updateBasicInfo(
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
  try {
    // Ensure profile exists before updating (first-time users). Include email when available.
    const { data: authData } = await supabase.auth.getUser();
    const email = authData?.user?.email ?? undefined;
    
    // First ensure profile exists and wait for it to complete
    const ensureResult = await profilesRepo.ensureProfile(userId, email);
    if (!ensureResult.success) {
      return {
        success: false,
        error: new Error(ensureResult.error?.message || "Failed to create profile. Please try again.")
      };
    }
    
    // Verify profile exists before updating
    if (!ensureResult.data) {
      return {
        success: false,
        error: new Error("Profile was not created properly. Please try again.")
      };
    }
    
    // Now update the profile
    const result = await profilesRepo.updateProfile(userId, basicInfo);
    return result;
  } catch (error: any) {
    // Handle PostgREST errors
    const errorMessage = error?.message || error?.details || error?.code || "Failed to save information";
    return { 
      success: false, 
      error: new Error(errorMessage) 
    };
  }
}

