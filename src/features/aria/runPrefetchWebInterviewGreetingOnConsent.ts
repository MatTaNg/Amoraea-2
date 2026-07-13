export type InterviewWebGreetingPrefetchSignal = {
  isCancelled: () => boolean;
};

export type InterviewWebGreetingPrefetchDeps = {
  hasAnthropicConfigured: boolean;
};

/** Web: prefetch greeting MP3 during consent so Begin Interview can call `play()` synchronously. */
export async function runPrefetchWebInterviewGreetingOnConsent(
  deps: InterviewWebGreetingPrefetchDeps,
  signal: InterviewWebGreetingPrefetchSignal,
): Promise<void> {
  if (!deps.hasAnthropicConfigured) return;
  const { prefetchWebInterviewGreetingMp3 } = await import(
    '@features/aria/utils/webInterviewGreetingAudio'
  );
  const ok = await prefetchWebInterviewGreetingMp3();
  if (!signal.isCancelled() && !ok && __DEV__) {
    console.warn('[Amoraea] Greeting MP3 prefetch failed — fallback TTS may require extra gesture work');
  }
}
