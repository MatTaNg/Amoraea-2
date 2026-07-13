import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { Button } from "@/shared/ui/Button";
import {
  getNextInstrument,
  getAssessmentEntryRoute,
  type AssessmentId,
} from "@/data/services/assessmentService";
import { INSTRUMENT_TITLES } from "@/data/assessments/insightContent";
import type { AssessmentInsightSnapshot } from "@/src/types";
import { AssessmentInsightBody } from "@/shared/components/assessments/AssessmentInsightBody";
import { AssessmentPreparingResults } from "@/shared/components/assessments/AssessmentPreparingResults";
import { useAssessmentInsightPayload } from "@/screens/assessments/useAssessmentInsightPayload";
import { theme } from "@/shared/theme/theme";

export function InsightScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ instrument: string }>();
  const instrumentId = (params.instrument || "") as AssessmentId;

  const {
    loading,
    snapshot,
    aiParagraphs,
    aiPhase,
    isFinal,
    nextTitle,
    nextMeta,
  } = useAssessmentInsightPayload(user?.id, instrumentId);

  const handleContinue = () => {
    if (isFinal) {
      router.replace("/(tabs)/likes-you");
      return;
    }
    const nextId = getNextInstrument(instrumentId);
    if (nextId) {
      router.replace(getAssessmentEntryRoute(nextId));
    }
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
              <Text style={styles.finalTitle}>
                Your psychological profile is complete.
              </Text>
              <Text style={styles.finalBody}>
                You're now ready to meet people who actually match how you
                connect.
              </Text>
            </View>
          )}
        </View>
        <Button
          title={isFinal ? "COMPLETE MY PROFILE →" : "CONTINUE →"}
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
