import React from 'react';
import { View, Text, Platform, StyleSheet } from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { FlameOrb } from '@app/screens/FlameOrb';

type Props = {
  subtitle?: string;
};

/** Full-screen flame + "Preparing your results" — no transcript or scoring UI. */
export function PreparingResultsView({
  subtitle = 'Please keep this page open until this finishes, closing it may interrupt saving your results.',
}: Props) {
  return (
    <SafeAreaContainer>
      <View style={styles.container}>
        <FlameOrb state="idle" size={80} minimalGlow />
        <Text style={styles.title}>Preparing your results</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05060D',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontFamily: Platform.OS === 'web' ? undefined : 'Jost_300Light',
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginTop: 24,
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
