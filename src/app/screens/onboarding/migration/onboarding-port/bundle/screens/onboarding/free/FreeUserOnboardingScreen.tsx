import React from 'react';
import { useRouter } from 'expo-router';
import { ModalOnboardingFlow } from './ModalOnboardingFlow';

export const ModalOnboardingScreen: React.FC = () => {
  const router = useRouter();

  const handleComplete = () => {
    // Redirect to main app
    router.replace('/(tabs)/likes-you');
  };

  return <ModalOnboardingFlow onComplete={handleComplete} />;
};

