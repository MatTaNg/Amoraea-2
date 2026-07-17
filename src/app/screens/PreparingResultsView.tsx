import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { FlameOrb } from '@app/screens/FlameOrb';
import { INTRO_FLAME_ORB_SIZE } from '@app/screens/flameOrbLogo';

type Props = {
  subtitle?: string;
};

/** Full-screen flame + "Preparing your results" — no transcript or scoring UI. */
export function PreparingResultsView({
  subtitle = 'Please keep this page open until this finishes, closing it may interrupt saving your results. This can take a few minutes.',
}: Props) {
  return (
    <SafeAreaContainer style={styles.safeArea}>
      <View style={styles.container}>
        <FlameOrb state="idle" size={INTRO_FLAME_ORB_SIZE} minimalGlow />
        <Text style={styles.title}>Interview complete</Text>
        <Text style={styles.preparing}>Preparing your results</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </SafeAreaContainer>
  );
}

const INTERVIEW_BG = '#05060D';

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: INTERVIEW_BG,
  },
  container: {
    flex: 1,
    backgroundColor: INTERVIEW_BG,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontFamily: Platform.OS === 'web' ? undefined : 'Jost_300Light',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#E8EEF5',
    marginTop: 24,
    textAlign: 'center',
  },
  preparing: {
    fontFamily: Platform.OS === 'web' ? undefined : 'Jost_300Light',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 16,
    textAlign: 'center',
    maxWidth: 320,
    color: '#95A8BD',
    lineHeight: 18,
  },
});
