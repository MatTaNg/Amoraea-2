import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/shared/ui/Button';
import { theme } from '@/shared/theme/theme';
import { PAGE_CONTENT_MAX_WIDTH } from '@utilities/pageContentWidth';
import { ONBOARDING_STEP_SCREEN_EDGES } from './onboardingStepScreenEdges';
import { OnboardingHeader } from './components/OnboardingHeader';

type Props = {
  onFillOutMore: () => void;
  onFinish: () => void;
  onBack: () => void;
};

export function LifeDomainOptionalIntroModal({ onFillOutMore, onFinish, onBack }: Props) {
  return (
    <SafeAreaView style={styles.screen} edges={ONBOARDING_STEP_SCREEN_EDGES}>
      <OnboardingHeader title="Optional questions" onBack={onBack} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>Required fields are complete</Text>
          <Text style={styles.body}>
            You've filled out all the required fields. The rest of the fields are optional. You can
            fill them out for a more complete profile, or continue taping Next to finish onboarding.
          </Text>
          <View style={styles.actions}>
            <Button title="Continue" onPress={onFillOutMore} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  card: {
    width: '100%',
    maxWidth: PAGE_CONTENT_MAX_WIDTH,
    alignSelf: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.24)',
    backgroundColor: 'rgba(255,255,255,0.035)',
    padding: 28,
  },
  title: {
    color: theme.colors.text,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
    marginBottom: 14,
  },
  body: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    marginTop: 28,
    gap: 12,
  },
});
