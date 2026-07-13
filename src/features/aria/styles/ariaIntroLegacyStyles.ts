import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';

export const ariaIntroLegacyStyles = {
  ariaBadge: { alignItems: 'center', marginBottom: spacing.xl },
  ariaName: { fontSize: 26, fontWeight: '700', color: colors.text, marginTop: spacing.sm },
  ariaTagline: { fontSize: 15, color: colors.textSecondary, marginTop: spacing.xs },
  introTitle: { fontSize: 22, fontWeight: '600', color: colors.text, textAlign: 'center', marginBottom: spacing.md },
  introHint: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.sm },
  introNote: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  micErrorBlock: { backgroundColor: colors.error + '15', padding: spacing.md, marginBottom: spacing.md, borderRadius: 8 },
  micErrorText: { fontSize: 14, color: colors.error },
  micWarningBlock: { backgroundColor: colors.warning + '20', padding: spacing.md, marginBottom: spacing.md, borderRadius: 8 },
  micWarningText: { fontSize: 14, color: colors.warning },
  introButton: { marginTop: spacing.sm },
} as const;
