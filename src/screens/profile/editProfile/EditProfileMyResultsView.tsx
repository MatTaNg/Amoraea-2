import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { AssessmentId } from '@/data/services/assessmentService';
import { AssessmentInsightResultsPanel } from '@/shared/components/assessments/AssessmentInsightResultsPanel';
import { ConflictStyleResultsPanel } from '@/shared/components/assessments/ConflictStyleResultsPanel';
import { EditProfileSubsectionTitle } from '@/screens/profile/editProfile/EditProfileUi';
import { ep } from '@/screens/profile/editProfile/editProfileTheme';

const RESULT_TABS: { id: AssessmentId; label: string }[] = [
  { id: 'ECR-36', label: 'Attachment (ECR-36)' },
  { id: 'CONFLICT-30', label: 'Conflict-30' },
  { id: 'PVQ-21', label: 'Schwartz values (PVQ-21)' },
  { id: 'SEXUAL_COMMUNICATION', label: 'Sexual communication' },
];

export function EditProfileMyResultsView({ userId }: { userId: string }) {
  const [activeId, setActiveId] = useState<AssessmentId>('ECR-36');

  return (
    <View>
      <View style={styles.viewOnlyBanner}>
        <Text style={styles.viewOnlyBannerText}>
          View only — these results come from your assessments and cannot be edited here.
        </Text>
      </View>
      <EditProfileSubsectionTitle>Assessment results</EditProfileSubsectionTitle>
      <View style={styles.tabRow}>
        {RESULT_TABS.map((tab) => {
          const selected = activeId === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveId(tab.id)}
              style={[styles.tab, selected && styles.tabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.panel} pointerEvents="box-none">
        {activeId === 'CONFLICT-30' ? (
          <ConflictStyleResultsPanel userId={userId} footer={{ kind: 'none' }} />
        ) : (
          <AssessmentInsightResultsPanel userId={userId} instrumentId={activeId} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  viewOnlyBanner: {
    padding: 12,
    borderRadius: ep.spacing.inputRadius,
    backgroundColor: ep.colors.viewOnlyBg,
    borderWidth: 1,
    borderColor: ep.colors.borderSubtle,
    marginBottom: 16,
  },
  viewOnlyBannerText: {
    fontFamily: ep.fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: ep.colors.textSecondary,
    textAlign: 'center',
  },
  tabRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ep.colors.borderDefault,
    backgroundColor: ep.colors.surface,
  },
  tabActive: {
    borderColor: ep.colors.flameMid,
    backgroundColor: ep.colors.tipCardBg,
  },
  tabText: {
    fontFamily: ep.fonts.ui,
    fontSize: 11,
    color: ep.colors.textSecondary,
    letterSpacing: 0.3,
  },
  tabTextActive: {
    color: ep.colors.flameBright,
    fontWeight: '600',
  },
  panel: {
    borderRadius: ep.spacing.cardRadius,
    overflow: 'hidden',
  },
});
