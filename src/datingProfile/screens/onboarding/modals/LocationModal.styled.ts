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
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginBottom: 32,
    lineHeight: 24,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  locationContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  locationLabel: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 8,
    fontWeight: '600',
  },
  locationValue: {
    fontSize: 18,
    color: theme.colors.text,
    fontWeight: '500',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.warning,
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    minWidth: 150,
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

