import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { ariaScreenStyles as styles } from '@features/aria/ariaScreenStyles';

export function AriaAdminInterviewTopBar({
  onOpenPanel,
  onResetInterview,
  onSignOut,
}: {
  onOpenPanel: () => void;
  onResetInterview: () => void;
  onSignOut: () => void;
}): React.ReactElement {
  return (
    <View style={styles.adminTopBarRow}>
      <TouchableOpacity
        style={styles.adminBarButton}
        onPress={onOpenPanel}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Open admin panel"
      >
        <Text style={styles.adminPanelButtonText}>◆ Panel</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.adminBarButtonReset}
        onPress={onResetInterview}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Reset interview from start"
      >
        <Text style={styles.adminResetButtonText}>Reset</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.adminBarButtonLogout}
        onPress={onSignOut}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <Text style={styles.adminLogoutButtonText}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}
