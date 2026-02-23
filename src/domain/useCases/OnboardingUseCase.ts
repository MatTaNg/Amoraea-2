import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { AsyncStorageService } from '@utilities/storage/AsyncStorageService';
import { OnboardingState, ONBOARDING_STEPS } from '@domain/models/OnboardingState';
import { ProfileUpdate } from '@domain/models/Profile';

export class OnboardingUseCase {
  constructor(
    private profileRepository: ProfileRepository,
    private storageService: AsyncStorageService
  ) {}

  async saveOnboardingStep(
    userId: string,
    state: OnboardingState,
    update: Partial<ProfileUpdate>
  ): Promise<void> {
    // Save locally first
    await this.storageService.saveOnboardingState(state);

    // Attempt remote save
    try {
      await this.profileRepository.upsertProfile(userId, {
        ...update,
        onboardingStep: state.step,
      });
    } catch (error) {
      // If remote save fails, add to retry queue
      await this.storageService.addToRetryQueue({
        userId,
        update: {
          ...update,
          onboardingStep: state.step,
        },
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async completeOnboarding(userId: string, state: OnboardingState): Promise<void> {
    const update: ProfileUpdate = {
      name: state.name || undefined,
      age: state.age || undefined,
      gender: state.gender || undefined,
      attractedTo: state.attractedTo || undefined,
      heightCentimeters: state.heightCentimeters || undefined,
      occupation: state.occupation || undefined,
      location: state.location || undefined,
      onboardingStep: ONBOARDING_STEPS.PHOTOS,
      onboardingCompleted: true,
    };

    // Save locally
    await this.storageService.saveOnboardingState(state);

    // Attempt remote save
    try {
      await this.profileRepository.upsertProfile(userId, update);
      await this.storageService.clearOnboardingState();
    } catch (error) {
      await this.storageService.addToRetryQueue({
        userId,
        update,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  async getOnboardingState(): Promise<OnboardingState | null> {
    return this.storageService.getOnboardingState();
  }

  async retryFailedUpdates(): Promise<void> {
    const queue = await this.storageService.getRetryQueue();
    const profileRepository = this.profileRepository;

    for (let i = queue.length - 1; i >= 0; i--) {
      const item = queue[i];
      try {
        await profileRepository.upsertProfile(item.userId, item.update as ProfileUpdate);
        await this.storageService.removeRetryQueueItem(i);
      } catch (error) {
        // Keep in queue for next retry
      }
    }
  }
}

