import { StyleSheet } from 'react-native';
import { theme } from '@/shared/theme/theme';
import { onboardingModalLayout } from './onboardingModalLayout';

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
    ...onboardingModalLayout.centeredContainer,
  },
  description: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  secondaryQuestionBlock: {
    marginTop: 30,
    borderTopWidth: 1,
    borderTopColor: 'rgba(82,142,220,0.18)',
    paddingTop: 24,
  },
  secondaryQuestionTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 14,
    lineHeight: 24,
  },
  mustHaveEmphasis: {
    fontWeight: '800',
  },
  option: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
  },
  optionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceElevated,
  },
  optionText: {
    fontSize: 18,
    color: theme.colors.text,
    textAlign: 'center',
  },
  optionTextSelected: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  buttonContainer: onboardingModalLayout.footer,
  buttonRow: onboardingModalLayout.footerButtons,
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 1,
  },
});
