import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { DatingProfileStackParamList } from "@app/navigation/DatingProfileOnboardingNavigator";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { theme } from "@/shared/theme/theme";
import {
  applyDatingProfileOnboardingRoute,
  resolveDatingProfileOnboardingEntryRoute,
} from "@/datingProfile/onboarding/resolveDatingProfileOnboardingRoute";

/** @deprecated Legacy route name — redirects via shared entry resolver (no intro UI). */
export function BreakScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DatingProfileStackParamList>>();
  const { user } = useAuth();

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    let cancelled = false;
    void (async () => {
      const route = await resolveDatingProfileOnboardingEntryRoute(uid);
      if (cancelled) return;
      await applyDatingProfileOnboardingRoute(uid, route, (screen, params) => {
        navigation.replace(screen, params as never);
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [navigation, user?.id]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.background,
  },
});
