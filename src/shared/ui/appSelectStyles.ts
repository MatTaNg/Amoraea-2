import { StyleSheet } from 'react-native';
import { theme } from '@/shared/theme/theme';

/** Shared trigger styling for AppSelect (life-domain / sleep schedule dropdown look). */
export const appSelectStyles = StyleSheet.create({
  trigger: {
    width: '100%',
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    minHeight: 48,
    justifyContent: 'center',
  },
  triggerText: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: '500',
  },
  triggerPlaceholder: {
    color: theme.colors.textSecondary,
    fontWeight: '500',
  },
  chevron: {
    color: 'rgba(156,180,216,0.9)',
  },
});
