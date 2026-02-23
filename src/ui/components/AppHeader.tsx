import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';

export const AppHeader: React.FC = () => {
  const navigation = useNavigation();
  const { signOut } = useAuth();
  const canGoBack = navigation.canGoBack();

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
      <Text style={styles.title}>Amoraea</Text>
      <View style={[styles.side, styles.sideRight]}>
        <TouchableOpacity onPress={() => signOut()} style={styles.button} hitSlop={12}>
          <Text style={styles.logoutText}>Log out</Text>
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
  logoutText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
});
