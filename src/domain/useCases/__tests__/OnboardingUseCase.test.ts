jest.mock('@data/supabase/client', () => ({
  supabase: {},
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { OnboardingUseCase } from '../OnboardingUseCase';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { AsyncStorageService } from '@utilities/storage/AsyncStorageService';
import { OnboardingState } from '@domain/models/OnboardingState';

jest.mock('@data/repositories/ProfileRepository');
jest.mock('@utilities/storage/AsyncStorageService');

describe('OnboardingUseCase', () => {
  let useCase: OnboardingUseCase;
  let mockProfileRepository: jest.Mocked<ProfileRepository>;
  let mockStorageService: jest.Mocked<AsyncStorageService>;

  beforeEach(() => {
    mockProfileRepository = new ProfileRepository() as jest.Mocked<ProfileRepository>;
    mockStorageService = new AsyncStorageService() as jest.Mocked<AsyncStorageService>;
    useCase = new OnboardingUseCase(mockProfileRepository, mockStorageService);
  });

  describe('saveOnboardingStep', () => {
    it('should save locally and remotely successfully', async () => {
      const userId = 'test-user-id';
      const state: OnboardingState = {
        step: 2,
        name: 'Test User',
        age: null,
        gender: null,
        attractedTo: null,
        heightCentimeters: null,
        occupation: null,
        location: null,
        photoUris: [],
      };
      const update = { name: 'Test User', onboardingStep: 2 };

      mockProfileRepository.upsertProfile.mockResolvedValue({
        id: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        onboardingCompleted: false,
        onboardingStep: 2,
        name: 'Test User',
        age: null,
        gender: null,
        attractedTo: null,
        heightCentimeters: null,
        occupation: null,
        location: null,
        primaryPhotoUrl: null,
      });

      await useCase.saveOnboardingStep(userId, state, update);

      expect(mockStorageService.saveOnboardingState).toHaveBeenCalledWith(state);
      expect(mockProfileRepository.upsertProfile).toHaveBeenCalledWith(userId, {
        ...update,
        onboardingStep: 2,
      });
    });

    it('should add to retry queue if remote save fails', async () => {
      const userId = 'test-user-id';
      const state: OnboardingState = {
        step: 2,
        name: 'Test User',
        age: null,
        gender: null,
        attractedTo: null,
        heightCentimeters: null,
        occupation: null,
        location: null,
        photoUris: [],
      };
      const update = { name: 'Test User', onboardingStep: 2 };

      mockProfileRepository.upsertProfile.mockRejectedValue(new Error('Network error'));

      await expect(useCase.saveOnboardingStep(userId, state, update)).rejects.toThrow();

      expect(mockStorageService.saveOnboardingState).toHaveBeenCalledWith(state);
      expect(mockStorageService.addToRetryQueue).toHaveBeenCalled();
    });
  });

  describe('completeOnboarding', () => {
    it('should complete onboarding and clear local state', async () => {
      const userId = 'test-user-id';
      const state: OnboardingState = {
        step: 8,
        name: 'Test User',
        age: 25,
        gender: 'Man',
        attractedTo: ['Women'],
        heightCentimeters: 180,
        occupation: 'Developer',
        location: { latitude: 0, longitude: 0, label: 'Test Location' },
        photoUris: [],
      };

      mockProfileRepository.upsertProfile.mockResolvedValue({
        id: userId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        onboardingCompleted: true,
        onboardingStep: 8,
        name: 'Test User',
        age: 25,
        gender: 'Man',
        attractedTo: ['Women'],
        heightCentimeters: 180,
        occupation: 'Developer',
        location: { latitude: 0, longitude: 0, label: 'Test Location' },
        primaryPhotoUrl: null,
      });

      await useCase.completeOnboarding(userId, state);

      expect(mockStorageService.saveOnboardingState).toHaveBeenCalledWith(state);
      expect(mockProfileRepository.upsertProfile).toHaveBeenCalled();
      expect(mockStorageService.clearOnboardingState).toHaveBeenCalled();
    });

    it('queues retry when completeOnboarding remote save fails', async () => {
      const userId = 'test-user-id';
      const state: OnboardingState = {
        step: 8,
        name: 'Test User',
        age: 25,
        gender: 'Man',
        attractedTo: ['Women'],
        heightCentimeters: 180,
        occupation: 'Developer',
        location: null,
        photoUris: [],
      };
      mockProfileRepository.upsertProfile.mockRejectedValue(new Error('offline'));

      await expect(useCase.completeOnboarding(userId, state)).rejects.toThrow('offline');
      expect(mockStorageService.addToRetryQueue).toHaveBeenCalled();
      expect(mockStorageService.clearOnboardingState).not.toHaveBeenCalled();
    });
  });

  describe('retryFailedUpdates', () => {
    it('replays queued updates and removes successful items', async () => {
      mockStorageService.getRetryQueue.mockResolvedValue([
        {
          userId: 'u1',
          update: { name: 'Replay', onboardingStep: 2 },
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      ]);
      mockProfileRepository.upsertProfile.mockResolvedValue({} as never);

      await useCase.retryFailedUpdates();

      expect(mockProfileRepository.upsertProfile).toHaveBeenCalledWith('u1', {
        name: 'Replay',
        onboardingStep: 2,
      });
      expect(mockStorageService.removeRetryQueueItem).toHaveBeenCalledWith(0);
    });

    it('keeps queue items that still fail', async () => {
      mockStorageService.getRetryQueue.mockResolvedValue([
        {
          userId: 'u1',
          update: { name: 'Replay' },
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      ]);
      mockProfileRepository.upsertProfile.mockRejectedValue(new Error('still down'));

      await useCase.retryFailedUpdates();

      expect(mockStorageService.removeRetryQueueItem).not.toHaveBeenCalled();
    });
  });

  describe('getOnboardingState', () => {
    it('returns stored onboarding state', async () => {
      const state: OnboardingState = {
        step: 1,
        name: null,
        age: null,
        gender: null,
        attractedTo: null,
        heightCentimeters: null,
        occupation: null,
        location: null,
        photoUris: [],
      };
      mockStorageService.getOnboardingState.mockResolvedValue(state);
      await expect(useCase.getOnboardingState()).resolves.toEqual(state);
    });
  });
});

