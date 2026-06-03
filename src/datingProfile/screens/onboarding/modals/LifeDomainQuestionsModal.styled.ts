import { StyleSheet } from 'react-native';
import { theme } from '@/shared/theme/theme';
import { ONBOARDING_MODAL_MAX_WIDTH } from './onboardingModalLayout';

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
    paddingBottom: 24,
  },
  container: {
    width: '100%',
    maxWidth: ONBOARDING_MODAL_MAX_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  domainSection: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.22)',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  domainHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  domainIcon: {
    fontSize: 20,
  },
  domainHeaderText: {
    flex: 1,
  },
  domainName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text,
  },
  domainMeta: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  chevron: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  domainBody: {
    paddingTop: 4,
    gap: 16,
  },
  questionBlock: {
    gap: 8,
  },
  questionSuggestionBlock: {
    gap: 8,
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(82,142,220,0.18)',
  },
  questionText: {
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(238,246,255,0.9)',
    fontWeight: '600',
  },
  textInput: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 15,
    backgroundColor: 'rgba(0,0,0,0.2)',
    textAlignVertical: 'top',
  },
  dropdownTrigger: {
    width: '100%',
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  dropdownTriggerText: {
    color: theme.colors.text,
    fontSize: 15,
  },
  dropdownPlaceholder: {
    color: theme.colors.textSecondary,
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
    maxWidth: ONBOARDING_MODAL_MAX_WIDTH,
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
  pickerWrap: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  picker: {
    color: theme.colors.text,
  },
  requiredBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7EB8F0',
  },
  optionalBadge: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.textSecondary,
  },
  validationError: {
    fontSize: 14,
    color: '#f87171',
    marginBottom: 12,
    lineHeight: 20,
  },
  questionTextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: 6,
  },
});
