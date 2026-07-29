/** Run after the next paint so tap feedback can render before heavy follow-up work. */
export function deferAfterPaint(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => callback());
    return;
  }
  setTimeout(callback, 0);
}
