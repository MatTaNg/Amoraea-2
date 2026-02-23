import React from 'react';
import { TextInput as RNTextInput, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface NumericRangeInputProps {
  label?: string;
  value: number | null;
  min: number;
  max: number;
  onChange: (value: number | null) => void;
  placeholder?: string;
}

export const NumericRangeInput: React.FC<NumericRangeInputProps> = ({
  label,
  value,
  min,
  max,
  onChange,
  placeholder,
}) => {
  const displayValue = value != null ? String(value) : '';

  const handleChange = (text: string) => {
    if (text === '') {
      onChange(null);
      return;
    }
    const num = parseInt(text, 10);
    if (!isNaN(num)) {
      const clamped = Math.min(max, Math.max(min, num));
      onChange(clamped);
    }
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <RNTextInput
        style={styles.input}
        value={displayValue}
        onChangeText={handleChange}
        placeholder={placeholder ?? `${min}-${max}`}
        placeholderTextColor={colors.textSecondary}
        keyboardType="numeric"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.background,
    minHeight: 48,
  },
});
