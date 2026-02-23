import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';

interface ScaleSelectProps {
  label?: string;
  value: number | null;
  min: number;
  max: number;
  onSelect: (value: number) => void;
  error?: string;
  /** Optional label shown under the min value (e.g. "Least important") */
  minLabel?: string;
  /** Optional label shown under the max value (e.g. "Most important") */
  maxLabel?: string;
}

export const ScaleSelect: React.FC<ScaleSelectProps> = ({
  label,
  value,
  min,
  max,
  onSelect,
  error,
  minLabel,
  maxLabel,
}) => {
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.row}>
        {options.map((n) => (
          <View key={n} style={styles.optionWrapper}>
            <TouchableOpacity
              style={[styles.option, value === n && styles.optionSelected]}
              onPress={() => onSelect(n)}
            >
              <Text style={[styles.optionText, value === n && styles.optionTextSelected]}>{n}</Text>
            </TouchableOpacity>
            {n === min && minLabel ? (
              <Text style={styles.optionSubtext} numberOfLines={1}>{minLabel}</Text>
            ) : null}
            {n === max && maxLabel ? (
              <Text style={styles.optionSubtext} numberOfLines={1}>{maxLabel}</Text>
            ) : null}
          </View>
        ))}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
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
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  optionWrapper: {
    alignItems: 'center',
    minWidth: 36,
  },
  option: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '20',
  },
  optionText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  optionSubtext: {
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
    maxWidth: 44,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: spacing.xs,
  },
});
