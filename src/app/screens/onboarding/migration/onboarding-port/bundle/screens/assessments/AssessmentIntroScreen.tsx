import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { Button } from "@/shared/ui/Button";
import { markAssessmentsStarted } from "@/data/services/assessmentService";
import { ASSESSMENT_IDS } from "@/data/services/assessmentService";
import { theme } from "@/shared/theme/theme";

const INSTRUMENT_LABELS: Record<string, { label: string; time: string }> = {
  "ECR-36": { label: "Attachment Style", time: "~8 min" },
  "CONFLICT-30": { label: "Conflict Style", time: "~3–4 min" },
  "PVQ-21": { label: "Schwartz Values", time: "~4 min" },
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: theme.colors.background,
  },
  flowProgressTrack: {
    height: 4,
    backgroundColor: "#E0E0E0",
    width: "100%",
    marginBottom: 16,
  },
  flowProgressFill: {
    height: "100%",
    backgroundColor: "#007AFF",
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 24,
  },
  list: {
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowLabel: {
    fontSize: 16,
    color: theme.colors.text,
  },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowTime: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#007AFF",
    backgroundColor: "transparent",
  },
  total: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
    marginBottom: 24,
  },
  note: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 32,
  },
});

export function AssessmentIntroScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const progressPct = 0;

  const handleBegin = async () => {
    if (!user?.id) return;
    const result = await markAssessmentsStarted(user.id, "ECR-36");
    if (!result.success) {
      console.error(result.error);
      return;
    }
    router.replace("/onboarding/assessments/instrument?instrument=ECR-36");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.flowProgressTrack}>
        <View style={[styles.flowProgressFill, { width: `${progressPct}%` }]} />
      </View>
      <Text style={styles.title}>What we're about to measure</Text>
      <Text style={{ fontSize: 16, color: theme.colors.textSecondary, lineHeight: 24, marginBottom: 24 }}>
        These three assessments cover the psychological dimensions most predictive of
        relationship compatibility. You can pause between them.
      </Text>
      <View style={styles.list}>
        {ASSESSMENT_IDS.map((id, index) => (
          <View key={id} style={styles.row}>
            <Text style={styles.rowLabel}>
              [{index + 1}] {INSTRUMENT_LABELS[id]?.label ?? id}
            </Text>
            <View style={styles.rowMeta}>
              <Text style={styles.rowTime}>
                {INSTRUMENT_LABELS[id]?.time ?? "—"}
              </Text>
              <View style={styles.circle} />
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.total}>Total: ~10–15 minutes</Text>
      <Text style={styles.note}>
        Your answers are saved automatically after each assessment.
      </Text>
      <Button title="BEGIN →" onPress={handleBegin} variant="primary" />
    </SafeAreaView>
  );
}
