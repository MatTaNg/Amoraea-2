import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/shared/theme/theme';
import { useOnboardingHeaderExit } from './onboardingHeaderExitContext';

interface OnboardingHeaderProps {
  title: string;
  /** Footer / in-step back; header arrow prefers {@link useOnboardingHeaderExit} when set. */
  onBack?: () => void;
}

export const OnboardingHeader: React.FC<OnboardingHeaderProps> = ({ title, onBack }) => {
  const exitToPostInterview = useOnboardingHeaderExit();
  const onHeaderPress = exitToPostInterview ?? onBack;

  return (
    <View style={styles.header}>
      <View style={styles.side}>
        {onHeaderPress ? (
          <TouchableOpacity
            onPress={onHeaderPress}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={
              exitToPostInterview ? 'Return to interview results' : 'Go back'
            }
          >
            <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.side} />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.18)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  side: {
    width: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    flexShrink: 1,
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text,
    fontFamily: 'SpaceMono',
    textAlign: 'center',
    letterSpacing: 0.2,
    lineHeight: 22,
  },
});

