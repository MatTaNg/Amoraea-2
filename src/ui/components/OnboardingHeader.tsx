import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { showConfirmDialog } from '@utilities/alerts/confirmDialog';

type OnboardingHeaderProps = {
  /** Dark navy bar to match auth / pre-interview screens */
  variant?: 'default' | 'dark';
  /** When set, shows a back chevron on the left (e.g. edit profile → post-interview). */
  onBackPress?: () => void;
};

export const OnboardingHeader: React.FC<OnboardingHeaderProps> = ({ variant = 'default', onBackPress }) => {
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
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.safeArea, dark && styles.safeAreaDark]}
    >
      <View style={styles.banner}>
        {onBackPress ? (
          <TouchableOpacity
            onPress={onBackPress}
            style={styles.button}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={26} color={dark ? '#5BA8E8' : colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  safeAreaDark: {
    backgroundColor: '#05060D',
    borderBottomColor: 'rgba(82,142,220,0.15)',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
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
  titleDark: {
    color: '#E8F0F8',
  },
});
