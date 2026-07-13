import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { markAssessmentsStarted } from "@/data/services/assessmentService";
import { theme } from "@/shared/theme/theme";

/**
 * Legacy route: assessment list intro was removed; send users straight into the first instrument.
 */
export default function AssessmentIntroRedirect() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!user?.id) return;
      const result = await markAssessmentsStarted(user.id, "ECR-36");
      if (cancelled) return;
      if (!result.success) {
        console.error(result.error);
        return;
      }
      router.replace("/onboarding/assessments/instrument?instrument=ECR-36");
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, router]);

  return <View style={styles.fill} />;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
