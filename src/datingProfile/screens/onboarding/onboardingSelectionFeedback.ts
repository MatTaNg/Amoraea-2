/** Defer until after the next paint so selected styling can render before auto-advance. */
export function afterOnboardingSelectionFeedback(action: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(action);
  });
}
