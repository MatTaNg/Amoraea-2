import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ProfileRepository } from '@data/repositories/ProfileRepository';
import { OnboardingUseCase } from '@domain/useCases/OnboardingUseCase';
import { AsyncStorageService } from '@utilities/storage/AsyncStorageService';
import { OnboardingState, ONBOARDING_STEPS, TOTAL_ONBOARDING_STEPS } from '@domain/models/OnboardingState';
import { Profile } from '@domain/models/Profile';

const profileRepository = new ProfileRepository();
const storageService = new AsyncStorageService();
const onboardingUseCase = new OnboardingUseCase(profileRepository, storageService);

export const useOnboarding = (userId: string | undefined) => {
  const queryClient = useQueryClient();
  const [localState, setLocalState] = useState<OnboardingState>({
    step: 1,
    name: null,
    age: null,
    gender: null,
    attractedTo: null,
    heightCentimeters: null,
    occupation: null,
    location: null,
    photoUris: [],
  });

  const { data: profile } = useQuery<Profile | null>({
    queryKey: ['profile', userId],
    queryFn: () => (userId ? profileRepository.getProfile(userId) : Promise.resolve(null)),
    enabled: !!userId,
  });

  useEffect(() => {
    const loadState = async () => {
      if (profile) {
        setLocalState({
          step: profile.onboardingStep || 1,
          name: profile.name,
          age: profile.age,
          gender: profile.gender,
          attractedTo: profile.attractedTo,
          heightCentimeters: profile.heightCentimeters,
          occupation: profile.occupation,
          location: profile.location,
          photoUris: [],
        });
      } else {
        const savedState = await storageService.getOnboardingState();
        if (savedState) {
          setLocalState(savedState);
        }
      }
    };
    loadState();
  }, [profile]);

  const updateStep = useMutation({
    mutationFn: async ({ step, update }: { step: number; update: Partial<OnboardingState> }) => {
      if (!userId) throw new Error('User not authenticated');
      const newState = { ...localState, ...update, step };
      await onboardingUseCase.saveOnboardingStep(userId, newState, update as any);
      setLocalState(newState);
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });

  const completeOnboarding = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('User not authenticated');
      await onboardingUseCase.completeOnboarding(userId, localState);
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
    },
  });

  return {
    state: localState,
    updateStep: updateStep.mutateAsync,
    completeOnboarding: completeOnboarding.mutateAsync,
    isLoading: updateStep.isPending || completeOnboarding.isPending,
    currentStep: localState.step,
    totalSteps: TOTAL_ONBOARDING_STEPS,
    canGoBack: localState.step > 1,
  };
};

