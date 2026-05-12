/**
 * Shared layout for onboarding modals — matches SingleChoiceModal (centered column + footer).
 */

export const onboardingModalLayout = {
  centeredContainer: {
    width: '100%' as const,
    maxWidth: 720,
    alignSelf: 'center' as const,
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(82,142,220,0.18)',
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  footerButtons: {
    flexDirection: 'row' as const,
    gap: 12,
    width: '100%' as const,
    maxWidth: 720,
    alignSelf: 'center' as const,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
};
