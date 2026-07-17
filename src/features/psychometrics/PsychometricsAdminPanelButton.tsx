import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { interviewOverlayTop } from '@features/aria/utils/interviewOverlayInsets';
import { PSYCHOMETRICS_ACCENT } from './psychometricsTheme';

type Props = {
  onPress: () => void;
};

/** Matches Amoraea pre-interview `◆ Panel` control. */
export function PsychometricsAdminPanelButton({ onPress }: Props) {
  const overlayTop = interviewOverlayTop(useSafeAreaInsets());
  return (
    <TouchableOpacity
      style={[styles.button, { top: overlayTop }]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Open admin panel"
    >
      <Text style={styles.label}>◆ Panel</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    right: 16,
    left: undefined,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(30,111,217,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 6,
    zIndex: 100,
  },
  label: {
    fontFamily: Platform.OS === 'web' ? 'Jost, sans-serif' : undefined,
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: PSYCHOMETRICS_ACCENT,
  },
});
