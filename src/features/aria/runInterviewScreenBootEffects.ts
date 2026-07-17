import type { AriaScreenBootEffectsDeps } from '@features/aria/interviewClosingQuestionTypes';

export function runSyncValidationTrackInterviewHandoff(
  setValidationTrackInterviewHandoffActive: AriaScreenBootEffectsDeps['setValidationTrackInterviewHandoffActive'],
  fromValidationTrack: boolean,
): () => void {
  setValidationTrackInterviewHandoffActive(fromValidationTrack);
  return () => setValidationTrackInterviewHandoffActive(false);
}

export function runLogAriaScreenDevEnvCheck(deps: {
  alphaMode: boolean;
  anthropicApiKey: string | undefined;
  anthropicProxyUrl: string | undefined;
  getResolvedSupabaseUrl: () => string | null | undefined;
}): void {
  const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
  if (!isDev && !deps.alphaMode) return;
  const hasAnthropic = !!deps.anthropicApiKey;
  const hasProxy = !!deps.anthropicProxyUrl;
  const hasSupabase = !!deps.getResolvedSupabaseUrl();
  if (isDev) {
    console.log('Amoraea interview env check:', {
      hasAnthropicKey: hasAnthropic,
      hasProxyUrl: hasProxy,
      hasSupabaseUrl: hasSupabase,
    });
  }
}

export function runLogAriaScreenMounted(
  deps: Pick<AriaScreenBootEffectsDeps, 'remoteLog'>,
  trigger: { userId: string | undefined; isAdmin: boolean },
): void {
  void deps.remoteLog('[INIT] Amoraea interview mounted', {
    userId: trigger.userId ?? null,
    isAdmin: trigger.isAdmin,
  });
}

export function runBumpAriaScreenMountGeneration(
  _bumpAriaScreenMountGeneration: AriaScreenBootEffectsDeps['bumpAriaScreenMountGeneration'],
): void {
  /* no-op — browser mount-generation gesture tracking removed */
}
