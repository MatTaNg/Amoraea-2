import { getMsSinceWebTabBecameVisible } from './webInterviewGestureContext';
import { hasWebInterviewHtmlAudioTabResumePending } from './webInterviewHtmlAudioTabResume';
import { reprimeSharedHtmlAudioSilentPlay } from './webInterviewSharedHtmlAudio';
import { ensureWebInterviewTtsOutputVolumePrimed } from './webInterviewTtsOutputVolume';
import { ensureSharedWebAudioContextResumedForPlayback } from './webInterviewWebAudioContext';

import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';

export function shouldSkipSilentReprimeForTelemetry(telemetrySource: TtsTelemetrySource): boolean {
  if (hasWebInterviewHtmlAudioTabResumePending()) return true;
  if (telemetrySource !== 'replay') return false;
  const msSinceTabVisible = getMsSinceWebTabBecameVisible();
  return msSinceTabVisible != null && msSinceTabVisible < 20000;
}

export async function ensureWebPlaybackPrimedForNextTurn(
  telemetrySource: TtsTelemetrySource,
  opts?: { skipSilentReprime?: boolean },
): Promise<void> {
  if (!hasWebInterviewHtmlAudioTabResumePending()) {
    ensureWebInterviewTtsOutputVolumePrimed();
  }
  await ensureSharedWebAudioContextResumedForPlayback(telemetrySource);
  if (!opts?.skipSilentReprime && !hasWebInterviewHtmlAudioTabResumePending()) {
    reprimeSharedHtmlAudioSilentPlay();
  }
}
