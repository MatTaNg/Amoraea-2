import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/screens/profile/editProfile/BottomSheet';
import { ep } from '@/screens/profile/editProfile/editProfileTheme';
import type { ProfileStrengthItem } from '@/screens/profile/editProfile/editProfileStrength';

export type EditProfileTabId =
  | 'essentials'
  | 'lifestyle'
  | 'compatibility'
  | 'deepDive';

export type EditProfileLifestyleSegment = 'body' | 'values' | 'preferences';

export function EditProfileSectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function EditProfileSection({
  title,
  description,
  children,
  first,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  first?: boolean;
}) {
  return (
    <View style={[styles.section, first && styles.sectionFirst]}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionAccent} />
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {description ? (
            <Text style={styles.sectionDescription}>{description}</Text>
          ) : null}
        </View>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

export function EditProfileSubsectionTitle({
  children,
  description,
  first,
}: {
  children: string;
  description?: string;
  first?: boolean;
}) {
  return (
    <View style={[styles.subsectionBlock, first && styles.subsectionBlockFirst]}>
      <View style={[styles.subsectionHeader, first && styles.subsectionHeaderFirst]}>
        <View style={styles.subsectionAccent} />
        <Text style={styles.subsectionTitle}>{children}</Text>
      </View>
      {description
        ? description.split('\n\n').map((paragraph, index) => (
            <Text key={index} style={styles.subsectionDescription}>
              {paragraph}
            </Text>
          ))
        : null}
    </View>
  );
}

export function EditProfileNavCardGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.navCardGroup}>{children}</View>;
}

export function EditProfileNavCard({
  title,
  subtitle,
  progressText,
  tag,
  icon,
  onPress,
  grouped,
  isLast,
}: {
  title: string;
  subtitle?: string;
  progressText?: string;
  tag?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  grouped?: boolean;
  isLast?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navCard,
        grouped && styles.navCardGrouped,
        grouped && isLast && styles.navCardGroupedLast,
        pressed && styles.navCardPressed,
      ]}
      accessibilityRole="button"
    >
      <View style={styles.navCardIconWrap}>
        <Ionicons name={icon} size={20} color={ep.colors.flameMid} />
      </View>
      <View style={styles.navCardBody}>
        <View style={styles.navCardTitleRow}>
          <Text style={styles.navCardTitle}>{title}</Text>
          {tag ? (
            <View style={styles.viewOnlyTag}>
              <Text style={styles.viewOnlyTagText}>{tag}</Text>
            </View>
          ) : null}
        </View>
        {subtitle ? <Text style={styles.navCardSubtitle}>{subtitle}</Text> : null}
        {progressText ? (
          <Text style={styles.navCardProgress}>{progressText}</Text>
        ) : null}
      </View>
      <Text style={styles.navChevron}>›</Text>
    </Pressable>
  );
}

export function EditProfileSubScreenHeader({ title }: { title: string }) {
  return (
    <View style={styles.subHeader}>
      <Text style={styles.subHeaderTitle}>{title}</Text>
    </View>
  );
}

export function EditProfileFieldCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.fieldCard, style]}>{children}</View>;
}

export function EditProfileGhostButton({
  label,
  onPress,
  expanded,
}: {
  label: string;
  onPress: () => void;
  expanded?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.ghostBtn,
        pressed && { opacity: 0.85 },
      ]}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
    >
      <Text style={styles.ghostBtnText}>{label}</Text>
      <Text style={styles.ghostBtnChevron}>{expanded ? '▲' : '▼'}</Text>
    </Pressable>
  );
}

export function EditProfileTabHeader({
  title,
  lead,
  saving,
}: {
  title: string;
  lead?: string;
  saving?: boolean;
}) {
  return (
    <View style={styles.tabHeader}>
      <View style={styles.tabHeaderTitleRow}>
        <Text style={styles.tabHeaderTitle}>{title}</Text>
        {saving ? (
          <View style={styles.tabHeaderSaving}>
            <ActivityIndicator size="small" color="#5BA8E8" />
            <Text style={styles.tabHeaderSavingText}>Saving…</Text>
          </View>
        ) : null}
      </View>
      {lead ? <Text style={styles.tabHeaderLead}>{lead}</Text> : null}
    </View>
  );
}

