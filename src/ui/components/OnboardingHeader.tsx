import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';

export const OnboardingHeader: React.FC = () => {
  const { signOut } = useAuth();

  const handleLogOut = () => {
    if (Platform.OS === 'web') {
      const ok = typeof window !== 'undefined' && window.confirm('Are you sure you want to log out?');
      if (ok) signOut();
      return;
    }
    Alert.alert(
      'Log out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: () => signOut() },
      ]
    );
  };

  return (
    <View style={styles.banner}>
      <View style={styles.placeholder} />
      <Text style={styles.title}>Amoraea</Text>
      <TouchableOpacity
        onPress={handleLogOut}
        style={styles.button}
        hitSlop={12}
        accessibilityLabel="Log out"
      >
        <Ionicons name="log-out-outline" size={24} color={colors.primary} />
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
});
