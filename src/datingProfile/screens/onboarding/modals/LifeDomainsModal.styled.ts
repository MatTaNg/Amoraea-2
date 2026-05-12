import { StyleSheet } from 'react-native';
import { theme } from '@/shared/theme/theme';

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
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  description: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 24,
    lineHeight: 22,
  },
  rankingWrapper: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.22)',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 20,
    marginBottom: 24,
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
    maxWidth: 760,
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


