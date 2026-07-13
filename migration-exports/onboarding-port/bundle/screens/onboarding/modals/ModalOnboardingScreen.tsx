import React from 'react';
import { useRouter } from 'expo-router';
import { ModalOnboardingFlow } from './ModalOnboardingFlow';

export const ModalOnboardingScreen: React.FC = () => {
  const router = useRouter();

  const handleComplete = async () => {
    // Wait a moment for profile updates to be saved
    await new Promise(resolve => setTimeout(resolve, 500));
    // Redirect to Break screen before psychometric assessments
    router.replace('/onboarding/break');
  };

  return <ModalOnboardingFlow onComplete={handleComplete} />;
};

