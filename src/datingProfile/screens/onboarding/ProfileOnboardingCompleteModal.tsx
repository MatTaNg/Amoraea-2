import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { ONBOARDING_STEP_SCREEN_EDGES_WITH_BOTTOM } from './modals/onboardingStepScreenEdges';
import { theme } from '@/shared/theme/theme';

type Props = {
  onContinue: () => void;
  continuing?: boolean;
};

/**
 * Shown after modal profile onboarding (including life domains) before edit profile.
 */
export function ProfileOnboardingCompleteModal({ onContinue, continuing = false }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={ONBOARDING_STEP_SCREEN_EDGES_WITH_BOTTOM}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.hero}>
            <View style={styles.successRing}>
              <Text style={styles.successMark} accessibilityLabel="Complete">
                ✓
              </Text>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardAccent} pointerEvents="none" />
            <Text style={styles.overline}>Profile complete</Text>
            <Text style={styles.title}>You&apos;re ready to be matched</Text>
            <Text style={styles.subtitle}>
              Your dating profile is set up. We can now match you with other members based on
              compatibility, values, and what you shared.
            </Text>
            <Text style={styles.body}>
              Review or refine anything on the next screen — you can update photos, preferences,
              and life domains anytime.
            </Text>
          </View>

          <View style={styles.buttonBlock}>
            <Button
              title="View my profile →"
              onPress={onContinue}
              variant="solid"
              loading={continuing}
              disabled={continuing}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  inner: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    flexGrow: 1,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: 20,
  },
  successRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(91, 168, 232, 0.45)',
    backgroundColor: 'rgba(91, 168, 232, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successMark: {
    fontSize: 36,
    color: theme.colors.primary,
    fontWeight: '300',
    marginTop: -2,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.colors.primary,
    opacity: 0.85,
  },
  overline: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: theme.colors.primary,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 18,
  },
  body: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
    textAlign: 'center',
  },
  buttonBlock: {
    marginTop: 28,
  },
});
