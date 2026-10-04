import { AMORAEA_PAGE_LOADING_SIZE, AmoraeaLoadingSpinner } from '@app/screens/AmoraeaLoadingSpinner';
import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { validationInstrumentsCompleted } from '@features/relationshipValidation/validationPsychometricsProgress';
import {
  markValidationPsychometricsCompleted,
} from '@features/relationshipValidation/relationshipValidationRepo';
import { maybeComputeValidationPairScore } from '@features/relationshipValidation/relationshipValidationService';

type Nav = {
  replace: (screen: string, params?: Record<string, unknown>) => void;
};

type Props = {
  userId: string;
  navigation: Nav;
};

export function ValidationPsychometricsHubScreen({ userId, navigation }: Props) {
  const routeNext = useCallback(async () => {
    const { complete, nextStep } = await validationInstrumentsCompleted(userId);
    if (!complete && nextStep) {
      if (nextStep === 'CONFLICT-30') {
        navigation.replace('ValidationConflict');
        return;
      }
      navigation.replace('ValidationInstrument', { instrument: nextStep });
      return;
    }

    await markValidationPsychometricsCompleted(userId);
    await maybeComputeValidationPairScore(userId);
    navigation.replace('ValidationReport');
  }, [navigation, userId]);

  useFocusEffect(
    useCallback(() => {
      void routeNext();
    }, [routeNext]),
  );

  return (
    <View style={styles.center}>
      <AmoraeaLoadingSpinner size={AMORAEA_PAGE_LOADING_SIZE} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: '#05060D',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
