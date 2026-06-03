import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { DatingProfileStackParamList } from "@app/navigation/DatingProfileOnboardingNavigator";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { Button } from "@/shared/ui/Button";
import {
  ASSESSMENT_BATTERY_COMPLETE_BODY,
  ASSESSMENT_BATTERY_COMPLETE_TITLE,
  type AssessmentId,
} from "@/data/services/assessmentService";
import { replaceWithNextOnboardingAssessment } from "@/datingProfile/onboarding/navigateToNextOnboardingAssessment";
import {
  INSTRUMENT_TITLES,
} from "@/data/assessments/insightContent";
import type { AssessmentInsightSnapshot } from "@/src/types";
import { AssessmentInsightBody } from "@/shared/components/assessments/AssessmentInsightBody";
import { AssessmentPreparingResults } from "@/shared/components/assessments/AssessmentPreparingResults";
import { useAssessmentInsightPayload } from "@/screens/assessments/useAssessmentInsightPayload";
import { useNavigateAfterAssessments } from "@/datingProfile/onboarding/useNavigateAfterAssessments";
import { theme } from "@/shared/theme/theme";

export function InsightScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<DatingProfileStackParamList>>();
  const route =
    useRoute<RouteProp<DatingProfileStackParamList, "DatingInsight">>();
  const { user } = useAuth();
  const rawInstrument = route.params?.instrument;
  const instrumentId = (
    Array.isArray(rawInstrument) ? rawInstrument[0] : rawInstrument || ""
  ) as AssessmentId;

  const {
    loading,
    snapshot,
    aiParagraphs,
    aiPhase,
    isFinal,
    nextTitle,
    nextMeta,
  } = useAssessmentInsightPayload(user?.id, instrumentId);
  const navigateAfterAssessments = useNavigateAfterAssessments(user?.id);

  const handleContinue = () => {
    if (isFinal) {
      void navigateAfterAssessments();
      return;
    }
    if (!instrumentId) return;
    const hasNext = replaceWithNextOnboardingAssessment(navigation, instrumentId);
    if (!hasNext) void navigateAfterAssessments();
  };

  if (loading) {
    return <AssessmentPreparingResults />;
  }

  const displaySnapshot =
    snapshot ??
    ({
      instrumentLabel: INSTRUMENT_TITLES[instrumentId] ?? instrumentId,
      headline: "Complete",
      body: "",
      growthEdge: "",
      details: [],
    } satisfies AssessmentInsightSnapshot);

  const snapshotWithAi: AssessmentInsightSnapshot = {
    ...displaySnapshot,
    aiParagraphs:
      aiParagraphs.length > 0 ? aiParagraphs : displaySnapshot.aiParagraphs,
  };

  const flowProgressPct = 100;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.flowProgressTrack}>
        <View
          style={[styles.flowProgressFill, { width: `${flowProgressPct}%` }]}
        />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <AssessmentInsightBody
          snapshot={snapshotWithAi}
          badgeSuffix=" · Complete ✓"
          aiPhase={aiPhase}
        />
        <View style={styles.nextCard}>
          {!isFinal && nextTitle && (
            <View>
              <Text style={styles.upNext}>Up next: {nextTitle}</Text>
              {nextMeta && <Text style={styles.nextMeta}>{nextMeta}</Text>}
            </View>
          )}
          {isFinal && (
            <View>
              <Text style={styles.finalTitle}>{ASSESSMENT_BATTERY_COMPLETE_TITLE}</Text>
              <Text style={styles.finalBody}>{ASSESSMENT_BATTERY_COMPLETE_BODY}</Text>
            </View>
          )}
        </View>
        <Button
          title="CONTINUE →"
          onPress={handleContinue}
          variant="solid"
          style={{ marginTop: 24 }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: { flex: 1 },
  flowProgressTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    width: "100%",
  },
  flowProgressFill: {
    height: "100%",
    backgroundColor: theme.colors.primary,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
  },
  nextCard: {
    marginTop: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 18,
  },
  upNext: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.colors.text,
  },
  nextMeta: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  finalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: theme.colors.text,
    marginBottom: 8,
  },
  finalBody: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
  },
});
