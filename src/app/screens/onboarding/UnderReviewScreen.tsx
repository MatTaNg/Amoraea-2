import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';

/**
 * Shown to under_review users on every app open. No timeline, no appeal.
 */
export const UnderReviewScreen: React.FC<{ navigation: any; route: any }> = () => {
  return (
    <SafeAreaContainer>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>◆ STILL REVIEWING</Text>
        <Text style={styles.title}>Your application is still being reviewed.</Text>
        <Text style={styles.paragraph}>We appreciate your patience.</Text>
      </View>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  eyebrow: { fontSize: 12, letterSpacing: 2, color: colors.primary, marginBottom: spacing.lg, textTransform: 'uppercase' },
  title: { fontSize: 20, fontWeight: '600', color: colors.text, marginBottom: spacing.lg },
  paragraph: { fontSize: 16, lineHeight: 26, color: colors.text },
});
