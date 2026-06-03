import React from "react";
import { StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { DatingProfileStackParamList } from "@app/navigation/DatingProfileOnboardingNavigator";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { ConflictStyleResultsPanel } from "@/shared/components/assessments/ConflictStyleResultsPanel";
import { replaceWithNextOnboardingAssessment } from "@/datingProfile/onboarding/navigateToNextOnboardingAssessment";
import { useNavigateAfterAssessments } from "@/datingProfile/onboarding/useNavigateAfterAssessments";
import { theme } from "@/shared/theme/theme";

export function ConflictStyleResultsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<DatingProfileStackParamList>>();
  const route =
    useRoute<RouteProp<DatingProfileStackParamList, "DatingConflictResults">>();
  const { user } = useAuth();
  const navigateAfterAssessments = useNavigateAfterAssessments(user?.id);
  const fromFlow = route.params?.from === "edit" ? "edit" : "onboarding";

  if (!user?.id) {
    return (
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]} />
    );
  }

  const footer =
    fromFlow === "onboarding"
      ? {
          kind: "onboarding" as const,
          onContinue: () => {
            const hasNext = replaceWithNextOnboardingAssessment(navigation, "CONFLICT-30");
            if (!hasNext) void navigateAfterAssessments();
          },
        }
      : {
          kind: "stack" as const,
          label: "Done",
          onPress: () => navigation.goBack(),
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
