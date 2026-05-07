import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ModalOnboardingScreen } from '../../datingProfile/screens/onboarding/modals/ModalOnboardingScreen';
import { BreakScreen } from '../../datingProfile/screens/assessments/BreakScreen';
import { AssessmentIntroScreen } from '../../datingProfile/screens/assessments/AssessmentIntroScreen';
import { InstrumentScreen } from '../../datingProfile/screens/assessments/InstrumentScreen';
import { InsightScreen } from '../../datingProfile/screens/assessments/InsightScreen';
import { ConflictStyleAssessmentScreen } from '../../datingProfile/screens/assessments/ConflictStyleAssessmentScreen';
import { ConflictStyleResultsScreen } from '../../datingProfile/screens/assessments/ConflictStyleResultsScreen';
import ProfileBuilderScreen from '../../datingProfile/screens/onboarding/ProfileBuilderScreen';
import AdditionalInfoScreen from '../../datingProfile/screens/onboarding/AdditionalInfoScreen';

export type DatingProfileStackParamList = {
  DatingModals: undefined;
  DatingBreak: undefined;
  DatingAssessmentIntro: undefined;
  DatingInstrument: { instrument?: string; q?: string };
  DatingInsight: { instrument?: string };
  DatingConflictStyle: { from?: string; retake?: string };
  DatingConflictResults: { from?: string };
  DatingProfileBuilder: undefined;
  DatingAdditionalInfo: undefined;
};

const Stack = createNativeStackNavigator<DatingProfileStackParamList>();

export function DatingProfileOnboardingNavigator({ userId: _userId }: { userId: string }) {
  void _userId;
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="DatingModals">
      <Stack.Screen name="DatingModals" component={ModalOnboardingScreen} />
      <Stack.Screen name="DatingBreak" component={BreakScreen} />
      <Stack.Screen name="DatingAssessmentIntro" component={AssessmentIntroScreen} />
      <Stack.Screen name="DatingInstrument" component={InstrumentScreen} />
      <Stack.Screen name="DatingInsight" component={InsightScreen} />
      <Stack.Screen name="DatingConflictStyle" component={ConflictStyleAssessmentScreen} />
      <Stack.Screen name="DatingConflictResults" component={ConflictStyleResultsScreen} />
      <Stack.Screen name="DatingProfileBuilder" component={ProfileBuilderScreen} />
      <Stack.Screen name="DatingAdditionalInfo" component={AdditionalInfoScreen} />
    </Stack.Navigator>
  );
}
