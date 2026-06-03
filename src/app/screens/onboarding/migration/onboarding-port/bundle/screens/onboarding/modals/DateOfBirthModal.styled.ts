import { StyleSheet, Platform } from 'react-native';
import { theme } from '@/shared/theme/theme';
import { onboardingModalLayout } from './onboardingModalLayout';

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
    ...onboardingModalLayout.centeredContainer,
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
  /** Compact birth-time dropdown (not full screen width); matches single-choice option chrome. */
  timePickerWrapper: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    width: TIME_PICKER_WIDTH,
    borderWidth: 2,
    borderColor: theme.colors.border,
    borderRadius: 12,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {} : { minHeight: 58 }),
  },
  timePicker: {
    width: '100%',
    color: theme.colors.text,
    backgroundColor: 'transparent',
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
    minHeight: 56,
    cursor: 'pointer' as const,
    color: theme.colors.text,
    backgroundColor: 'transparent',
  },
  timePickerItem: {
    color: theme.colors.text,
    backgroundColor: '#0f1419',
  },
  timePickerItemPlaceholder: {
    color: theme.colors.textSecondary,
    backgroundColor: '#0f1419',
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
  placeSearchLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  placeSearchLoadingText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
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
  buttonContainer: onboardingModalLayout.footer,
  buttonRow: onboardingModalLayout.footerButtons,
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 1,
  },
});
