/** Chromium blocks `HTMLAudioElement.play()` without a prior user gesture (mobile Brave, Chrome, etc.). */
export function isWebAudioAutoplayBlockedError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const name = 'name' in err ? String((err as { name?: string }).name) : '';
  const msg = 'message' in err ? String((err as { message?: string }).message) : String(err);
  if (name === 'NotAllowedError') return true;
  if (/not allowed|notallowed|user gesture|interaction/i.test(msg)) return true;
  return false;
}
