import { StyleSheet } from 'react-native';
import { theme } from '@/shared/theme/theme';
import { onboardingModalLayout } from '@/datingProfile/screens/onboarding/modals/onboardingModalLayout';

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  pageColumn: {
    ...onboardingModalLayout.pageColumn,
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    ...onboardingModalLayout.scrollContent,
  },
  container: {
    ...onboardingModalLayout.centeredContainer,
  },
  description: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 18,
    lineHeight: 22,
  },
  optionalNote: {
    fontSize: 13,
    color: theme.colors.text2,
    marginBottom: 18,
  },
  buttonContainer: {
    ...onboardingModalLayout.footer,
    width: '100%',
  },
  buttonRow: {
    ...onboardingModalLayout.footerButtons,
  },
  backButton: { flex: 1 },
  nextButton: { flex: 1 },
});
