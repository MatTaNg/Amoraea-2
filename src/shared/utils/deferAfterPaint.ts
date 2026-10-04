/** Run after the next paint so tap feedback can render before heavy follow-up work. */
export function deferAfterPaint(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => callback());
    return;
  }
  setTimeout(callback, 0);
}

/**
 * Run after navigation has been committed and the next frame can paint.
 * The scheduled callback must stay off the tap turn so a save cannot block the page change.
 */
export function deferAfterNavigationPaint(callback: () => void): void {
  const run = () => {
    // Yield past the navigation frame so a large save cannot freeze the page change.
    setTimeout(callback, 48);
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => {
      requestAnimationFrame(run);
    });
    return;
  }
  setTimeout(callback, 0);
}
