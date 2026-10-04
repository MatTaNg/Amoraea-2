import { AMORAEA_PAGE_LOADING_SIZE, AmoraeaLoadingSpinner } from '@app/screens/AmoraeaLoadingSpinner';
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { theme } from "@/shared/theme/theme";

type Props = {
  /** Optional supporting line under the title (e.g. what is loading). */
  subtitle?: string;
};

/**
 * Full-screen preparing state used after completing an assessment (matches attachment insight loading).
 */
export function AssessmentPreparingResults({ subtitle }: Props) {
  return (
    <View
      style={styles.root}
      accessibilityRole="progressbar"
      accessibilityLabel="Preparing your results"
    >
      <AmoraeaLoadingSpinner size={AMORAEA_PAGE_LOADING_SIZE} />
      <Text style={styles.title}>Preparing your results</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: "100%",
    backgroundColor: theme.colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginTop: 18,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    color: theme.colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
});
