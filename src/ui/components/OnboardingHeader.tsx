import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { showConfirmDialog } from '@utilities/alerts/confirmDialog';

type OnboardingHeaderProps = {
  /** Dark navy bar to match auth / pre-interview screens */
  variant?: 'default' | 'dark';
};

export const OnboardingHeader: React.FC<OnboardingHeaderProps> = ({ variant = 'default' }) => {
  const { signOut } = useAuth();
  const dark = variant === 'dark';

  const handleLogOut = () => {
    showConfirmDialog(
      {
        title: 'Log out',
        message: 'Are you sure you want to log out?',
        confirmText: 'Log out',
      },
      () => signOut(),
    );
  };

  return (
    <View style={[styles.banner, dark && styles.bannerDark]}>
      <View style={styles.placeholder} />
      <Text style={[styles.title, dark && styles.titleDark]}>Amoraea (BETA)</Text>
      <TouchableOpacity
        onPress={handleLogOut}
        style={styles.button}
        hitSlop={12}
        accessibilityLabel="Log out"
      >
        <Ionicons name="log-out-outline" size={24} color={dark ? '#5BA8E8' : colors.primary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
    minHeight: 56,
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  button: {
    padding: spacing.sm,
  },
  bannerDark: {
    backgroundColor: '#05060D',
    borderBottomColor: 'rgba(82,142,220,0.15)',
  },
  titleDark: {
    color: '#E8F0F8',
  },
});
