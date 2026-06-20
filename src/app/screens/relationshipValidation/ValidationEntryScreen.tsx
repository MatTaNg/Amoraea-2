import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { RelationshipValidationWelcomeModal } from '@features/relationshipValidation/RelationshipValidationWelcomeModal';
import {
  fetchRelationshipValidationRecord,
  ensureRelationshipValidationRecord,
  markValidationWelcomeCompleted,
} from '@features/relationshipValidation/relationshipValidationRepo';
import { resolveValidationFlowStep } from '@features/relationshipValidation/relationshipValidationService';

type Nav = {
  replace: (screen: string) => void;
};

type Props = {
  userId: string;
  navigation: Nav;
};

const STEP_TO_SCREEN: Record<string, string> = {
  welcome: 'ValidationEntry',
  partner_email: 'ValidationPartnerEmail',
  pre_assessment: 'ValidationPreAssessment',
  relationship_test_mode: 'ValidationRelationshipTestMode',
  psychometrics: 'ValidationPsychometricsHub',
  report: 'ValidationReport',
};

export function ValidationEntryScreen({ userId, navigation }: Props) {
  const [showWelcome, setShowWelcome] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensureRelationshipValidationRecord(userId);
      const record = await fetchRelationshipValidationRecord(userId);
      if (cancelled) return;
      const step = await resolveValidationFlowStep(userId, record);
      if (step === 'welcome') {
        setShowWelcome(true);
        setBooting(false);
        return;
      }
      const screen = STEP_TO_SCREEN[step] ?? 'ValidationPartnerEmail';
      navigation.replace(screen);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation, userId]);

  const handleWelcomeContinue = async () => {
    await markValidationWelcomeCompleted(userId);
    setShowWelcome(false);
    navigation.replace('ValidationPartnerEmail');
  };

  if (booting && !showWelcome) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5BA8E8" />
      </View>
    );
  }

  return (
    <>
      <View style={styles.center} />
      <RelationshipValidationWelcomeModal visible={showWelcome} onContinue={() => void handleWelcomeContinue()} />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: '#05060D' },
});
