import { StyleSheet } from 'react-native';
import { theme } from '@/shared/theme/theme';

const LOCATION_FIELD_WIDTH = 300;

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
  errorText: {
    fontSize: 14,
    color: theme.colors.error,
    marginTop: 12,
  },
  optionalSection: {
    marginTop: 28,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  optionalHint: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  /** Location field + suggestions share a readable but non-full-bleed width. */
  optionalLocationNarrow: {
    alignSelf: 'flex-start',
    width: LOCATION_FIELD_WIDTH,
    maxWidth: '100%',
  },
  locationHint: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 6,
    marginBottom: 4,
    lineHeight: 16,
  },
  suggestionsContainer: {
    marginTop: 4,
    marginBottom: 8,
    maxHeight: 220,
  },
  suggestionButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: theme.colors.card,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  suggestionText: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  buttonContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.card,
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
