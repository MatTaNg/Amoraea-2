import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type AssessmentHeaderProps = {
  /** 1-based index in the onboarding battery; omit until known (avoids flashing "1 of 4"). */
  assessmentIndex?: number | null;
  currentQ: number;
  totalQ: number;
  assessmentName: string;
  /** Total number of assessments in the onboarding battery. */
  totalAssessments: number;
  subtitle?: string;
};

/**
 * Sits at the top of the question card: battery position, instrument title, then a clear
 * handoff into the current question (no duplicate “Question N” blocks).
 */
export const AssessmentHeader: React.FC<AssessmentHeaderProps> = ({
  assessmentIndex,
  currentQ,
  totalQ,
  assessmentName,
  totalAssessments,
  subtitle,
}) => {
  const showBattery =
    assessmentIndex != null &&
    assessmentIndex >= 1 &&
    assessmentIndex <= totalAssessments;
  return (
    <View style={styles.wrap}>
      {showBattery ? (
        <Text style={styles.battery}>
          Assessment {assessmentIndex} of {totalAssessments}
        </Text>
      ) : null}
      <Text style={styles.title}>{assessmentName}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.divider} />
      <Text style={styles.questionHandoff}>
        Question {currentQ} of {totalQ}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'stretch',
    marginBottom: 18,
    paddingBottom: 4,
  },
  battery: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(156, 180, 216, 0.85)',
    textAlign: 'left',
    marginBottom: 8,
    letterSpacing: 0.15,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#EEF6FF',
    textAlign: 'left',
    lineHeight: 26,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(156, 180, 216, 0.92)',
    lineHeight: 21,
    textAlign: 'left',
    marginBottom: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginTop: 14,
    marginBottom: 14,
  },
  questionHandoff: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(200, 217, 238, 0.95)',
    textAlign: 'left',
    lineHeight: 20,
    marginBottom: 4,
  },
});
