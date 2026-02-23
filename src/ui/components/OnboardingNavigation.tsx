import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from './Button';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface OnboardingNavigationProps {
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
  nextDisabled?: boolean;
  nextLoading?: boolean;
}

export const OnboardingNavigation: React.FC<OnboardingNavigationProps> = ({
  onBack,
  onNext,
  canGoBack,
  nextDisabled = false,
  nextLoading = false,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
      {canGoBack && (
        <Button
          title="Back"
          onPress={onBack}
          variant="outline"
          style={styles.backButton}
        />
      )}
      <Button
        title="Next"
        onPress={onNext}
        disabled={nextDisabled}
        loading={nextLoading}
        style={styles.nextButton}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  backButton: {
    flex: 1,
    marginRight: spacing.sm,
  },
  nextButton: {
    flex: 1,
    marginLeft: spacing.sm,
  },
});

