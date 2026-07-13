import type {
  AlphaModeCongratulationsFailsafeDeps,
  AlphaModeCongratulationsFailsafeTrigger,
} from '@features/aria/interviewPostScoringEffectsTypes';

/** Failsafe: ensure we leave results-loading state when scoring finishes. */
export function runAlphaModeCongratulationsFailsafe(
  deps: AlphaModeCongratulationsFailsafeDeps,
  trigger: AlphaModeCongratulationsFailsafeTrigger,
): void {
  if (!trigger.alphaMode || !trigger.userId) return;
  if (trigger.interviewStatus === 'congratulations') return;
  if (trigger.status !== 'results' || !trigger.hasResults) return;
  if (__DEV__) console.warn('[Amoraea] Failsafe post-interview route triggered');
  deps.clearPreparingResultsSession(trigger.userId);
  deps.setInterviewStatus('congratulations');
}
