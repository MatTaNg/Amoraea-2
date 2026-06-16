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
  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.confirm === 'function') {
    const label = message.trim() ? `${title}\n\n${message}` : title;
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
    const label = message.trim() ? `${title}\n\n${message}` : title;
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
