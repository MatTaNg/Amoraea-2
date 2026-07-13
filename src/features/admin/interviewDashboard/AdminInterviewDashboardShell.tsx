import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { dashboardShellStyles as styles } from '@features/admin/interviewDashboard/adminInterviewDashboardShellStyles';

export type AdminInterviewMainViewId =
  | 'overview'
  | 'users'
  | 'feedback'
  | 'compatibility'
  | 'validation';

const MAIN_VIEW_TABS: { id: AdminInterviewMainViewId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'users', label: 'Users' },
  { id: 'feedback', label: 'Feedback' },
  { id: 'compatibility', label: 'Compatibility' },
  { id: 'validation', label: 'Validation' },
];

export function AdminInterviewDashboardShell({
  activeView,
  onChangeView,
  onClose,
  children,
}: {
  activeView: AdminInterviewMainViewId;
  onChangeView: (view: AdminInterviewMainViewId) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.fullScreen}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.backText}>← Back to interview</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          {MAIN_VIEW_TABS.map((tab) => {
            const active = activeView === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => onChangeView(tab.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      {children}
    </View>
  );
}
