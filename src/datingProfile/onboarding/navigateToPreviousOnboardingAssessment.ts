import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DatingProfileStackParamList } from '@app/navigation/DatingProfileOnboardingNavigator';
import {
  FIRST_DATING_PROFILE_ASSESSMENT_ID,
  getPreviousInstrument,
  type AssessmentId,
} from '@/data/services/assessmentService';

/**
 * From question 1 of an instrument, navigate to the prior onboarding step
 * (typology intro, previous insight, or conflict results).
 */
export function replaceWithPreviousOnboardingAssessment(
  navigation: NativeStackNavigationProp<DatingProfileStackParamList>,
  instrumentId: AssessmentId,
): void {
  if (instrumentId === FIRST_DATING_PROFILE_ASSESSMENT_ID) {
    navigation.replace('DatingTypologyIntro');
    return;
  }

  const previousId = getPreviousInstrument(instrumentId);
  if (!previousId) {
    navigation.replace('DatingTypologyIntro');
    return;
  }

  if (previousId === 'CONFLICT-30') {
    navigation.replace('DatingConflictResults', {});
    return;
  }

  navigation.replace('DatingInsight', { instrument: previousId });
}
