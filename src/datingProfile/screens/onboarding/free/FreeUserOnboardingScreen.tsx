import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { ModalOnboardingFlow } from './ModalOnboardingFlow';

export const ModalOnboardingScreen: React.FC = () => {
  const navigation = useNavigation();

  const handleComplete = () => {
    // Redirect to main app
    navigation.getParent()?.navigate('DatingProfileEdit' as never, { userId: user?.id } as never);
  };

  return <ModalOnboardingFlow onComplete={handleComplete} />;
};

