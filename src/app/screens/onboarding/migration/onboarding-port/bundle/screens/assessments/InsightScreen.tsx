import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/shared/hooks/AuthProvider";
import { Button } from "@/shared/ui/Button";
import {
  getAssessmentResult,
  saveAssessmentAiReflection,
  getNextInstrument,
  getAssessmentEntryRoute,
  type AssessmentId,
} from "@/data/services/assessmentService";
import { fetchAssessmentAiInsight } from "@/data/services/assessmentAiInsightService";
import { getInsightContent, INSTRUMENT_TITLES } from "@/data/assessments/insightContent";
import type { AssessmentInsightSnapshot } from "@/src/types";
import { AssessmentInsightBody } from "@/shared/components/assessments/AssessmentInsightBody";
import { theme } from "@/shared/theme/theme";

const AI_INSIGHT_INSTRUMENTS = new Set<AssessmentId>(["ECR-36", "PVQ-21", "CONFLICT-30"]);

function splitInsightParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function contentToSnapshot(
  instrumentId: AssessmentId,
  content: ReturnType<typeof getInsightContent>
): AssessmentInsightSnapshot {
  return {
    instrumentLabel: INSTRUMENT_TITLES[instrumentId] ?? instrumentId,
    headline: content.headline,
    body: content.body,
    growthEdge: content.growthEdge,
    details: Array.isArray(content.details) ? content.details : [],
    aiParagraphs: undefined,
  };
}

export function InsightScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ instrument: string }>();
  const instrumentId = (params.instrument || "") as AssessmentId;

  const [snapshot, setSnapshot] = useState<AssessmentInsightSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiParagraphs, setAiParagraphs] = useState<string[]>([]);
  const [aiPhase, setAiPhase] = useState<"idle" | "loading" | "ready" | "off">("idle");
  const [isFinal, setIsFinal] = useState(false);
  const [nextTitle, setNextTitle] = useState<string | null>(null);
  const [nextMeta, setNextMeta] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id || !instrumentId) {
        setLoading(false);
        setAiPhase("off");
        return;
      }
      const result = await getAssessmentResult(user.id, instrumentId);
      if (cancelled) return;

      const scores =
        result.success && result.data?.scores ? result.data.scores : ({} as Record<string, number>);

      const content = getInsightContent(instrumentId, scores);
      setSnapshot(contentToSnapshot(instrumentId, content));
      setIsFinal(!!content.isFinal);
      setNextTitle(content.nextTitle ?? null);
      setNextMeta(content.nextMeta ?? null);
      setLoading(false);

      if (!AI_INSIGHT_INSTRUMENTS.has(instrumentId) || Object.keys(scores).length === 0) {
        setAiPhase("off");
        return;
      }

      setAiPhase("loading");
      const ai = await fetchAssessmentAiInsight(instrumentId, scores);
      if (cancelled) return;
      if (ai.status === "ready") {
        const paras = splitInsightParagraphs(ai.text);
        setAiParagraphs(paras);
        setAiPhase("ready");
        await saveAssessmentAiReflection(user.id, instrumentId, paras);
      } else {
        setAiPhase("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, instrumentId]);

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
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" />
      </View>
    );
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
    aiParagraphs: aiParagraphs.length > 0 ? aiParagraphs : displaySnapshot.aiParagraphs,
  };

  const flowProgressPct = 100;

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.flowProgressTrack}>
        <View style={[styles.flowProgressFill, { width: `${flowProgressPct}%` }]} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <AssessmentInsightBody
          snapshot={snapshotWithAi}
          badgeSuffix=" · Complete ✓"
          aiPhase={aiPhase}
        />
        <View style={styles.divider} />
        {!isFinal && nextTitle && (
          <>
            <Text style={styles.upNext}>Up next: {nextTitle}</Text>
            {nextMeta && <Text style={styles.nextMeta}>{nextMeta}</Text>}
          </>
        )}
        {isFinal && (
          <>
            <Text style={styles.finalTitle}>Your psychological profile is complete.</Text>
            <Text style={styles.finalBody}>
              You're now ready to meet people who actually match how you connect.
            </Text>
          </>
        )}
        <Button
          title={isFinal ? "COMPLETE MY PROFILE →" : "CONTINUE →"}
          onPress={handleContinue}
          variant="primary"
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
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: { flex: 1 },
  flowProgressTrack: {
    height: 4,
    backgroundColor: "#E0E0E0",
    width: "100%",
  },
  flowProgressFill: {
    height: "100%",
    backgroundColor: "#007AFF",
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 20,
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
