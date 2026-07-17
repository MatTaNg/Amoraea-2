import { Platform, StatusBar } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

const OVERLAY_GAP = 16;

/** Status-bar inset for absolutely positioned interview chrome (logout, admin bar). */
export function resolveInterviewTopInset(insets: EdgeInsets): number {
  if (insets.top > 0) return insets.top;
  if (Platform.OS === 'android') {
    return StatusBar.currentHeight ?? 24;
  }
  return 0;
}

export function interviewOverlayTop(insets: EdgeInsets): number {
  return resolveInterviewTopInset(insets) + OVERLAY_GAP;
}
