import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { UncertaintyBreakdown } from '@features/psychometrics/computeUncertaintyScore';
import { UNCERTAINTY_ROUTING_THRESHOLD } from '@features/psychometrics/computeUncertaintyScore';
import {
  AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_THRESHOLD,
  ANXIETY_TRAIT_HIGH_FLOOR_THRESHOLD,
  BRS_LOW_RESILIENCE_FLOOR_THRESHOLD,
  DWECK_EXTREME_FIXED_MINDSET_FLOOR_THRESHOLD,
  GASP_EXTREME_EXTERNALIZATION_FLOOR_THRESHOLD,
  RSES_LOW_SELF_ESTEEM_FLOOR_THRESHOLD,
  SCS_SF_LOW_SELF_COMPASSION_FLOOR_THRESHOLD,
} from '@features/psychometrics/psychometricFloorBreaches';

const FLAG_DESCRIPTIONS: Record<string, string> = {
  gasp_accountability_divergence:
    'Self-report suggests high blame externalization while interview accountability signals are strong.',
  aaq2_regulation_divergence:
    'High experiential avoidance on self-report but strong regulation signals in the interview.',
  aaq2_attunement_divergence:
    'High experiential avoidance on self-report but strong attunement signals in the interview.',
  brs_regulation_divergence:
    'Low resilience self-report but strong regulation signals in the interview.',
  rses_accountability_divergence:
    'Low self-esteem self-report but strong accountability signals in the interview.',
  scs_sf_accountability_divergence:
    'Low self-compassion self-report but strong accountability signals in the interview.',
  dweck_commitment_divergence:
    'Fixed mindset self-report but strong commitment-threshold signals in the interview.',
  sd3_narcissism_contempt_divergence:
    'High SD3 narcissism self-report but low contempt signals in structured scenarios.',
  sd3_narcissism_floor:
    'SD3 narcissism self-report meets the automatic fail threshold (≥ 4.0).',
  rfq_low_reflective_functioning_floor:
    'RFQ self-report is below the automatic fail threshold (< 2.0).',
  gasp_extreme_externalization_floor:
    `GASP externalization self-report meets the automatic fail threshold (≥ ${GASP_EXTREME_EXTERNALIZATION_FLOOR_THRESHOLD.toFixed(1)}).`,
  dweck_extreme_fixed_mindset_floor:
    `Relationship Beliefs combined score is below the automatic fail threshold (< ${DWECK_EXTREME_FIXED_MINDSET_FLOOR_THRESHOLD.toFixed(1)}).`,
  scs_sf_low_self_compassion_floor:
    `SCS-SF self-compassion score is below the automatic fail threshold (< ${SCS_SF_LOW_SELF_COMPASSION_FLOOR_THRESHOLD.toFixed(1)}).`,
  brs_low_resilience_floor:
    `BRS resilience score is at or below the automatic fail threshold (≤ ${BRS_LOW_RESILIENCE_FLOOR_THRESHOLD.toFixed(1)}).`,
  anxiety_trait_high_floor:
    `Anxiety Trait score meets the automatic fail threshold (≥ ${ANXIETY_TRAIT_HIGH_FLOOR_THRESHOLD.toFixed(1)}).`,
  aaq2_high_experiential_avoidance_floor:
    `AAQ-II experiential avoidance sum score meets the automatic fail threshold (≥ ${AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_THRESHOLD.toFixed(0)}).`,
  rses_low_self_esteem_floor:
    `Rosenberg Self-Esteem sum score is at or below the automatic fail threshold (≤ ${RSES_LOW_SELF_ESTEEM_FLOOR_THRESHOLD.toFixed(0)}).`,
  rfq_mentalizing_divergence_low_self_report:
    'Limited reflective functioning self-report but strong mentalizing signals in the interview.',
  rfq_mentalizing_divergence_high_self_report:
    'Strong reflective functioning self-report but weak mentalizing signals in the interview — possible performance effect.',
  mentalizing_overcertainty: 'Multiple moments flagged for mentalizing overcertainty.',
  projection_detected: 'Projection defense pattern detected in interview scoring.',
  defense_possible_false_negative:
    'Psychometric profile suggests possible missed defense detection in the interview.',
  ego_development_review: 'Ego development level flagged for manual review.',
  underdisclosure: 'Disclosure calibration suggests underdisclosure.',
  overdisclosure: 'Disclosure calibration suggests overdisclosure.',
  reasoning_pending: 'AI narrative reasoning still pending at scoring time.',
};

