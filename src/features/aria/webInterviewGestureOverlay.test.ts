import { resolveWebActiveGestureOverlayKind, type WebActiveGestureOverlayKind } from './webInterviewGestureOverlay';

const base = {
  platformIsWeb: true,
  status: 'active' as const,
  webTabGestureRestoreOverlay: false,
  webResumeWelcomeTapPending: false,
  isInterviewerView: true,
  webDesktopPendingTtsGestureOverlay: false,
};

function assertKind(
  kind: WebActiveGestureOverlayKind,
  overrides: Partial<typeof base>
): void {
  expect(resolveWebActiveGestureOverlayKind({ ...base, ...overrides })).toBe(kind);
}

describe('resolveWebActiveGestureOverlayKind', () => {
  it('returns none when not web', () => {
    assertKind('none', { platformIsWeb: false });
  });

  it('returns none when status is not active', () => {
    assertKind('none', { status: 'intro' });
  });

  it('prioritizes tab_restore over everything else', () => {
    assertKind('tab_restore', {
      webTabGestureRestoreOverlay: true,
      webResumeWelcomeTapPending: true,
      webDesktopPendingTtsGestureOverlay: true,
    });
  });

  it('returns resume_welcome when tab is clear and resume pending on interviewer view', () => {
    assertKind('resume_welcome', {
      webResumeWelcomeTapPending: true,
      isInterviewerView: true,
    });
  });

  it('does not return resume_welcome when not interviewer view', () => {
    assertKind('pending_tts', {
      webResumeWelcomeTapPending: true,
      isInterviewerView: false,
      webDesktopPendingTtsGestureOverlay: true,
    });
  });

  it('returns pending_tts when gesture-queued TTS is pending', () => {
    assertKind('pending_tts', { webDesktopPendingTtsGestureOverlay: true });
  });

  it('returns none when active interview and no overlay flags', () => {
    assertKind('none', {});
  });
});
