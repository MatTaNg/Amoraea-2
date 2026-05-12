import React from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import type { AssessmentInsightSnapshot } from "@/datingProfile/types";
import { theme } from "@/shared/theme/theme";

type AssessmentInsightBodyProps = {
  paragraphs?: string[];
  snapshot?: AssessmentInsightSnapshot;
  badgeSuffix?: string;
  aiPhase?: "idle" | "loading" | "ready" | "off";
};

export const AssessmentInsightBody: React.FC<AssessmentInsightBodyProps> = ({
  paragraphs,
  snapshot,
  badgeSuffix,
  aiPhase,
}) => {
  if (Array.isArray(paragraphs) && paragraphs.length > 0) {
    return (
      <View style={styles.wrap}>
        {paragraphs.map((p, i) => (
          <Text key={i} style={styles.p}>
            {p}
          </Text>
        ))}
      </View>
    );
  }

  const snap = snapshot;
  if (!snap) {
    return null;
  }

  const legacyParagraphs = Array.isArray(snap.paragraphs)
    ? snap.paragraphs
    : [];
  const label = snap.instrumentLabel || snap.title || snap.instrument;
  const hasRich =
    (label && String(label).trim()) ||
    (snap.headline && snap.headline.trim()) ||
    (snap.body && snap.body.trim()) ||
    (snap.growthEdge && snap.growthEdge.trim()) ||
    (snap.details && snap.details.length > 0);

  if (!hasRich && legacyParagraphs.length > 0) {
    return (
      <View style={styles.wrap}>
        {legacyParagraphs.map((p, i) => (
          <Text key={i} style={styles.p}>
            {p}
          </Text>
        ))}
      </View>
    );
  }

  const aiParas =
    snap.aiParagraphs && snap.aiParagraphs.length > 0 ? snap.aiParagraphs : [];
  const showAiLoading = aiPhase === "loading";

  return (
    <View style={styles.wrap}>
      <View style={styles.heroCard}>
        {label ? (
          <Text style={styles.badge}>
            {label}
            {badgeSuffix ?? ""}
          </Text>
        ) : null}
        {snap.headline ? (
          <Text style={styles.headline}>{snap.headline}</Text>
        ) : null}
        {snap.body ? <Text style={styles.body}>{snap.body}</Text> : null}
        {snap.growthEdge ? (
          <View style={styles.growthCard}>
            <Text style={styles.growthLabel}>Growth edge</Text>
            <Text style={styles.growth}>{snap.growthEdge}</Text>
          </View>
        ) : null}
      </View>

      {snap.details && snap.details.length > 0 ? (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Your breakdown</Text>
          <View style={styles.details}>
            {snap.details.map((d, i) => {
              const isAttachmentStyle =
                label === "Attachment Style" &&
                d.label.toLowerCase().includes("attachment style");
              return (
                <View
                  key={i}
                  style={[
                    styles.detailRow,
                    isAttachmentStyle && styles.resultDetailRow,
                  ]}
                >
                  <Text
                    style={[
                      styles.detailLabel,
                      isAttachmentStyle && styles.resultDetailLabel,
                    ]}
                  >
                    {d.label}
                  </Text>
                  <Text
                    style={[
                      styles.detailValue,
                      isAttachmentStyle && styles.resultDetailValue,
                    ]}
                  >
                    {d.value}
                  </Text>
                  {d.description ? (
                    <Text style={styles.detailDesc}>{d.description}</Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      {showAiLoading || aiParas.length > 0 ? (
        <View style={styles.aiBlock}>
          <Text style={styles.aiHeading}>Personalized reflection</Text>
          {showAiLoading ? (
            <View style={styles.aiLoadingRow}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.aiLoadingText}>Writing your reflection…</Text>
            </View>
          ) : null}
          {aiParas.map((p, i) => (
            <Text key={i} style={styles.aiP}>
              {p}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(91,168,232,0.28)",
    backgroundColor: "rgba(91,168,232,0.08)",
    padding: 22,
    gap: 12,
  },
  badge: {
    fontSize: 13,
    fontWeight: "700",
    color: "#9CB4D8",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  headline: {
    fontSize: 28,
    fontWeight: "800",
    color: theme.colors.text,
    lineHeight: 34,
  },
  body: { fontSize: 16, lineHeight: 25, color: theme.colors.text },
  growthCard: {
    marginTop: 4,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
    gap: 6,
  },
  growthLabel: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: theme.colors.primary,
  },
  growth: { fontSize: 15, lineHeight: 22, color: theme.colors.text },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.035)",
    padding: 18,
    gap: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: theme.colors.text,
  },
  details: { gap: 12 },
  detailRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(82,142,220,0.18)",
    backgroundColor: "rgba(5,6,13,0.36)",
    padding: 14,
    gap: 5,
  },
  detailLabel: { fontSize: 13, fontWeight: "700", color: "#9CB4D8" },
  detailValue: { fontSize: 16, fontWeight: "800", color: theme.colors.text },
  detailDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textSecondary,
  },
  resultDetailRow: {
    borderColor: "rgba(91,168,232,0.35)",
    backgroundColor: "rgba(91,168,232,0.14)",
  },
  resultDetailLabel: {
    color: "#9CB4D8",
    fontSize: 13,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  resultDetailValue: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "800",
    lineHeight: 32,
  },
  aiBlock: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(91,168,232,0.22)",
    backgroundColor: "rgba(91,168,232,0.07)",
    padding: 18,
    gap: 12,
  },
  aiHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.colors.text,
  },
  aiLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  aiLoadingText: { fontSize: 14, color: theme.colors.textSecondary },
  aiP: { fontSize: 15, lineHeight: 22, color: theme.colors.text },
  p: { color: theme.colors.text, fontSize: 15, lineHeight: 22 },
});
