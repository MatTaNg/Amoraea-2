import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DatingProfileStackParamList } from '@app/navigation/DatingProfileOnboardingNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { Button } from '@/shared/ui/Button';
import { theme } from '@/shared/theme/theme';
import {
  applyDatingProfileOnboardingRoute,
  resolvePostAssessmentsRoute,
} from '@/datingProfile/onboarding/resolveDatingProfileOnboardingRoute';

/**
 * Shown once after all dating-profile psychometric instruments are complete,
 * before the modal profile-builder steps.
 */
export function ProfileSetupTransitionScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DatingProfileStackParamList>>();
  const { user } = useAuth();
  const [checkingResume, setCheckingResume] = useState(true);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) {
      setCheckingResume(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      const route = await resolvePostAssessmentsRoute(uid);
      if (cancelled) return;
      if (route.screen !== 'DatingProfileSetupTransition') {
        await applyDatingProfileOnboardingRoute(uid, route, (screen, params) => {
          navigation.replace(screen, params as never);
        });
        return;
      }
      setCheckingResume(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [navigation, user?.id]);

  const handleContinue = () => {
    navigation.replace('DatingModals');
  };

  if (checkingResume) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
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
            <Text style={styles.overline}>Psychometrics complete</Text>
            <Text style={styles.title}>Great work — you finished the tests</Text>
            <Text style={styles.subtitle}>
              Next you will set up your dating profile: photos, preferences, and the details matches use to
              find you.
            </Text>
            <Text style={styles.body}>
              Most people finish in several short steps. You can leave and come back anytime; your test
              results are already saved.
            </Text>
          </View>

          <View style={styles.buttonBlock}>
            <Button title="Set up my profile →" onPress={handleContinue} variant="solid" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
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
