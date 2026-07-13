import type { MutableRefObject } from 'react';
import { Platform } from 'react-native';

import type { AudioRouteKind } from '@features/aria/config/audioRouteRuntime';
import {
  refreshAudioSessionAfterRouteChange,
} from '@features/aria/utils/audioModeHelpers';
import { probeHeadphoneRoute } from '@features/aria/utils/audioRouteHeadphones';
import type { HeadphoneProbeResult } from '@features/aria/utils/audioRouteHeadphones';
import { getSessionLogRuntime } from '@utilities/sessionLogging/sessionLogContext';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';
import { syncWebAudioRouteSessionEnvelopeFromCache } from '@utilities/sessionLogging/webMediaDeviceAudioRoute';
export type RouteProbeAfterResumeSource = 'app_resume' | 'media_services_reset';

export type ApplyRouteProbeAfterResumeDeps = {
  userIdRef: MutableRefObject<string | undefined>;
  lastAudioRouteFingerprintRef: MutableRefObject<string | null>;
  lastHeadphoneProbeRef: MutableRefObject<HeadphoneProbeResult | null>;
  setAudioRouteKind: React.Dispatch<React.SetStateAction<AudioRouteKind>>;
};

/** After foreground resume or native recording `mediaServicesDidReset` — re-probe input route and refresh session if it changed. */
export async function runApplyRouteProbeAfterResume(
  deps: ApplyRouteProbeAfterResumeDeps,
  source: RouteProbeAfterResumeSource,
): Promise<void> {
  const uid = deps.userIdRef.current;
  if (!uid) return;
  if (Platform.OS === 'web') {
    syncWebAudioRouteSessionEnvelopeFromCache();
    return;
  }
  const p = await probeHeadphoneRoute();
  const prev = deps.lastAudioRouteFingerprintRef.current;
  if (p.fingerprint != null && prev != null && p.fingerprint !== prev) {
    deps.lastHeadphoneProbeRef.current = p;
    deps.setAudioRouteKind(p.kind);
    deps.lastAudioRouteFingerprintRef.current = p.fingerprint;
    const r = getSessionLogRuntime();
    writeSessionLog({
      userId: uid,
      attemptId: r.attemptId,
      eventType: 'audio_route_changed',
      eventData: {
        previous_fingerprint: prev,
        fingerprint: p.fingerprint,
        kind: p.kind,
        source,
      },
      platform: r.platform,
    });
    await refreshAudioSessionAfterRouteChange(source);
  } else if (p.fingerprint != null) {
    deps.lastHeadphoneProbeRef.current = p;
    deps.lastAudioRouteFingerprintRef.current = p.fingerprint;
    deps.setAudioRouteKind(p.kind);
  }
}
