import { supabase } from '@/data/supabaseClient';
import { Result } from '@/src/types';
import { OnboardingProgress, OnboardingData } from '../types';
import { profilesRepo } from '@/data/repos/profilesRepo';

class ModalOnboardingService {
  /**
   * Get saved onboarding progress for a user
   */
  async getProgress(userId: string): Promise<Result<OnboardingProgress>> {
    try {
      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        return { success: false, error: error as Error };
      }

      if (!data) {
        return {
          success: true,
          data: {
            currentStep: 'welcome',
            completedSteps: [],
            onboardingData: {},
          },
        };
      }

      return {
        success: true,
        data: {
          currentStep: data.current_step,
          completedSteps: data.completed_steps || [],
          onboardingData: (data.onboarding_data as OnboardingData) || {},
        },
      };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * Save onboarding progress
   */
  async saveProgress(
    userId: string,
    progress: { currentStep: string; onboardingData: OnboardingData }
  ): Promise<Result<void>> {
    try {
      const completedSteps = Object.keys(progress.onboardingData).filter(
        key => progress.onboardingData[key as keyof OnboardingData] !== undefined &&
               progress.onboardingData[key as keyof OnboardingData] !== null &&
               progress.onboardingData[key as keyof OnboardingData] !== ''
      );

      const { error } = await supabase
        .from('onboarding_progress')
        .upsert({
          user_id: userId,
          current_step: progress.currentStep,
          completed_steps: completedSteps,
          onboarding_data: progress.onboardingData,
        }, {
          onConflict: 'user_id',
        });

      if (error) {
        return { success: false, error: error as Error };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * Complete onboarding and save all data to profile
   */
  async completeOnboarding(userId: string, data: OnboardingData): Promise<Result<void>> {
    try {
      // Map onboarding data to profile fields
      const profileUpdates: any = {};

      if (data.name) profileUpdates.displayName = data.name;
      if (data.birthPlace) profileUpdates.birthLocation = data.birthPlace;
      if (data.birthDate) profileUpdates.birthDate = data.birthDate;
      if (data.birthTime) profileUpdates.birthTime = data.birthTime;
      if (data.gender) profileUpdates.gender = data.gender;
      if (data.attractedTo && data.attractedTo.length > 0) {
        profileUpdates.attractedTo = data.attractedTo;
      }
      if (data.relationshipStyle) profileUpdates.relationshipStyle = data.relationshipStyle;
      if (data.location) profileUpdates.location = data.location;
      if (data.availability && data.availability.length > 0) {
        profileUpdates.availability = data.availability;
      }
      if (data.contactPreference) profileUpdates.contactPreference = data.contactPreference;
      if (data.phoneNumber) profileUpdates.phoneNumber = data.phoneNumber;
      if (data.photos && data.photos.length > 0) {
        profileUpdates.photos = data.photos;
      }
      if (data.bio) profileUpdates.bio = data.bio;

      // Update profile
      const updateResult = await profilesRepo.updateProfile(userId, profileUpdates);
      if (!updateResult.success) {
        return updateResult;
      }

      // Mark onboarding as complete by deleting progress record
      const { error } = await supabase
        .from('onboarding_progress')
        .delete()
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting onboarding progress:', error);
        // Don't fail if deletion fails
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }

  /**
   * Check if user has completed modal-based onboarding
   */
  async isComplete(userId: string): Promise<Result<boolean>> {
    try {
      const { data, error } = await supabase
        .from('onboarding_progress')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        return { success: false, error: error as Error };
      }

      // If no record exists, onboarding is complete
      return { success: true, data: !data };
    } catch (error) {
      return { success: false, error: error as Error };
    }
  }
}

export const modalOnboardingService = new ModalOnboardingService();

