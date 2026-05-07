export function handleApiError(err: unknown, fallback = 'Something went wrong'): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === 'string' ? err : fallback);
}

export function showError(message: string): void {
  if (__DEV__) console.warn('[showError]', message);
}
