import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PSYCHOMETRICS_ACCENT, PSYCHOMETRICS_FONT_BODY } from './psychometricsTheme';

type Props = {
  onPress: () => void;
  disabled?: boolean;
  /** Top-left overlay on welcome; below answer options on question screens. */
  variant?: 'floating' | 'inline';
};

export function PsychometricsBackButton({ onPress, disabled, variant = 'floating' }: Props) {
  if (variant === 'inline') {
    return (
      <TouchableOpacity
        style={styles.buttonInline}
        onPress={onPress}
        disabled={disabled}
        activeOpacity={0.8}
        hitSlop={12}
        accessibilityRole="link"
        accessibilityLabel="Go back"
      >
        <View style={styles.inlineContent}>
          <Ionicons name="chevron-back" size={18} color={PSYCHOMETRICS_ACCENT} style={styles.inlineChevron} />
          <Text style={styles.labelInline}>Back</Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.buttonFloating}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Ionicons name="chevron-back" size={22} color={PSYCHOMETRICS_ACCENT} />
      <Text style={styles.labelFloating}>Back</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  buttonFloating: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    paddingHorizontal: 4,
    zIndex: 100,
  },
  buttonInline: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  inlineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  inlineChevron: {
    marginRight: 2,
    marginLeft: -4,
  },
  labelFloating: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 15,
    color: PSYCHOMETRICS_ACCENT,
    ...(Platform.OS === 'web' ? { userSelect: 'none' as const } : {}),
  },
  labelInline: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 14,
    fontWeight: '500',
    color: PSYCHOMETRICS_ACCENT,
    textAlign: 'left',
    ...(Platform.OS === 'web'
      ? ({ userSelect: 'none' as const, textDecorationLine: 'underline' as const } as const)
      : {}),
  },
});
