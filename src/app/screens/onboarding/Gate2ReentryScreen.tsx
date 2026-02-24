import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';

/**
 * Approved users only — re-entry before Stage 3 (psychometrics).
 */
export const Gate2ReentryScreen: React.FC<{ navigation: any; route: { params: { userId: string } } }> = ({
  navigation,
  route,
}) => {
  const { userId } = route.params;
  return (
    <SafeAreaContainer>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>◆ YOU'RE IN</Text>
        <Text style={styles.title}>We've reviewed your application.</Text>
        <Text style={styles.paragraph}>
          To match you well, we need to understand you a little more deeply. This should take about 15 minutes.
        </Text>
        <Button
          title="Continue →"
          onPress={() => navigation.replace('Stage3Psychometrics', { userId })}
          style={styles.button}
        />
      </View>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  eyebrow: { fontSize: 12, letterSpacing: 2, color: colors.primary, marginBottom: spacing.lg, textTransform: 'uppercase' },
  title: { fontSize: 20, fontWeight: '600', color: colors.text, marginBottom: spacing.lg },
  paragraph: { fontSize: 16, lineHeight: 26, color: colors.text, marginBottom: spacing.xl },
  button: { marginTop: spacing.md },
});
