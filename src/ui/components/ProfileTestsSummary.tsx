import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import type { Profile } from '@domain/models/Profile';
import type { BasicInfo, Gate1Score, Gate2Psychometrics, Gate3Compatibility } from '@domain/models/OnboardingGates';
import { supabase } from '@data/supabase/client';
import { CommunicationStyleSection } from '@ui/components/CommunicationStyleSection';

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .replace(/_/g, ' ')
    .trim();
}

function formatRelationshipType(value: string): string {
  if (value.toLowerCase() === 'enm') return 'ENM';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function SummaryBlock({
  title,
  done,
  children,
}: {
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <Ionicons
          name={done ? 'checkmark-circle' : 'ellipse-outline'}
          size={20}
          color={done ? colors.success : colors.textSecondary}
        />
        <Text style={styles.blockTitle}>{title}</Text>
      </View>
      {done ? <View style={styles.blockContent}>{children}</View> : null}
    </View>
  );
}

export const ProfileTestsSummary: React.FC<{ profile: Profile | null | undefined }> = ({ profile }) => {
  const basicInfo: BasicInfo | null = profile?.basicInfo ?? null;
  const gate1: Gate1Score | null = profile?.gate1Score ?? null;
  const gate2: Gate2Psychometrics | null = profile?.gate2Psychometrics ?? null;
  const gate3: Gate3Compatibility | null = profile?.gate3Compatibility ?? null;

  const [styleLabels, setStyleLabels] = useState<{
    primary: string[] | null;
    secondary: string[] | null;
    lowConfidenceNote: string | null;
  } | null>(null);
  const [styleLoading, setStyleLoading] = useState(false);

  const hasBasic = !!(
    basicInfo?.firstName ||
    profile?.name ||
    profile?.age != null ||
    profile?.gender ||
    profile?.occupation ||
    profile?.location?.label
  );
  const hasInterview = !!gate1;
  const hasPsychometrics = !!gate2;
  const hasCompatibility = !!(gate3 && (Object.keys(gate3).length > 0 || (gate3.profilePrompts?.length ?? 0) > 0));

  useEffect(() => {
    const uid = profile?.id;
    if (!uid || !hasInterview) {
      setStyleLabels(null);
      return;
    }
    let cancelled = false;
    setStyleLoading(true);
    void supabase
      .from('communication_style_profiles')
      .select('style_labels_primary, style_labels_secondary, low_confidence_note')
      .eq('user_id', uid)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setStyleLabels(
          data
            ? {
                primary: (data.style_labels_primary as string[] | null) ?? null,
                secondary: (data.style_labels_secondary as string[] | null) ?? null,
                lowConfidenceNote: (data.low_confidence_note as string | null) ?? null,
              }
            : null
        );
        setStyleLoading(false);
      })
      .catch(() => {
        if (!cancelled) setStyleLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.id, hasInterview]);

  if (!hasBasic && !hasInterview && !hasPsychometrics && !hasCompatibility) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Profile summary</Text>
      <Text style={styles.sectionSubtitle}>Information from your completed assessments</Text>

      <SummaryBlock title="Basic information" done={hasBasic}>
        <>
          <SummaryRow label="Name" value={(profile?.name ?? basicInfo?.firstName ?? '') || '—'} />
          <SummaryRow label="Age" value={(profile?.age ?? basicInfo?.age) != null ? String(profile?.age ?? basicInfo?.age) : '—'} />
          <SummaryRow label="Gender" value={(profile?.gender ?? basicInfo?.gender ?? '') || '—'} />
          <SummaryRow label="Location" value={(profile?.location?.label ?? [basicInfo?.locationCity, basicInfo?.locationCountry].filter(Boolean).join(', ') ?? '') || '—'} />
          <SummaryRow label="Occupation" value={(profile?.occupation ?? basicInfo?.occupation ?? '') || '—'} />
          {(profile?.heightCentimeters ?? basicInfo?.heightCm) != null ? (
            <SummaryRow label="Height" value={`${profile?.heightCentimeters ?? basicInfo?.heightCm} cm`} />
          ) : null}
        </>
      </SummaryBlock>

      <SummaryBlock title="Interview" done={hasInterview}>
        {gate1 && (
          <>
            <SummaryRow label="Result" value={gate1.passed ? 'Passed' : 'Did not pass'} />
            <SummaryRow label="Average score" value={gate1.averageScore.toFixed(1)} />
            {gate1.narrativeCoherence ? (
              <SummaryRow label="Narrative coherence" value={gate1.narrativeCoherence} />
            ) : null}
            {gate1.behavioralSpecificity ? (
              <SummaryRow label="Behavioral specificity" value={gate1.behavioralSpecificity} />
            ) : null}
          </>
        )}
      </SummaryBlock>

      <SummaryBlock title="Psychometrics" done={hasPsychometrics}>
        {gate2 && (
          <>
            <SummaryRow label="ECR-12" value={`${gate2.ecr12.classification} (Anxious: ${gate2.ecr12.anxious.toFixed(1)}, Avoidant: ${gate2.ecr12.avoidant.toFixed(1)})`} />
            <SummaryRow label="TIPI (Big Five)" value={`O: ${gate2.tipi.openness.toFixed(1)} C: ${gate2.tipi.conscientiousness.toFixed(1)} E: ${gate2.tipi.extraversion.toFixed(1)} A: ${gate2.tipi.agreeableness.toFixed(1)} N: ${gate2.tipi.neuroticism.toFixed(1)}`} />
            <SummaryRow label="DSI (Satisfaction)" value={gate2.dsisf.satisfactionScore.toFixed(1)} />
            <SummaryRow label="BRS (Resilience)" value={gate2.brs.resilienceScore.toFixed(1)} />
            <SummaryRow label="PVQ-21 (Values)" value={`Self-direction: ${gate2.pvq21.selfDirection.toFixed(1)}, Security: ${gate2.pvq21.security.toFixed(1)}, Benevolence: ${gate2.pvq21.benevolence.toFixed(1)}`} />
          </>
        )}
      </SummaryBlock>

      <SummaryBlock title="Compatibility" done={hasCompatibility}>
        {gate3 && (
          <>
            {gate3.relationshipType && (
              <SummaryRow label="Relationship type" value={formatRelationshipType(String(gate3.relationshipType))} />
            )}
            {gate3.kidsWanted != null && (
              <SummaryRow label="Kids wanted" value={String(gate3.kidsWanted)} />
            )}
            {gate3.religiousIdentity && (
              <SummaryRow label="Religion" value={formatLabel(String(gate3.religiousIdentity))} />
            )}
            {gate3.workWeekHours && (
              <SummaryRow label="Work week" value={formatLabel(String(gate3.workWeekHours))} />
            )}
            {(gate3.preferredMinBMI != null || gate3.preferredMaxBMI != null) && (
              <SummaryRow label="Partner BMI" value={gate3.preferredMinBMI != null && gate3.preferredMaxBMI != null ? `${gate3.preferredMinBMI.toFixed(0)}–${gate3.preferredMaxBMI.toFixed(0)}` : 'No preference'} />
            )}
            {gate3.profilePrompts && gate3.profilePrompts.length > 0 && (
              <View style={styles.promptsWrap}>
                <Text style={styles.promptsLabel}>Profile prompts</Text>
                {gate3.profilePrompts.map((p, i) => (
                  <View key={i} style={styles.promptItem}>
                    <Text style={styles.promptQuestion}>{p.prompt}</Text>
                    <Text style={styles.promptAnswer}>{p.answer}</Text>
                  </View>
                ))}
              </View>
            )}
            <CommunicationStyleSection
              primary={styleLabels?.primary}
              secondary={styleLabels?.secondary}
              lowConfidenceNote={styleLabels?.lowConfidenceNote}
              loading={styleLoading}
            />
          </>
        )}
      </SummaryBlock>
    </View>
  );
};

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  block: {
    marginBottom: spacing.lg,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  blockTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginLeft: spacing.sm,
  },
  blockContent: {
    paddingLeft: 28,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
    gap: spacing.md,
  },
  rowLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    minWidth: 100,
  },
  rowValue: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  promptsWrap: {
    marginTop: spacing.sm,
  },
  promptsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  promptItem: {
    marginBottom: spacing.sm,
  },
  promptQuestion: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  promptAnswer: {
    fontSize: 13,
    color: colors.text,
  },
});
