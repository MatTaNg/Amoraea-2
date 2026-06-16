import React, { Suspense, lazy, useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ValidationEntryScreen } from '@app/screens/relationshipValidation/ValidationEntryScreen';
import { ValidationPartnerEmailScreen } from '@app/screens/relationshipValidation/ValidationPartnerEmailScreen';
import { ValidationPreAssessmentScreen } from '@app/screens/relationshipValidation/ValidationPreAssessmentScreen';
import { ValidationPsychometricsHubScreen } from '@app/screens/relationshipValidation/ValidationPsychometricsHubScreen';
import { ValidationInstrumentScreen } from '@app/screens/relationshipValidation/ValidationInstrumentScreen';
import { ValidationConflictScreen } from '@app/screens/relationshipValidation/ValidationConflictScreen';
import { ValidationReportScreen } from '@app/screens/relationshipValidation/ValidationReportScreen';
import { ValidationPostInterviewProcessingScreen } from '@app/screens/relationshipValidation/ValidationPostInterviewProcessingScreen';

import {
  isStandardPostInterviewStackRoute,
  VALIDATION_POST_INTERVIEW_HANDOFF_ROUTE,
} from '@features/relationshipValidation/validationPostInterviewRouting';

const AriaScreenLazy = lazy(() => import('@app/screens/AriaScreen'));

function redirectValidationPostInterview(
  navigation: NativeStackNavigationProp<RelationshipValidationStackParamList, 'ValidationAria'>,
): void {
  navigation.replace('ValidationPostInterviewProcessing');
}

function maybeRedirectValidationPostInterview(
  navigation: NativeStackNavigationProp<RelationshipValidationStackParamList, 'ValidationAria'>,
  name: string,
): boolean {
  if (name === VALIDATION_POST_INTERVIEW_HANDOFF_ROUTE || name === 'ValidationReport') {
    if (name === 'ValidationReport') {
      navigation.replace('ValidationReport');
    } else {
      redirectValidationPostInterview(navigation);
    }
    return true;
  }
  if (isStandardPostInterviewStackRoute(name)) {
    redirectValidationPostInterview(navigation);
    return true;
  }
  return false;
}

type ValidationAriaScreenProps = {
  userId: string;
  navigation: NativeStackNavigationProp<RelationshipValidationStackParamList, 'ValidationAria'>;
  route: RouteProp<RelationshipValidationStackParamList, 'ValidationAria'>;
};

function ValidationAriaScreen({ userId, navigation, route }: ValidationAriaScreenProps) {
  const interviewNavigation = useMemo(
    () => ({
      ...navigation,
      navigate: (name: string, params?: { userId?: string }) => {
        if (maybeRedirectValidationPostInterview(navigation, name)) return;
        navigation.navigate(name as 'ValidationReport', params as never);
      },
      replace: (name: string, params?: { userId?: string }) => {
        if (maybeRedirectValidationPostInterview(navigation, name)) return;
        navigation.replace(name as 'ValidationReport', params as never);
      },
    }),
    [navigation],
  );

  const interviewRoute = useMemo(
    () => ({
      ...route,
      name: 'ValidationAria' as const,
      params: { userId, fromValidationTrack: true as const },
    }),
    [route, userId],
  );

  return (
    <Suspense
      fallback={
        <View style={ariaStyles.center}>
          <ActivityIndicator size="large" color="#5BA8E8" />
          <Text style={ariaStyles.text}>Loading interview…</Text>
        </View>
      }
    >
      <AriaScreenLazy navigation={interviewNavigation} route={interviewRoute} />
    </Suspense>
  );
}

const ariaStyles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#05060D',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: { color: '#95A8BD' },
});

export type RelationshipValidationStackParamList = {
  ValidationEntry: undefined;
  ValidationPartnerEmail: { newComparison?: boolean } | undefined;
  ValidationPreAssessment: undefined;
  ValidationPsychometricsHub: undefined;
  ValidationInstrument: { instrument: 'ECR-36' | 'PVQ-21' };
  ValidationConflict: undefined;
  ValidationReport: undefined;
  ValidationPostInterviewProcessing: undefined;
  ValidationAria: { userId: string };
};

const Stack = createNativeStackNavigator<RelationshipValidationStackParamList>();

type Props = {
  userId: string;
};

export function RelationshipValidationNavigator({ userId }: Props) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="ValidationEntry">
      <Stack.Screen name="ValidationEntry">
        {(props) => <ValidationEntryScreen userId={userId} navigation={props.navigation} />}
      </Stack.Screen>
      <Stack.Screen name="ValidationPartnerEmail">
        {(props) => (
          <ValidationPartnerEmailScreen
            userId={userId}
            navigation={props.navigation}
            route={props.route}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="ValidationPreAssessment">
        {(props) => <ValidationPreAssessmentScreen userId={userId} navigation={props.navigation} />}
      </Stack.Screen>
      <Stack.Screen name="ValidationPsychometricsHub">
        {(props) => <ValidationPsychometricsHubScreen userId={userId} navigation={props.navigation} />}
      </Stack.Screen>
      <Stack.Screen name="ValidationInstrument" component={ValidationInstrumentScreen} />
      <Stack.Screen name="ValidationConflict" component={ValidationConflictScreen} />
      <Stack.Screen name="ValidationReport">
        {(props) => <ValidationReportScreen userId={userId} navigation={props.navigation} />}
      </Stack.Screen>
      <Stack.Screen name="ValidationPostInterviewProcessing">
        {(props) => (
          <ValidationPostInterviewProcessingScreen userId={userId} navigation={props.navigation} />
        )}
      </Stack.Screen>
      <Stack.Screen name="ValidationAria">
        {(props) => (
          <ValidationAriaScreen userId={userId} navigation={props.navigation} route={props.route} />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
