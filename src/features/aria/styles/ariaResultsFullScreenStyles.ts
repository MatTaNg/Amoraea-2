import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';

export const ariaResultsFullScreenStyles = {
  resultsContent: { padding: spacing.lg, paddingBottom: spacing.xxl },
  resultsHead: { fontSize: 11, color: colors.primary, letterSpacing: 2, marginBottom: spacing.sm },
  resultsTitle: { fontSize: 24, fontWeight: '600', color: colors.text, marginBottom: spacing.md },
  resultsSummary: { fontSize: 15, color: colors.textSecondary, lineHeight: 22, marginBottom: spacing.lg },
  pillarCard: { backgroundColor: colors.surface, borderLeftWidth: 4, padding: spacing.md, marginBottom: spacing.md, borderRadius: 8 },
  pillarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pillarName: { fontSize: 15, color: colors.text },
  pillarScore: { fontSize: 18, fontWeight: '600' },
  pillarEvidence: { fontSize: 13, color: colors.textSecondary, fontStyle: 'italic', lineHeight: 20 },
  inconsistenciesBlock: { backgroundColor: colors.primary + '12', padding: spacing.md, marginBottom: spacing.lg, borderRadius: 8 },
  inconsistenciesTitle: { fontSize: 11, color: colors.primary, letterSpacing: 1, marginBottom: spacing.sm },
  inconsistenciesText: { fontSize: 14, color: colors.text, lineHeight: 20, marginBottom: 4 },
  resultsButton: { marginTop: spacing.md },
} as const;
