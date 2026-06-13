import React, { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DatingProfileStackParamList } from '@app/navigation/DatingProfileOnboardingNavigator';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { exitDatingProfileOnboardingToPostInterview } from '@/datingProfile/onboarding/exitDatingProfileOnboardingToPostInterview';
import { ModalOnboardingFlow } from './ModalOnboardingFlow';

export const ModalOnboardingScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<DatingProfileStackParamList>>();
  const { user } = useAuth();

  const handleComplete = () => {
    navigation.replace('DatingProfileBuilder');
  };

  const handleExitToPostInterview = useCallback(() => {
    exitDatingProfileOnboardingToPostInterview(navigation, user?.id);
  }, [navigation, user?.id]);

  return (
    <ModalOnboardingFlow
      onComplete={handleComplete}
      onExitToPostInterview={handleExitToPostInterview}
    />
  );
};

