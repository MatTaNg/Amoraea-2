/**
 * Web-only Supabase Auth lock: run the callback without `navigator.locks` / AbortSignal races
 * (see `client.ts`). Exported for unit tests.
 */
export const webAuthNoopLock = async <R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => fn();
