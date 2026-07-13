import React, { useEffect } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { useProfile } from "@/shared/hooks/useProfile";
import { Button } from "@/shared/ui/Button";
import {
  markOnboardingCompleteForAssessments,
  markAssessmentsStarted,
  ASSESSMENT_IDS,
} from "@/data/services/assessmentService";
import { theme } from "@/shared/theme/theme";

const INSTRUMENT_LABELS: Record<(typeof ASSESSMENT_IDS)[number], string> = {
  "ECR-36": "Attachment style",
  "CONFLICT-30": "Conflict style",
  "PVQ-21": "Core values (Schwartz)",
};

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
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    flexGrow: 1,
  },
  hero: {
    alignItems: "center",
    marginBottom: 20,
  },
  successRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "rgba(91, 168, 232, 0.45)",
    backgroundColor: "rgba(91, 168, 232, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  successMark: {
    fontSize: 36,
    color: theme.colors.primary,
    fontWeight: "300",
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
    overflow: "hidden",
  },
  cardAccent: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.colors.primary,
    opacity: 0.85,
  },
  overline: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: theme.colors.primary,
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: theme.colors.text,
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: "600",
    color: theme.colors.textSecondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 22,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 10,
  },
  testRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  testRowLast: {
    borderBottomWidth: 0,
  },
  testNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(91, 168, 232, 0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  testNumText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.colors.primary,
  },
  testLabel: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    lineHeight: 22,
  },
  body: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
    marginTop: 18,
    marginBottom: 0,
  },
  breakTip: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: "rgba(91, 168, 232, 0.08)",
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  breakTipText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    fontStyle: "italic",
  },
  meta: {
    marginTop: 14,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: "center",
  },
  buttonBlock: {
    marginTop: 28,
  },
});

export function BreakScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { profile, loading } = useProfile();

  useEffect(() => {
    if (loading) return;
    if (profile?.assessmentsCompleted) {
      router.replace("/onboarding/profile-builder");
      return;
    }
    if (profile?.assessmentsStarted || profile?.currentAssessment) {
      const current = profile?.currentAssessment;
      if (current === "CONFLICT-30") {
        router.replace("/onboarding/assessments/conflict-style");
        return;
      }
      if (typeof current === "string" && current.length > 0) {
        router.replace(`/onboarding/assessments/instrument?instrument=${encodeURIComponent(current)}`);
        return;
      }
      router.replace("/onboarding/assessments/instrument?instrument=ECR-36");
    }
  }, [
    loading,
    profile?.assessmentsCompleted,
    profile?.assessmentsStarted,
    profile?.currentAssessment,
    router,
  ]);

  useEffect(() => {
    if (!user?.id) return;
    if (profile?.assessmentsStarted || profile?.assessmentsCompleted || profile?.currentAssessment) return;
    markOnboardingCompleteForAssessments(user.id).catch(console.error);
  }, [user?.id, profile?.assessmentsStarted, profile?.assessmentsCompleted, profile?.currentAssessment]);

  if (loading || profile?.assessmentsStarted || profile?.assessmentsCompleted || profile?.currentAssessment) {
    return null;
  }

  const handleContinue = () => {
    void (async () => {
      if (!user?.id) return;
      const result = await markAssessmentsStarted(user.id, "ECR-36");
      if (!result.success) {
        console.error(result.error);
        return;
      }
      router.replace("/onboarding/assessments/instrument?instrument=ECR-36");
    })();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
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
            <Text style={styles.overline}>Profile ready</Text>
            <Text style={styles.title}>Your profile is complete</Text>
            <Text style={styles.subtitle}>
              Next: four brief psychometric tests—about 12–18 minutes total, with pauses between each.
            </Text>

            <Text style={styles.sectionLabel}>What you will complete</Text>
            {ASSESSMENT_IDS.map((id, index) => (
              <View
                key={id}
                style={[styles.testRow, index === ASSESSMENT_IDS.length - 1 ? styles.testRowLast : null]}
              >
                <View style={styles.testNum}>
                  <Text style={styles.testNumText}>{index + 1}</Text>
                </View>
                <Text style={styles.testLabel}>{INSTRUMENT_LABELS[id] ?? id}</Text>
              </View>
            ))}

            <Text style={styles.body}>
              These are validated research instruments. Together they help us
              understand how you connect, communicate, and show up in relationships. Your results stay private
              and are used only to improve your matches.
            </Text>

            <View style={styles.breakTip}>
              <Text style={styles.breakTipText}>
                We recommend a short break before you begin. You can leave and come back anytime; progress is
                saved automatically after each test.
              </Text>
            </View>
          </View>

          <Text style={styles.meta}>Four psychometric assessments · ~12–18 min total</Text>

          <View style={styles.buttonBlock}>
            <Button title="Continue →" onPress={handleContinue} variant="solid" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
