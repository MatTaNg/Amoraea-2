import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
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
import {
  getInsightContent,
  INSTRUMENT_TITLES,
} from "@/data/assessments/insightContent";
import type { AssessmentInsightSnapshot } from "@/src/types";
import { AssessmentInsightBody } from "@/shared/components/assessments/AssessmentInsightBody";
import { theme } from "@/shared/theme/theme";

const AI_INSIGHT_INSTRUMENTS = new Set<AssessmentId>([
  "ECR-36",
  "PVQ-21",
  "CONFLICT-30",
]);

function splitInsightParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function contentToSnapshot(
  instrumentId: AssessmentId,
  content: ReturnType<typeof getInsightContent>,
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

  const [snapshot, setSnapshot] = useState<AssessmentInsightSnapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [aiParagraphs, setAiParagraphs] = useState<string[]>([]);
  const [aiPhase, setAiPhase] = useState<"idle" | "loading" | "ready" | "off">(
    "idle",
  );
  const [isFinal, setIsFinal] = useState(false);
  const [nextTitle, setNextTitle] = useState<string | null>(null);
  const [nextMeta, setNextMeta] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setSnapshot(null);
      setAiParagraphs([]);
      setAiPhase("idle");

      if (!user?.id || !instrumentId) {
        setAiPhase("off");
        setLoading(false);
        return;
      }

      try {
        const result = await getAssessmentResult(user.id, instrumentId);
        if (cancelled) return;

        const scores =
          result.success && result.data?.scores
            ? result.data.scores
            : ({} as Record<string, number>);

        const content = getInsightContent(instrumentId, scores);
        const nextSnapshot = contentToSnapshot(instrumentId, content);
        let nextAiParagraphs: string[] = [];
        let nextAiPhase: "ready" | "off" = "off";

        if (
          AI_INSIGHT_INSTRUMENTS.has(instrumentId) &&
          Object.keys(scores).length > 0
        ) {
          const ai = await fetchAssessmentAiInsight(instrumentId, scores);
          if (cancelled) return;
          if (ai.status === "ready") {
            nextAiParagraphs = splitInsightParagraphs(ai.text);
            nextAiPhase = "ready";
            void saveAssessmentAiReflection(
              user.id,
              instrumentId,
              nextAiParagraphs,
            ).catch(() => undefined);
          }
        }

        if (cancelled) return;
        setSnapshot(nextSnapshot);
        setIsFinal(!!content.isFinal);
        setNextTitle(content.nextTitle ?? null);
        setNextMeta(content.nextMeta ?? null);
        setAiParagraphs(nextAiParagraphs);
        setAiPhase(nextAiPhase);
        setLoading(false);
      } catch {
        if (cancelled) return;
        const fallbackContent = getInsightContent(instrumentId, {});
        setSnapshot(contentToSnapshot(instrumentId, fallbackContent));
        setIsFinal(!!fallbackContent.isFinal);
        setNextTitle(fallbackContent.nextTitle ?? null);
        setNextMeta(fallbackContent.nextMeta ?? null);
        setAiParagraphs([]);
        setAiPhase("off");
        setLoading(false);
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
        <View style={styles.loadingCard}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingTitle}>Preparing your results</Text>
        </View>
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
    padding: 24,
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
  loadingCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(91,168,232,0.24)",
    backgroundColor: "rgba(91,168,232,0.08)",
    padding: 28,
    alignItems: "center",
  },
  loadingTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 18,
    marginBottom: 8,
    textAlign: "center",
  },
  loadingBody: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
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
