import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import type {
  GamingCorrectionResult,
  InstrumentModifierComponents,
} from '@features/psychometrics/computeGamingCorrection';

const INSTRUMENT_LABELS: Record<string, string> = {
  gasp: 'GASP',
  brs: 'BRS',
  aaq2: 'AAQ-II',
  rfq: 'RFQ',
  mspss: 'MSPSS',
  sd3_narcissism: 'SD3',
  dweck: 'Dweck/RBI',
  rses: 'RSES',
  scs_sf: 'SCS-SF',
  scs: 'SCS',
};

export function gamingCorrectionBadgeColor(level: 0 | 1 | 2 | 3): string {
  if (level === 0) return '#22c55e';
  if (level === 1) return '#f59e0b';
  if (level === 2) return '#f97316';
  return '#ef4444';
}

export function gamingCorrectionBadgeLabel(level: 0 | 1 | 2 | 3): string {
  if (level === 0) return 'No correction';
  if (level === 1) return 'Partial correction';
  if (level === 2) return 'All positives stripped';
  return 'Severe correction + penalty';
}

type Props = {
  gamingCorrection: GamingCorrectionResult | null | undefined;
  instrumentComponents?: InstrumentModifierComponents | null;
  variant?: 'light' | 'dark';
};

export function GamingCorrectionCard({
  gamingCorrection,
  instrumentComponents,
  variant = 'light',
}: Props) {
  const isDark = variant === 'dark';
  const level = gamingCorrection?.correctionLevel ?? 0;
  const color = gamingCorrectionBadgeColor(level);

  if (!gamingCorrection) {
    return (
      <View style={[styles.card, isDark && styles.cardDark]}>
        <Text style={[styles.title, isDark && styles.titleDark]}>Gaming correction</Text>
        <Text style={[styles.muted, isDark && styles.mutedDark]}>
          Not computed — psychometrics may be pending or this attempt predates gaming correction.
        </Text>
      </View>
    );
  }

  const strippedDetails = gamingCorrection.strippedInstruments
    .map((key) => {
      const contribution = instrumentComponents?.[key as keyof InstrumentModifierComponents];
      const label = INSTRUMENT_LABELS[key] ?? key;
      if (typeof contribution === 'number' && contribution > 0) {
        return `${label}: +${contribution.toFixed(2)} stripped`;
      }
      if (typeof contribution === 'number' && contribution <= 0) {
        return `${label}: (no positive contribution)`;
      }
      return `${label}: positive contribution stripped`;
    })
    .filter(Boolean);

  return (
    <View style={[styles.card, isDark && styles.cardDark]}>
      <View style={styles.headerRow}>
        <Text style={[styles.title, isDark && styles.titleDark]}>Gaming correction</Text>
        <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}22` }]}>
          <Text style={[styles.badgeText, { color }]}>
            Level {level} · {gamingCorrectionBadgeLabel(level)}
          </Text>
        </View>
      </View>

      <View style={styles.compareRow}>
        <Text style={[styles.compareLabel, isDark && styles.mutedDark]}>Original modifier</Text>
        <Text style={[styles.compareValue, isDark && styles.titleDark]}>
          {gamingCorrection.originalModifier >= 0 ? '+' : ''}
          {gamingCorrection.originalModifier.toFixed(2)}
        </Text>
        <Text style={[styles.arrow, isDark && styles.mutedDark]}>→</Text>
        <Text style={[styles.compareLabel, isDark && styles.mutedDark]}>Corrected modifier</Text>
        <Text style={[styles.compareValue, { color }, isDark && styles.titleDark]}>
          {gamingCorrection.correctedModifier >= 0 ? '+' : ''}
          {gamingCorrection.correctedModifier.toFixed(2)}
        </Text>
      </View>

      {strippedDetails.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Stripped instruments</Text>
          {strippedDetails.map((line) => (
            <Text key={line} style={[styles.listItem, isDark && styles.mutedDark]}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Additional penalty</Text>
        <Text style={[styles.penaltyValue, isDark && styles.titleDark]}>
          {gamingCorrection.additionalPenalty >= 0 ? '+' : ''}
          {gamingCorrection.additionalPenalty.toFixed(2)}
        </Text>
      </View>

      {gamingCorrection.activeTriggers.length > 0 ? (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Active triggers</Text>
          {gamingCorrection.activeTriggers.map((trigger, i) => (
            <View key={`${trigger.type}-${i}`} style={styles.triggerRow}>
              <Text style={[styles.triggerType, isDark && styles.mutedDark]}>
                {trigger.type.replace('_', ' ')} · level {trigger.level}
              </Text>
              <Text style={[styles.triggerDetail, isDark && styles.titleDark]}>{trigger.detail}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, isDark && styles.sectionLabelDark]}>Explanation</Text>
        <Text style={[styles.explanation, isDark && styles.mutedDark]}>{gamingCorrection.explanation}</Text>
      </View>
    </View>
  );
}

export function GamingCorrectionBanner({
  gamingCorrection,
}: {
  gamingCorrection: GamingCorrectionResult | null | undefined;
}) {
  const level = gamingCorrection?.correctionLevel ?? 0;
  if (level < 2) return null;

  const color = gamingCorrectionBadgeColor(level);
  const message =
    level >= 3
      ? '⚠ Psychometric gaming correction applied — all positive modifier contributions stripped and penalty applied'
      : '⚠ Psychometric gaming correction applied — positive modifier contributions stripped';

  return (
    <View style={[styles.banner, { borderColor: color, backgroundColor: `${color}18` }]}>
      <Text style={[styles.bannerText, { color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 16,
  },
  cardDark: {
    backgroundColor: '#111',
    borderColor: '#333',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    flex: 1,
  },
  titleDark: {
    color: '#fff',
  },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  muted: {
    fontSize: 13,
    color: '#666',
  },
  mutedDark: {
    color: '#aaa',
  },
  compareRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  compareLabel: {
    fontSize: 12,
    color: '#666',
  },
  compareValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  arrow: {
    fontSize: 14,
    color: '#999',
    marginHorizontal: 4,
  },
  section: {
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLabelDark: {
    color: '#888',
  },
  listItem: {
    fontSize: 13,
    color: '#374151',
    marginBottom: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  penaltyValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  triggerRow: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  triggerType: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  triggerDetail: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  explanation: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  banner: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
});
