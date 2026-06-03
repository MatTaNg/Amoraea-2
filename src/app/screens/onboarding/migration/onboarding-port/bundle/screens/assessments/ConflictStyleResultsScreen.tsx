import React from "react";
import { StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { ConflictStyleResultsPanel } from "@/shared/components/assessments/ConflictStyleResultsPanel";
import { theme } from "@/shared/theme/theme";

export function ConflictStyleResultsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string }>();
  const { user } = useAuth();
  const fromFlow = params.from === "edit" ? "edit" : "onboarding";

  if (!user?.id) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]} />
    );
  }

  const footer =
    fromFlow === "onboarding"
      ? {
          kind: "onboarding" as const,
          onContinue: () =>
            router.replace("/onboarding/assessments/instrument?instrument=PVQ-21"),
        }
      : {
          kind: "stack" as const,
          label: "Done",
          onPress: () => router.back(),
        };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ConflictStyleResultsPanel userId={user.id} footer={footer} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
});
