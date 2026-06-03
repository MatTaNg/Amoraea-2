import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DatingProfileStackParamList } from '@app/navigation/DatingProfileOnboardingNavigator';
import {
  getAssessmentEntryRoute,
  getNextInstrument,
  type AssessmentId,
} from '@/data/services/assessmentService';

/**
 * After an instrument finishes (insight or dedicated results screen), open the next
 * onboarding assessment. Returns false when there is no next instrument in the core sequence.
 */
export function replaceWithNextOnboardingAssessment(
  navigation: NativeStackNavigationProp<DatingProfileStackParamList>,
  completedInstrument: AssessmentId,
): boolean {
  const nextId = getNextInstrument(completedInstrument);
  if (!nextId) return false;

  const path = getAssessmentEntryRoute(nextId);
  if (path.includes('conflict-style')) {
    navigation.replace('DatingConflictStyle', {});
  } else {
    navigation.replace('DatingInstrument', { instrument: nextId });
  }
  return true;
}
