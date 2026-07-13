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
    padding: 24,
  },
  description: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  hobbyButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    marginBottom: 20,
  },
  hobbyButtonText: {
    fontSize: 16,
    color: theme.colors.text,
  },
  proLabel: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 12,
    lineHeight: 18,
  },
  proOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  proOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  proOptionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceElevated,
  },
  proOptionText: {
    fontSize: 14,
    color: theme.colors.text,
  },
  buttonContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
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
