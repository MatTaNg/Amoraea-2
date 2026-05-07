import React, { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DatingProfileStackParamList } from '@app/navigation/DatingProfileOnboardingNavigator';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { ModalOnboardingFlow } from './ModalOnboardingFlow';

type InterviewStackNavigation = NativeStackNavigationProp<
  {
    PostInterviewPassed: { userId: string };
    DatingProfileOnboarding: { userId?: string };
  },
  'DatingProfileOnboarding'
>;

export const ModalOnboardingScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<DatingProfileStackParamList>>();
  const { user } = useAuth();

  const handleComplete = () => {
    navigation.replace('DatingBreak');
  };

  const handleExitToPostInterview = useCallback(() => {
    const uid = user?.id;
    /** DatingModals → nested stack → interview stack: pop `DatingProfileOnboarding` instead of pushing another `PostInterviewPassed` (fixes web flame / stack glitches). */
    const nestedNav = navigation.getParent();
    const interviewNav = nestedNav?.getParent?.() as InterviewStackNavigation | undefined;
    if (interviewNav?.canGoBack?.()) {
      interviewNav.goBack();
      return;
    }
    if (nestedNav?.canGoBack?.()) {
      nestedNav.goBack();
      return;
    }
    if (!uid) return;
    if (nestedNav?.navigate) {
      nestedNav.navigate('PostInterviewPassed', { userId: uid });
      return;
    }
    (navigation as unknown as InterviewStackNavigation).navigate('PostInterviewPassed', {
      userId: uid,
    });
  }, [navigation, user?.id]);

  return (
    <ModalOnboardingFlow
      onComplete={handleComplete}
      onExitToPostInterview={handleExitToPostInterview}
    />
  );
};

