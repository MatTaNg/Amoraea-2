/** iOS Safari blocks speechSynthesis unless speak() runs in a user-gesture stack; async LLM/TTS loses the gesture. */
export class WebTtsRequiresUserGestureError extends Error {
  constructor(public readonly text: string) {
    super('WEB_TTS_GESTURE');
    this.name = 'WebTtsRequiresUserGestureError';
  }
}

/**
 * Metro/web may duplicate module scope so `instanceof WebTtsRequiresUserGestureError` is false even for the same
 * logical error — `speakTextSafe` would skip `pendingWebSpeechForGestureRef` and mic tap would do nothing (no T9 logs).
 */
export function isWebTtsRequiresUserGestureError(err: unknown): err is WebTtsRequiresUserGestureError {
  if (err instanceof WebTtsRequiresUserGestureError) return true;
  if (typeof err !== 'object' || err === null) return false;
  const o = err as { name?: string; text?: unknown };
  return o.name === 'WebTtsRequiresUserGestureError' && typeof o.text === 'string';
}
