import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import type { AssessmentInsightSnapshot } from '@/datingProfile/types';
import { theme } from '@/shared/theme/theme';

type AssessmentInsightBodyProps = {
  paragraphs?: string[];
  snapshot?: AssessmentInsightSnapshot;
  badgeSuffix?: string;
  aiPhase?: 'idle' | 'loading' | 'ready' | 'off';
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

  const legacyParagraphs = Array.isArray(snap.paragraphs) ? snap.paragraphs : [];
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

  const aiParas = snap.aiParagraphs && snap.aiParagraphs.length > 0 ? snap.aiParagraphs : [];
  const showAiLoading = aiPhase === 'loading';

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={styles.badge}>
          {label}
          {badgeSuffix ?? ''}
        </Text>
      ) : null}
      {snap.headline ? <Text style={styles.headline}>{snap.headline}</Text> : null}
      {snap.body ? <Text style={styles.body}>{snap.body}</Text> : null}
      {snap.growthEdge ? <Text style={styles.growth}>{snap.growthEdge}</Text> : null}
      {snap.details && snap.details.length > 0 ? (
        <View style={styles.details}>
          {snap.details.map((d, i) => (
            <View key={i} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{d.label}</Text>
              <Text style={styles.detailValue}>{d.value}</Text>
              {d.description ? <Text style={styles.detailDesc}>{d.description}</Text> : null}
            </View>
          ))}
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
  wrap: { gap: 14 },
  badge: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  headline: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    lineHeight: 30,
  },
  body: { fontSize: 16, lineHeight: 24, color: theme.colors.text },
  growth: { fontSize: 15, lineHeight: 22, color: theme.colors.textSecondary, fontStyle: 'italic' },
  details: { gap: 16, marginTop: 4 },
  detailRow: { gap: 4 },
  detailLabel: { fontSize: 14, fontWeight: '700', color: theme.colors.text },
  detailValue: { fontSize: 14, color: theme.colors.primary },
  detailDesc: { fontSize: 14, lineHeight: 20, color: theme.colors.textSecondary },
  aiBlock: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    gap: 12,
  },
  aiHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text,
  },
  aiLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  aiLoadingText: { fontSize: 14, color: theme.colors.textSecondary },
  aiP: { fontSize: 15, lineHeight: 22, color: theme.colors.text },
  p: { color: theme.colors.text, fontSize: 15, lineHeight: 22 },
});
