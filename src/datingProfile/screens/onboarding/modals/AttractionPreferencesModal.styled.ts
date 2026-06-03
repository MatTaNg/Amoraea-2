import { StyleSheet } from 'react-native';
import { theme } from '@/shared/theme/theme';
import { ONBOARDING_MODAL_MAX_WIDTH } from './onboardingModalLayout';

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
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.22)',
    borderRadius: 16,
    overflow: 'visible',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  row: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  lastRow: {
    borderBottomWidth: 0,
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
    marginBottom: 12,
  },
  question: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
    marginBottom: 12,
  },
  helperText: {
    color: theme.colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -4,
    marginBottom: 10,
  },
  optionList: {
    gap: 10,
  },
  optionRow: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  optionRowSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(91,168,232,0.2)',
  },
  optionText: {
    color: '#C8D9EE',
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 22,
  },
  optionTextSelected: {
    color: '#EEF6FF',
    fontWeight: '600',
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
