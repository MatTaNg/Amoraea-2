/**
 * Shared layout for onboarding modals — matches SingleChoiceModal (centered column + footer).
 */

export const ONBOARDING_MODAL_MAX_WIDTH = 520;

export const onboardingModalLayout = {
  /** Constrains header, scroll body, and footer as one column on wide viewports (web). */
  pageColumn: {
    flex: 1,
    width: '100%' as const,
    maxWidth: ONBOARDING_MODAL_MAX_WIDTH,
    alignSelf: 'center' as const,
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%' as const,
    alignItems: 'center' as const,
  },
  centeredContainer: {
    width: '100%' as const,
    maxWidth: ONBOARDING_MODAL_MAX_WIDTH,
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
    maxWidth: ONBOARDING_MODAL_MAX_WIDTH,
    alignSelf: 'center' as const,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
};
