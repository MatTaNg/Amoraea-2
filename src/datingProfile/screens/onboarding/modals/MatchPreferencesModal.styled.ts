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
    ...onboardingModalLayout.scrollContent,
  },
  container: {
    ...onboardingModalLayout.centeredContainer,
  },
  questionBlock: {},
  questionBlockSpaced: {
    marginTop: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(82,142,220,0.18)',
    paddingTop: 24,
  },
  questionTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 14,
    lineHeight: 24,
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
