import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Button } from '@ui/components/Button';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';

/**
 * Brief framing screen before the AI interview. No back navigation.
 */
export const InterviewFramingScreen: React.FC<{ navigation: any; route: { params: { userId: string } } }> = ({
  navigation,
  route,
}) => {
  const { userId } = route.params;
  return (
    <SafeAreaContainer>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>◆ BEFORE WE BEGIN</Text>
        <Text style={styles.paragraph}>This is a short conversation, not a quiz.</Text>
        <Text style={styles.paragraph}>There are no right answers.</Text>
        <Text style={styles.paragraph}>
          We're interested in how you actually show up in relationships, not how you think you should.
        </Text>
        <Text style={styles.paragraph}>Speak freely. Small moments are fine.</Text>
        <Button
          title="Begin conversation →"
          onPress={() => navigation.replace('OnboardingInterview', { userId })}
          style={styles.button}
        />
      </View>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.xl, justifyContent: 'center' },
  eyebrow: { fontSize: 12, letterSpacing: 2, color: colors.primary, marginBottom: spacing.lg, textTransform: 'uppercase' },
  paragraph: { fontSize: 16, lineHeight: 26, color: colors.text, marginBottom: spacing.md },
  button: { marginTop: spacing.xl },
});
