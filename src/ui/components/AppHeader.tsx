import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';
import { showConfirmDialog } from '@utilities/alerts/confirmDialog';

export const AppHeader: React.FC = () => {
  const navigation = useNavigation();
  const { signOut } = useAuth();
  const canGoBack = navigation.canGoBack();

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
    <View style={styles.banner}>
      <View style={[styles.side, styles.sideLeft]}>
        {canGoBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.button} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
      <Text style={styles.title}>Amoraea (BETA)</Text>
      <View style={[styles.side, styles.sideRight]}>
        <TouchableOpacity onPress={handleLogOut} style={styles.button} hitSlop={12} accessibilityLabel="Log out">
          <Ionicons name="log-out-outline" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>
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
  side: {
    minWidth: 80,
  },
  sideLeft: {
    alignItems: 'flex-start',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  placeholder: {
    width: 40,
    height: 40,
  },
  button: {
    padding: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    pointerEvents: 'none',
  },
});
