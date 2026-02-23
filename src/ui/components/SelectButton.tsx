import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface SelectButtonProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export const SelectButton: React.FC<SelectButtonProps> = ({ label, selected, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.button, selected && styles.buttonSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    marginBottom: spacing.sm,
  },
  buttonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '10',
  },
  text: {
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  textSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
});

