import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DatingProfileStackParamList } from '@app/navigation/DatingProfileOnboardingNavigator';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { theme } from '@/shared/theme/theme';
import {
  applyDatingProfileOnboardingRoute,
  resolveDatingProfileOnboardingEntryRoute,
} from '@/datingProfile/onboarding/resolveDatingProfileOnboardingRoute';

/**
 * Resolves psychometrics vs profile-modals vs builder and replaces itself (no intro UI).
 */
export function DatingOnboardingEntryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DatingProfileStackParamList>>();
  const { user } = useAuth();

  const resolveAndNavigate = useCallback(() => {
    const uid = user?.id;
    if (!uid) return;

    void (async () => {
      const route = await resolveDatingProfileOnboardingEntryRoute(uid);
      await applyDatingProfileOnboardingRoute(uid, route, (screen, params) => {
        navigation.replace(screen, params as never);
      });
    })();
  }, [navigation, user?.id]);

  useFocusEffect(
    useCallback(() => {
      resolveAndNavigate();
    }, [resolveAndNavigate]),
  );

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={styles.label}>Loading…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    gap: 12,
  },
  label: {
    fontSize: 15,
    color: theme.colors.textSecondary,
  },
});