function describeFlag(flag: string): string {
  const key = flag.split(' ')[0];
  if (FLAG_DESCRIPTIONS[key]) return FLAG_DESCRIPTIONS[key];
  if (flag.startsWith('score_near_threshold')) {
    return 'Weighted score is close to the pass threshold — small shifts could change the gate outcome.';
  }
  if (flag.startsWith('score_recovery')) {
    return 'One or more scenario scores were recovered from model output rather than parsed cleanly.';
  }
  if (flag.startsWith('high_scenario_variance') || flag.startsWith('moderate_scenario_variance')) {
    return 'Scenario composite scores vary substantially — inconsistent performance across scenarios.';
  }
  if (flag.startsWith('straight_line_flags')) {
    return 'Psychometric responses show implausible straight-line patterns.';
  }
  if (flag.startsWith('gaming_correction_level')) {
    return 'Graduated gaming correction applied — significant data quality concerns with psychometric self-report.';
  }
  if (flag === 'gaming_correction_severe') {
    return 'Severe gaming correction (level 3) — all positive psychometric contributions stripped plus penalty.';
  }
  if (flag.startsWith('defense_cross_reference_contradiction')) {
    return 'Defense pattern NLP detection contradicts self-report psychometric profile — possible false positive.';
  }
  return flag;
}

export function uncertaintyBadgeColor(score: number | null): string {
  if (score == null) return '#999';
  if (score < 0.4) return '#22c55e';
  if (score < UNCERTAINTY_ROUTING_THRESHOLD) return '#f59e0b';
  return '#ef4444';
}

export function uncertaintyBadgeLabel(score: number | null): string {
  if (score == null) return 'Not computed';
  if (score < 0.4) return 'Low uncertainty';
  if (score < UNCERTAINTY_ROUTING_THRESHOLD) return 'Moderate uncertainty';
  return 'High uncertainty';
}

type Props = {
  uncertaintyScore: number | null;
  breakdown?: UncertaintyBreakdown | null;
};

export function UncertaintyScoreCard({ uncertaintyScore, breakdown }: Props) {
  const displayScore = uncertaintyScore;
  const color = uncertaintyBadgeColor(displayScore);

  const componentEntries = breakdown
    ? [
        { label: 'Threshold proximity', value: breakdown.components.thresholdProximity },
        { label: 'Consistency flags', value: breakdown.components.consistencyFlags },
        { label: 'Depth signal concerns', value: breakdown.components.depthSignalConcerns },
        { label: 'Score recovery', value: breakdown.components.scoreRecovery },
        { label: 'Scenario variance', value: breakdown.components.scenarioVariance },
        { label: 'Straight-line flags', value: breakdown.components.straightLineFlags },
        { label: 'Gaming correction', value: breakdown.components.gamingCorrection ?? 0 },
      ]
    : [];

  const maxComponent = Math.max(...componentEntries.map((e) => e.value), 0.01);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Uncertainty score</Text>
        <View style={[styles.badge, { borderColor: color, backgroundColor: `${color}22` }]}>
          <Text style={[styles.badgeText, { color }]}>
            {displayScore != null ? displayScore.toFixed(2) : '—'} · {uncertaintyBadgeLabel(displayScore)}
          </Text>
        </View>
      </View>

      {componentEntries.length > 0 ? (
        <View style={styles.barsSection}>
          <Text style={styles.sectionLabel}>Component contributions</Text>
          {componentEntries.map((entry) => (
            <View key={entry.label} style={styles.barRow}>
              <Text style={styles.barLabel}>{entry.label}</Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(100, (entry.value / maxComponent) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.barValue}>{entry.value.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {breakdown?.activeFlags?.length ? (
        <View style={styles.flagsSection}>
          <Text style={styles.sectionLabel}>Active flags</Text>
          {breakdown.activeFlags.map((flag) => (
            <View key={flag} style={styles.flagRow}>
              <Text style={styles.flagCode}>{flag}</Text>
              <Text style={styles.flagDesc}>{describeFlag(flag)}</Text>
            </View>
          ))}
        </View>
      ) : null}
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    flex: 1,
  },
  badge: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  meta: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  adminReview: {
    fontSize: 13,
    color: '#ef4444',
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 4,
  },
  barsSection: {
    marginTop: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  barLabel: {
    width: 130,
    fontSize: 11,
    color: '#6b7280',
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    borderRadius: 4,
  },
  barValue: {
    width: 36,
    fontSize: 11,
    color: '#374151',
    textAlign: 'right',
  },
  flagsSection: {
    marginTop: 12,
  },
  flagRow: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  flagCode: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#6b7280',
    marginBottom: 2,
  },
  flagDesc: {
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
});
