import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { AdminCohortDemographics } from '@features/admin/interviewDashboard/adminCohortDemographics';

const GENDER_COLORS: Record<string, string> = {
  Man: '#528EDC',
  Woman: '#C87AD8',
  'Non-binary': '#2A8C6A',
  Unknown: '#5C7A9E',
};

const AGE_COLOR = '#E8B84A';

function DistributionBar({
  label,
  count,
  percentage,
  maxCount,
  color,
  percentageBasisLabel,
}: {
  label: string;
  count: number;
  percentage: number;
  maxCount: number;
  color: string;
  percentageBasisLabel?: string;
}) {
  const widthPct = maxCount > 0 ? Math.min((count / maxCount) * 100, 100) : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrackWrap}>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${widthPct}%`, backgroundColor: color }]} />
        </View>
        <Text style={styles.barMeta}>
          {count} · {percentage}%
          {percentageBasisLabel ? ` ${percentageBasisLabel}` : ''}
        </Text>
      </View>
    </View>
  );
}

export function AdminCohortDemographicsBanner({
  demographics,
  loadingProfiles,
}: {
  demographics: AdminCohortDemographics;
  loadingProfiles?: boolean;
}) {
  if (demographics.cohortSize === 0) return null;

  const genderMax = Math.max(1, ...demographics.gender.map((g) => g.count));
  const ageMax = Math.max(1, ...demographics.ageBuckets.map((b) => b.count));

  const ageSummary =
    demographics.ageMean != null
      ? `Mean ${demographics.ageMean}${demographics.ageMedian != null ? ` · Median ${demographics.ageMedian}` : ''}${
          demographics.ageMin != null && demographics.ageMax != null
            ? ` · Range ${demographics.ageMin}–${demographics.ageMax}`
            : ''
        }`
      : 'No ages recorded yet';

  return (
    <View style={styles.banner}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Cohort demographics</Text>
        <Text style={styles.subtitle}>
          {demographics.cohortSize} user{demographics.cohortSize === 1 ? '' : 's'} in current filter
          {loadingProfiles ? ' · loading profile fields…' : ''}
        </Text>
      </View>

      <View style={styles.columns}>
        <View style={styles.column}>
          <Text style={styles.columnTitle}>Gender</Text>
          <Text style={styles.columnMeta}>
            Known for {demographics.withGender} of {demographics.cohortSize}
          </Text>
          {demographics.gender.length === 0 ? (
            <Text style={styles.emptyNote}>No gender data yet</Text>
          ) : (
            demographics.gender.map((row) => (
              <DistributionBar
                key={row.label}
                label={row.label}
                count={row.count}
                percentage={row.percentage}
                maxCount={genderMax}
                color={GENDER_COLORS[row.label] ?? '#7A9ABE'}
              />
            ))
          )}
        </View>

        <View style={styles.columnDivider} />

        <View style={styles.column}>
          <Text style={styles.columnTitle}>Age</Text>
          <Text style={styles.columnMeta}>
            Known for {demographics.withAge} of {demographics.cohortSize} · {ageSummary}
          </Text>
          {demographics.ageBuckets.length === 0 ? (
            <Text style={styles.emptyNote}>No age data yet</Text>
          ) : (
            demographics.ageBuckets.map((row) => (
              <DistributionBar
                key={row.label}
                label={row.label}
                count={row.count}
                percentage={row.percentage}
                maxCount={ageMax}
                color={AGE_COLOR}
                percentageBasisLabel="of known ages"
              />
            ))
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 4,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.35)',
    backgroundColor: 'rgba(30,111,217,0.12)',
  },
  headerRow: {
    marginBottom: 12,
  },
  title: {
    color: '#E8F0F8',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subtitle: {
    color: '#7A9ABE',
    fontSize: 12,
    marginTop: 3,
  },
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  column: {
    flex: 1,
    minWidth: 240,
  },
  columnDivider: {
    width: 1,
    backgroundColor: 'rgba(82,142,220,0.18)',
    alignSelf: 'stretch',
  },
  columnTitle: {
    color: '#C8E4FF',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  columnMeta: {
    color: '#7A9ABE',
    fontSize: 11,
    marginBottom: 10,
    lineHeight: 16,
  },
  emptyNote: {
    color: '#5C7A9E',
    fontSize: 12,
    fontStyle: 'italic',
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  barLabel: {
    width: 72,
    color: '#C8E4FF',
    fontSize: 12,
    fontWeight: '600',
  },
  barTrackWrap: {
    flex: 1,
    minWidth: 120,
  },
  barTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(5,6,13,0.45)',
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  barMeta: {
    color: '#7A9ABE',
    fontSize: 10,
    marginTop: 3,
  },
});
