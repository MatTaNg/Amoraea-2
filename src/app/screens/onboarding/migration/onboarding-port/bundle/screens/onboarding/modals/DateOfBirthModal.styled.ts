import { StyleSheet, Platform } from 'react-native';
import { theme } from '@/shared/theme/theme';

const TIME_PICKER_WIDTH = 200;
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
  fieldGap: {
    marginBottom: 16,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: theme.colors.textSecondary,
  },
  /** Compact birth-time dropdown (not full screen width). */
  timePickerWrapper: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    width: TIME_PICKER_WIDTH,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 10,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {} : { minHeight: 56 }),
  },
  timePicker: {
    width: '100%',
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
    ...(Platform.OS === 'ios'
      ? { height: 148 }
      : Platform.OS === 'android'
        ? { height: 56 }
        : {}),
  },
  /** Web maps Picker to select; removes default light outline/border so only the wrapper shows. */
  timePickerWeb: {
    borderWidth: 0,
    outlineStyle: 'none',
    outlineWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 12,
    minHeight: 54,
    cursor: 'pointer' as const,
    color: theme.colors.text,
    backgroundColor: theme.colors.card,
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
