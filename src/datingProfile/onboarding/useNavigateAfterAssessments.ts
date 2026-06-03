import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DatingProfileStackParamList } from '@app/navigation/DatingProfileOnboardingNavigator';
import {
  applyDatingProfileOnboardingRoute,
  resolvePostAssessmentsRoute,
} from '@/datingProfile/onboarding/resolveDatingProfileOnboardingRoute';

/** Navigate after the last core psychometric instrument is saved. */
export function useNavigateAfterAssessments(userId: string | undefined) {
  const navigation = useNavigation<NativeStackNavigationProp<DatingProfileStackParamList>>();

  return useCallback(async () => {
    if (!userId) return;
    const route = await resolvePostAssessmentsRoute(userId);
    await applyDatingProfileOnboardingRoute(userId, route, (screen, params) => {
      navigation.replace(screen, params as never);
    });
  }, [navigation, userId]);
}