export function EditProfileOverline({
  label,
  actionLabel,
  onAction,
}: {
  label: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.overlineRow}>
      <Text style={styles.overlineLabel}>{label}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <Text style={styles.overlineAction}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function EditProfileStrengthBar({
  percent,
  completedCount,
  totalCount,
  hint,
  incomplete,
  onNavigateToField,
}: {
  percent: number;
  completedCount?: number;
  totalCount?: number;
  hint?: string;
  incomplete?: ProfileStrengthItem[];
  onNavigateToField?: (item: ProfileStrengthItem) => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const clamped = Math.min(100, Math.max(0, percent));
  const remaining = incomplete ?? [];
  const grouped = useMemo(() => groupStrengthItemsByTab(remaining), [remaining]);
  const progressLabel =
    completedCount != null && totalCount != null
      ? `${completedCount} of ${totalCount} fields complete`
      : null;

  const openSheet = () => setSheetOpen(true);
  const closeSheet = () => setSheetOpen(false);

  return (
    <>
      <Pressable
        onPress={openSheet}
        style={({ pressed }) => [
          styles.strengthBlock,
          styles.strengthBlockPressable,
          pressed && styles.strengthBlockPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          remaining.length > 0
            ? `Profile strength ${clamped} percent. ${remaining.length} fields left to complete.`
            : `Profile strength ${clamped} percent. Profile complete.`
        }
        accessibilityHint="Shows remaining profile fields to complete"
      >
        <View style={styles.strengthTopRow}>
          <Text style={styles.strengthLabel}>Profile strength</Text>
          <View style={styles.strengthPercentRow}>
            <Text style={styles.strengthPercent}>{clamped}%</Text>
            <Ionicons name="chevron-forward" size={16} color={ep.colors.textDim} />
          </View>
        </View>
        <View style={styles.strengthTrack}>
          <View style={[styles.strengthFill, { width: `${clamped}%` }]} />
        </View>
        {progressLabel ? (
          <Text style={styles.strengthMeta}>{progressLabel}</Text>
        ) : null}
        {hint ? <Text style={styles.strengthHint}>{hint}</Text> : null}
      </Pressable>

      <BottomSheet
        visible={sheetOpen}
        onClose={closeSheet}
        title={remaining.length > 0 ? 'Complete your profile' : 'Profile strength'}
      >
        <ScrollView style={styles.strengthSheetScroll} keyboardShouldPersistTaps="handled">
          {remaining.length === 0 ? (
            <Text style={styles.strengthSheetComplete}>
              You&apos;re all set — every tracked field is filled in.
            </Text>
          ) : (
            grouped.map((group) => (
              <View key={group.tab} style={styles.strengthSheetGroup}>
                <Text style={styles.strengthSheetGroupLabel}>{group.label}</Text>
                {group.items.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      closeSheet();
                      onNavigateToField?.(item);
                    }}
                    style={({ pressed }) => [
                      styles.strengthSheetRow,
                      pressed && styles.strengthSheetRowPressed,
                    ]}
                    accessibilityRole="button"
                  >
                    <Text style={styles.strengthSheetRowLabel}>{item.label}</Text>
                    <Ionicons name="chevron-forward" size={18} color={ep.colors.textSecondary} />
                  </Pressable>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

const STRENGTH_TAB_ORDER: EditProfileTabId[] = [
  'essentials',
  'lifestyle',
  'compatibility',
  'deepDive',
];

const STRENGTH_TAB_LABELS: Record<EditProfileTabId, string> = {
  essentials: 'Essentials',
  lifestyle: 'Lifestyle',
  compatibility: 'Compatibility',
  deepDive: 'Deep Dive',
};

function groupStrengthItemsByTab(items: ProfileStrengthItem[]) {
  return STRENGTH_TAB_ORDER.map((tab) => ({
    tab,
    label: STRENGTH_TAB_LABELS[tab],
    items: items.filter((item) => item.tab === tab),
  })).filter((group) => group.items.length > 0);
}

const TAB_ITEMS: {
  id: EditProfileTabId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { id: 'essentials', label: 'Essentials', icon: 'person-outline' },
  { id: 'lifestyle', label: 'Lifestyle', icon: 'leaf-outline' },
  { id: 'compatibility', label: 'Compatibility', icon: 'heart-outline' },
  { id: 'deepDive', label: 'Deep Dive', icon: 'compass-outline' },
];

export function EditProfileTabBar({
  active,
  onChange,
}: {
  active: EditProfileTabId;
  onChange: (tab: EditProfileTabId) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TAB_ITEMS.map((tab) => {
        const on = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={styles.tabBarItem}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Ionicons
              name={tab.icon}
              size={22}
              color={on ? ep.colors.flameMid : ep.colors.textDim}
            />
            <Text style={[styles.tabBarLabel, on && styles.tabBarLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function EditProfileSegmentedControl<T extends string>({
  segments,
  active,
  onChange,
}: {
  segments: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <View style={styles.segmentedControl}>
      {segments.map((segment) => {
        const on = segment.id === active;
        return (
          <Pressable
            key={segment.id}
            onPress={() => onChange(segment.id)}
            style={[styles.segment, on && styles.segmentActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.segmentLabel, on && styles.segmentLabelActive]}>
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontFamily: ep.fonts.ui,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    color: ep.colors.textDim,
    marginTop: 28,
    marginBottom: 12,
  },
  section: {
    marginTop: 24,
    borderRadius: ep.spacing.cardRadius,
    backgroundColor: ep.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: ep.colors.borderDefault,
    overflow: 'hidden',
  },
  sectionFirst: {
    marginTop: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: ep.colors.borderSubtle,
    backgroundColor: 'rgba(8,12,24,0.55)',
  },
  sectionAccent: {
    width: 3,
    borderRadius: 999,
    backgroundColor: ep.colors.flameMid,
  },
  sectionHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontFamily: ep.fonts.display,
    fontSize: 28,
    fontWeight: '500',
    color: ep.colors.textBright,
  },
  sectionDescription: {
    fontFamily: ep.fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: ep.colors.textSecondary,
    marginTop: 6,
  },
  sectionBody: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 18,
  },
  subsectionBlock: {
    marginTop: 18,
  },
  subsectionBlockFirst: {
    marginTop: 4,
  },
  subsectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: ep.colors.borderSubtle,
  },
  subsectionHeaderFirst: {
    marginTop: 0,
  },
  subsectionDescription: {
    fontFamily: ep.fonts.body,
    fontSize: 13,
    lineHeight: 19,
    color: ep.colors.textSecondary,
    marginBottom: 12,
  },
  subsectionAccent: {
    width: 2,
    height: 14,
    borderRadius: 999,
    backgroundColor: ep.colors.flameMid,
  },
  subsectionTitle: {
    flex: 1,
    fontFamily: ep.fonts.ui,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: ep.colors.textMuted,
  },
  navCardGroup: {
    borderRadius: ep.spacing.cardRadius,
    backgroundColor: ep.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: ep.colors.borderDefault,
    overflow: 'hidden',
    marginBottom: 12,
  },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: ep.spacing.cardRadius,
    backgroundColor: ep.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: ep.colors.borderDefault,
    marginBottom: 10,
  },
  navCardGrouped: {
    marginBottom: 0,
    borderWidth: 0,
    borderRadius: 0,
    borderBottomWidth: 1,
    borderBottomColor: ep.colors.borderSubtle,
  },
  navCardGroupedLast: {
    borderBottomWidth: 0,
  },
  navCardPressed: { opacity: 0.92 },
  navCardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ep.colors.buttonTintBg,
    borderWidth: 1,
    borderColor: ep.colors.buttonTintBorder,
  },
  navCardBody: { flex: 1, minWidth: 0 },
  navCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  navCardTitle: {
    fontFamily: ep.fonts.ui,
    fontSize: 15,
    fontWeight: '600',
    color: ep.colors.textPrimary,
  },
  navCardSubtitle: {
    fontFamily: ep.fonts.body,
    fontSize: 13,
    color: ep.colors.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },
  navCardProgress: {
    fontFamily: ep.fonts.ui,
    fontSize: 12,
    color: ep.colors.flameMid,
    marginTop: 6,
  },
  viewOnlyTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: ep.colors.viewOnlyBg,
  },
  viewOnlyTagText: {
    fontFamily: ep.fonts.ui,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: ep.colors.textSecondary,
  },
  navChevron: {
    fontSize: 22,
    color: ep.colors.textSecondary,
    paddingLeft: 4,
  },
  subHeader: {
    marginBottom: 16,
  },
  subHeaderTitle: {
    fontFamily: ep.fonts.display,
    fontSize: 30,
    fontWeight: '500',
    color: ep.colors.textBright,
  },
  fieldCard: {
    backgroundColor: ep.colors.surfaceCard,
    borderWidth: 1,
    borderColor: ep.colors.borderSubtle,
    borderRadius: ep.spacing.inputRadius,
    padding: 14,
    marginBottom: 10,
  },
  ghostBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: ep.colors.buttonTintBg,
    borderWidth: 1,
    borderColor: ep.colors.buttonTintBorder,
    marginTop: 8,
  },
  ghostBtnText: {
    fontFamily: ep.fonts.ui,
    fontSize: 12,
    color: ep.colors.flameMid,
    letterSpacing: 0.5,
  },
  ghostBtnChevron: {
    fontSize: 10,
    color: ep.colors.flameMid,
  },
  tabHeader: {
    marginBottom: 16,
  },
  tabHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tabHeaderTitle: {
    flex: 1,
    fontFamily: ep.fonts.display,
    fontSize: 30,
    fontWeight: '500',
    color: ep.colors.textBright,
  },
  tabHeaderLead: {
    fontFamily: ep.fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: ep.colors.textSecondary,
    marginTop: 8,
  },
  tabHeaderSaving: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabHeaderSavingText: {
    fontFamily: ep.fonts.ui,
    fontSize: 12,
    color: ep.colors.textMuted,
  },
  overlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 4,
  },
  overlineLabel: {
    fontFamily: ep.fonts.ui,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    color: ep.colors.textDim,
  },
  overlineAction: {
    fontFamily: ep.fonts.ui,
    fontSize: 12,
    fontWeight: '600',
    color: ep.colors.flameMid,
  },
  strengthBlock: {
    marginBottom: 22,
    padding: 14,
    borderRadius: ep.spacing.inputRadius,
    backgroundColor: ep.colors.surfaceCard,
    borderWidth: 1,
    borderColor: ep.colors.borderSubtle,
  },
  strengthBlockPressable: {
    ...(Platform.OS === 'web'
      ? { cursor: 'pointer' as const }
      : null),
  },
  strengthBlockPressed: {
    opacity: 0.92,
    borderColor: ep.colors.flameMid,
  },
  strengthTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  strengthPercentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  strengthLabel: {
    fontFamily: ep.fonts.ui,
    fontSize: 13,
    fontWeight: '600',
    color: ep.colors.textPrimary,
  },
  strengthPercent: {
    fontFamily: ep.fonts.ui,
    fontSize: 13,
    fontWeight: '600',
    color: ep.colors.flameMid,
  },
  strengthTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: ep.colors.borderSubtle,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: ep.colors.flameMid,
  },
  strengthMeta: {
    fontFamily: ep.fonts.ui,
    fontSize: 11,
    lineHeight: 16,
    color: ep.colors.textDim,
    marginTop: 8,
  },
  strengthHint: {
    fontFamily: ep.fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: ep.colors.textDim,
    marginTop: 8,
  },
  strengthSheetScroll: {
    maxHeight: 420,
  },
  strengthSheetComplete: {
    fontFamily: ep.fonts.body,
    fontSize: 14,
    lineHeight: 21,
    color: ep.colors.textSecondary,
  },
  strengthSheetGroup: {
    marginBottom: 16,
  },
  strengthSheetGroupLabel: {
    fontFamily: ep.fonts.ui,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: ep.colors.textDim,
    marginBottom: 8,
  },
  strengthSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: ep.colors.borderSubtle,
  },
  strengthSheetRowPressed: {
    opacity: 0.85,
  },
  strengthSheetRowLabel: {
    flex: 1,
    fontFamily: ep.fonts.body,
    fontSize: 15,
    lineHeight: 20,
    color: ep.colors.textPrimary,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: ep.colors.borderDefault,
    backgroundColor: ep.colors.surface,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  tabBarItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  tabBarLabel: {
    fontFamily: ep.fonts.ui,
    fontSize: 10,
    fontWeight: '500',
    color: ep.colors.textDim,
  },
  tabBarLabelActive: {
    color: ep.colors.flameMid,
    fontWeight: '600',
  },
  segmentedControl: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: ep.spacing.inputRadius,
    backgroundColor: ep.colors.surfaceCard,
    borderWidth: 1,
    borderColor: ep.colors.borderSubtle,
    marginBottom: 18,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  segmentActive: {
    backgroundColor: ep.colors.tipCardBg,
    borderWidth: 1,
    borderColor: ep.colors.flameMid,
  },
  segmentLabel: {
    fontFamily: ep.fonts.ui,
    fontSize: 11,
    fontWeight: '500',
    color: ep.colors.textSecondary,
    textAlign: 'center',
  },
  segmentLabelActive: {
    color: ep.colors.flameBright,
    fontWeight: '600',
  },
});
