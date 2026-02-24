import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';

interface StepperProps {
  currentStep: number;
  totalSteps: number;
  label?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  currentStep,
  totalSteps,
  label,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.dotsRow}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < currentStep && styles.dotCompleted,
              i === currentStep && styles.dotCurrent,
            ]}
          />
        ))}
      </View>
      <Text style={styles.label}>
        {label ?? `Step ${currentStep + 1} of ${totalSteps}`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotCompleted: {
    backgroundColor: colors.primary,
  },
  dotCurrent: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    opacity: 1,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
