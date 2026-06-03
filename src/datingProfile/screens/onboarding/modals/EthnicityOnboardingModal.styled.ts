import { StyleSheet } from 'react-native';
import { theme } from '@/shared/theme/theme';
import { onboardingModalLayout } from './onboardingModalLayout';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: {
    ...onboardingModalLayout.centeredContainer,
  },
  description: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 14,
    lineHeight: 24,
  },
  helperText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    lineHeight: 18,
    marginTop: -6,
    marginBottom: 12,
  },
  optionList: { gap: 10, marginBottom: 8 },
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
  divider: {
    marginTop: 28,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: 'rgba(82,142,220,0.18)',
  },
  buttonContainer: onboardingModalLayout.footer,
  buttonRow: onboardingModalLayout.footerButtons,
  backButton: { flex: 1 },
  nextButton: { flex: 1 },
});
