import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import {
  ASSESSMENT_BATTERY_COMPLETE_BODY,
  ASSESSMENT_BATTERY_COMPLETE_TITLE,
  type AssessmentId,
} from "@/data/services/assessmentService";
import {
  INSTRUMENT_TITLES,
} from "@/data/assessments/insightContent";
import type { AssessmentInsightSnapshot } from "@/src/types";
import { AssessmentInsightBody } from "@/shared/components/assessments/AssessmentInsightBody";
import { AssessmentPreparingResults } from "@/shared/components/assessments/AssessmentPreparingResults";
import {
  useAssessmentInsightPayload,
} from "@/screens/assessments/useAssessmentInsightPayload";
import { theme } from "@/shared/theme/theme";

type Props = {
  userId: string;
  instrumentId: AssessmentId;
  /** Hide onboarding flow copy (Up next / profile complete) when viewing results in edit profile. */
  showFlowFooter?: boolean;
};

/**
 * Same insight body as post-assessment completion, for embedding (e.g. edit profile typology tabs).
 */
export function AssessmentInsightResultsPanel({
  userId,
  instrumentId,
  showFlowFooter = false,
}: Props) {
  const {
    loading,
    snapshot,
    aiParagraphs,
    aiPhase,
    isFinal,
    nextTitle,
    nextMeta,
  } = useAssessmentInsightPayload(userId, instrumentId);

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

  return (
    <View style={styles.wrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: "100%" }]} />
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        nestedScrollEnabled
      >
        <AssessmentInsightBody
          snapshot={snapshotWithAi}
          badgeSuffix={showFlowFooter ? " · Complete ✓" : undefined}
          aiPhase={aiPhase}
        />
        {showFlowFooter ? (
          <View style={styles.nextCard}>
            {!isFinal && nextTitle ? (
              <View>
                <Text style={styles.upNext}>Up next: {nextTitle}</Text>
                {nextMeta ? <Text style={styles.nextMeta}>{nextMeta}</Text> : null}
              </View>
            ) : null}
            {isFinal ? (
              <View>
                <Text style={styles.finalTitle}>{ASSESSMENT_BATTERY_COMPLETE_TITLE}</Text>
                <Text style={styles.finalBody}>{ASSESSMENT_BATTERY_COMPLETE_BODY}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 280,
    backgroundColor: theme.colors.background,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    width: "100%",
  },
  progressFill: {
    height: "100%",
    backgroundColor: theme.colors.primary,
  },
  scroll: { maxHeight: 640 },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
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
