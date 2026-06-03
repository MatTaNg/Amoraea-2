import { StyleSheet } from 'react-native';
import { ONBOARDING_MODAL_MAX_WIDTH } from './onboardingModalLayout';
import { theme } from '@/shared/theme/theme';
import { singleChoiceOptionRowStyle } from '@/shared/components/profileFields/SingleChoiceOptionList';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    width: '100%',
    maxWidth: ONBOARDING_MODAL_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  description: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 24,
    lineHeight: 24,
  },
  dealbreakerQuestion: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 8,
    marginTop: 4,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  mustHaveEmphasis: {
    fontWeight: '800',
  },
  dealbreakerPickRow: {
    marginBottom: 12,
  },
  dealbreakerPickText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#E8F0F8',
    lineHeight: 22,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  pickRowLabeled: {
    ...singleChoiceOptionRowStyle,
    marginBottom: 12,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.22)',
    borderRadius: 16,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  rowLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  rowValue: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  lastDealbreakerField: {
    marginTop: 12,
    marginBottom: 6,
  },
  lastDealbreakerLabel: {
    color: '#9CB4D8',
    fontSize: 13,
    marginBottom: 8,
    lineHeight: 18,
    flexWrap: 'wrap',
  },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rangeInput: {
    flex: 1,
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: theme.colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: theme.colors.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rangeDash: {
    color: theme.colors.textSecondary,
  },
  buttonContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(82,142,220,0.18)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: ONBOARDING_MODAL_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 1,
  },
});


