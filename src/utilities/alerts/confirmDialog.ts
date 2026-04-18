import { Alert, Platform } from 'react-native';

export type ConfirmDialogOptions = {
  title: string;
  message: string;
  cancelText?: string;
  confirmText: string;
  /** @default true */
  destructive?: boolean;
};

/**
 * Cross-platform confirm. On **native** (iOS/Android) uses `Alert.alert`.
 * On **web**, `react-native-web` ships a no-op `Alert` (`static alert() {}`), so we use
 * `window.confirm` / `window.alert` instead — otherwise dialogs never appear (including mobile browsers).
 */
export function showConfirmDialog(options: ConfirmDialogOptions, onConfirm: () => void): void {
  const { title, message, cancelText = 'Cancel', confirmText, destructive = true } = options;
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
    body: JSON.stringify({
      sessionId: 'c61a43',
      location: 'confirmDialog.ts:showConfirmDialog',
      message: 'showConfirmDialog_entry',
      data: { platform: Platform.OS, titleLen: title.length, hypothesisId: 'H2' },
      timestamp: Date.now(),
      runId: 'post-fix',
    }),
  }).catch(() => {});
  // #endregion
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
      body: JSON.stringify({
        sessionId: 'c61a43',
        location: 'confirmDialog.ts:showConfirmDialog',
        message: 'web_window_confirm_branch',
        data: { hypothesisId: 'H2' },
        timestamp: Date.now(),
        runId: 'post-fix',
      }),
    }).catch(() => {});
    // #endregion
    const label = `${title}\n\n${message}\n\n[${cancelText}] / [${confirmText}]`;
    const ok = window.confirm(label);
    if (ok) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelText, style: 'cancel' },
    {
      text: confirmText,
      style: destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}

/** Async variant for flows that need `await` (e.g. delete account). */
export function confirmAsync(options: ConfirmDialogOptions): Promise<boolean> {
  const { title, message, cancelText = 'Cancel', confirmText, destructive = true } = options;
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    const label = `${title}\n\n${message}\n\n[${cancelText}] / [${confirmText}]`;
    return Promise.resolve(window.confirm(label));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
      {
        text: confirmText,
        style: destructive ? 'destructive' : 'default',
        onPress: () => resolve(true),
      },
    ]);
  });
}

/** Simple notice — on web uses `window.alert` because `Alert.alert` is a no-op in react-native-web. */
export function showSimpleAlert(title: string, message: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.alert === 'function') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}
