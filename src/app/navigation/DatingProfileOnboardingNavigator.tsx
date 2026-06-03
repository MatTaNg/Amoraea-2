import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ModalOnboardingScreen } from '../../datingProfile/screens/onboarding/modals/ModalOnboardingScreen';
import { BreakScreen } from '../../datingProfile/screens/assessments/BreakScreen';
import { InstrumentScreen } from '../../datingProfile/screens/assessments/InstrumentScreen';
import { InsightScreen } from '../../datingProfile/screens/assessments/InsightScreen';
import { ConflictStyleAssessmentScreen } from '../../datingProfile/screens/assessments/ConflictStyleAssessmentScreen';
import { ConflictStyleResultsScreen } from '../../datingProfile/screens/assessments/ConflictStyleResultsScreen';
import ProfileBuilderScreen from '../../datingProfile/screens/onboarding/ProfileBuilderScreen';
import AdditionalInfoScreen from '../../datingProfile/screens/onboarding/AdditionalInfoScreen';
import { DatingOnboardingEntryScreen } from '../../datingProfile/screens/onboarding/DatingOnboardingEntryScreen';
import { ProfileSetupTransitionScreen } from '../../datingProfile/screens/onboarding/ProfileSetupTransitionScreen';
import { RelationshipTypologyIntroScreen } from '../../datingProfile/screens/assessments/RelationshipTypologyIntroScreen';

export type DatingProfileStackParamList = {
  DatingOnboardingEntry: undefined;
  DatingTypologyIntro: undefined;
  DatingProfileSetupTransition: undefined;
  DatingModals: undefined;
  DatingBreak: undefined;
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
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="DatingOnboardingEntry">
      <Stack.Screen name="DatingOnboardingEntry" component={DatingOnboardingEntryScreen} />
      <Stack.Screen name="DatingTypologyIntro" component={RelationshipTypologyIntroScreen} />
      <Stack.Screen name="DatingProfileSetupTransition" component={ProfileSetupTransitionScreen} />
      <Stack.Screen name="DatingModals" component={ModalOnboardingScreen} />
      <Stack.Screen name="DatingBreak" component={BreakScreen} />
      <Stack.Screen name="DatingInstrument" component={InstrumentScreen} />
      <Stack.Screen name="DatingInsight" component={InsightScreen} />
      <Stack.Screen name="DatingConflictStyle" component={ConflictStyleAssessmentScreen} />
      <Stack.Screen name="DatingConflictResults" component={ConflictStyleResultsScreen} />
      <Stack.Screen name="DatingProfileBuilder" component={ProfileBuilderScreen} />
      <Stack.Screen name="DatingAdditionalInfo" component={AdditionalInfoScreen} />
    </Stack.Navigator>
  );
}
