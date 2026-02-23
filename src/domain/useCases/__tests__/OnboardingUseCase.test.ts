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
  });
});

