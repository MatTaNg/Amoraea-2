import { Alert } from 'react-native';

export type ConfirmDialogOptions = {
  title: string;
  message: string;
  cancelText?: string;
  confirmText: string;
  /** @default true */
  destructive?: boolean;
};

/**
 * Use instead of `window.confirm` — sync browser dialogs are unreliable on mobile Safari,
 * in standalone PWAs, and in embedded webviews. `Alert.alert` works across iOS, Android, and web.
 */
export function showConfirmDialog(options: ConfirmDialogOptions, onConfirm: () => void): void {
  const { title, message, cancelText = 'Cancel', confirmText, destructive = true } = options;
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

/** Simple notice — prefer over `window.alert` on web mobile. */
export function showSimpleAlert(title: string, message: string): void {
  Alert.alert(title, message);
}
