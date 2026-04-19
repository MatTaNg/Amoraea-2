/**
 * Web: at most one full-screen gesture overlay on the active interview — priority order is fixed.
 */

export type WebActiveGestureOverlayKind = 'none' | 'tab_restore' | 'resume_welcome' | 'pending_tts';

export function resolveWebActiveGestureOverlayKind(input: {
  platformIsWeb: boolean;
  status: string;
  webTabGestureRestoreOverlay: boolean;
  webResumeWelcomeTapPending: boolean;
  isInterviewerView: boolean;
  webDesktopPendingTtsGestureOverlay: boolean;
}): WebActiveGestureOverlayKind {
  if (!input.platformIsWeb || input.status !== 'active') return 'none';
  if (input.webTabGestureRestoreOverlay) return 'tab_restore';
  if (input.webResumeWelcomeTapPending && input.isInterviewerView) return 'resume_welcome';
  if (input.webDesktopPendingTtsGestureOverlay) return 'pending_tts';
  return 'none';
}
