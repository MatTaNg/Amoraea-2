/** Benign expo-av errors when the OS invalidated recording while JS still held a ref. */
export function isStaleNativeRecorderError(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes('recorder does not exist') ||
    msg.includes('recording does not exist') ||
    msg.includes('already been unloaded') ||
    msg.includes('not prepared')
  );
}
