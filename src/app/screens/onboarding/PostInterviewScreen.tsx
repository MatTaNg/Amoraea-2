import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';

/**
 * Shown to ALL users after the interview. No score, no pass/fail, no back.
 */
export const PostInterviewScreen: React.FC<{ navigation: any; route: { params: { userId: string } } }> = ({
  route,
}) => {
  return (
    <SafeAreaContainer>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>◆ THANK YOU</Text>
        <Text style={styles.title}>Your interview is complete.</Text>
        <Text style={styles.paragraph}>
          We review every application before making introductions. This typically takes a day or two.
        </Text>
        <Text style={styles.paragraph}>We'll be in touch.</Text>
      </View>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  eyebrow: { fontSize: 12, letterSpacing: 2, color: colors.primary, marginBottom: spacing.lg, textTransform: 'uppercase' },
  title: { fontSize: 20, fontWeight: '600', color: colors.text, marginBottom: spacing.lg },
  paragraph: { fontSize: 16, lineHeight: 26, color: colors.text, marginBottom: spacing.md },
});
