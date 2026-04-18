/**
 * Mobile web: infer audio routes from `enumerateDevices` labels + `devicechange`.
 * iOS Safari may return empty labels until mic permission — call after `getUserMedia`.
 */
import { Platform } from 'react-native';
import { remoteLog } from '@utilities/remoteLog';
import { setSessionAudioRoutesFromWebInference } from './audioSessionLogEnvelope';

export type WebInferredOutputRoute =
  | 'speaker'
  | 'headphones'
  | 'bluetooth'
  | 'wired_headset'
  | 'airpods'
  | 'unknown'
  | 'permission_required';

export type WebAudioRouteInference = {
  input_route: string;
  output_route: WebInferredOutputRoute;
  /** null when labels/settings do not allow a confident boolean (prefer null over false). */
  headphones_connected: boolean | null;
  labels_empty: boolean;
  devices_audit: Array<{ deviceId: string; kind: string; label: string; groupId?: string }>;
  enumerate_devices_error: string | null;
  media_track_settings: MediaTrackSettings | null;
  enumeration_debug: {
    device_count: number;
    kinds_present: string[];
    labels_populated_count: number;
    permission_obtained: boolean;
  };
  /** ms from mic permission grant to enumerateDevices call (debugging empty lists on mobile web). */
  time_since_permission_granted_ms: number | null;
  enumerate_devices_result: 'ok' | 'empty_after_retry' | 'error' | 'unavailable';
  /** When neither enumeration nor track settings yield a reliable route. */
  headphone_detection_status: 'ok' | 'unsupported_in_browser_context' | null;
};

function audit(devices: MediaDeviceInfo[]) {
  return devices.map((d) => ({
    deviceId: d.deviceId,
    kind: d.kind,
    label: d.label,
    groupId: d.groupId,
  }));
}

/** Request mic and return active audio track settings (helps when enumerate labels are empty). */
async function getMicStreamAndSettings(): Promise<{
  permission_obtained: boolean;
  settings: MediaTrackSettings | null;
  permissionGrantedAtMs: number | null;
}> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { permission_obtained: false, settings: null, permissionGrantedAtMs: null };
  }
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    const grantedAt = Date.now();
    const track = s.getAudioTracks()[0];
    const settings = track ? { ...track.getSettings() } : null;
    s.getTracks().forEach((t) => t.stop());
    return { permission_obtained: true, settings, permissionGrantedAtMs: grantedAt };
  } catch (e) {
    return { permission_obtained: false, settings: null, permissionGrantedAtMs: null };
  }
}

function inferHeadphonesFromTrackSettings(st: MediaTrackSettings | null): boolean | null {
  if (!st) return null;
  const devId = st.deviceId;
  const g = st.groupId;
  const labelish = `${devId ?? ''}\n${g ?? ''}`.toLowerCase();
  if (!labelish.trim()) return null;
  if (/airpod|bluetooth|headphone|headset|earphone|buds|beats|jabra|sony|bose|usb/i.test(labelish)) {
    if (/bluetooth|wireless|airpod|buds/.test(labelish)) return true;
    if (/headphone|headset|wired|earphone/.test(labelish)) return true;
  }
  return null;
}

function classifyOutputLabels(labels: string[]): {
  route: WebInferredOutputRoute;
  headphones: boolean | null;
} {
  if (labels.length === 0) {
    return { route: 'speaker', headphones: null };
  }
  const joined = labels.join('\n').toLowerCase();
  const hasHeadphoneCue = /headphone|headset|earphone|earpod|buds|beats|jabra|sony|bose|sennheiser|wired|mmcx|aux|3\.5|usb audio/i.test(
    joined
  );
  const hasBluetoothCue = /bluetooth|wireless|bt |galaxy buds|pixel buds|wf-|wh-1000/i.test(joined);

  if (hasBluetoothCue || /airpod/i.test(joined)) {
    if (/airpod/i.test(joined)) return { route: 'airpods', headphones: true };
    return { route: 'bluetooth', headphones: true };
  }
  if (/wired|3\.5|aux|mmcx|usb.*head/i.test(joined) && hasHeadphoneCue) {
    return { route: 'wired_headset', headphones: true };
  }
  if (hasHeadphoneCue) {
    return { route: 'headphones', headphones: true };
  }
  if (/speaker|built[- ]?in|internal|receiver|default|iphone|ipad/i.test(joined) && !hasHeadphoneCue) {
    return { route: 'speaker', headphones: false };
  }
  return { route: 'speaker', headphones: null };
}

function classifyInputLabels(labels: string[]): string {
  const joined = labels.join('\n').toLowerCase();
  if (!joined.trim()) return 'unknown';
  if (/airpod/i.test(joined)) return 'airpods';
  if (/bluetooth|wireless|galaxy buds|pixel buds|bt /.test(joined)) return 'bluetooth';
  if (/headphone|headset|earpod|earphone|wired|usb|aux|mmcx/.test(joined)) return 'wired_headset';
  if (/built[- ]?in|internal|iphone microphone|ipad microphone|default|microphone/i.test(joined)) return 'built_in_mic';
  return 'built_in_mic';
}

function readAudioSessionState(): string | null {
  try {
    const AS = (navigator as unknown as { audioSession?: { state?: string } }).audioSession;
    if (AS?.state) return String(AS.state);
  } catch {
    /* ignore */
  }
  return null;
}

function labelsEmpty(devices: MediaDeviceInfo[]): boolean {
  return devices.length > 0 && devices.every((d) => !d.label || d.label.trim() === '');
}

export function inferWebAudioRoutesFromDeviceList(
  devices: MediaDeviceInfo[],
  ctx: {
    enumerate_devices_error: string | null;
    media_track_settings: MediaTrackSettings | null;
    permission_obtained: boolean;
    time_since_permission_granted_ms: number | null;
    enumerate_devices_result: WebAudioRouteInference['enumerate_devices_result'];
  }
): WebAudioRouteInference {
  const enumeration_debug = {
    device_count: devices.length,
    kinds_present: [...new Set(devices.map((d) => d.kind))],
    labels_populated_count: devices.filter((d) => d.label && d.label.trim() !== '').length,
    permission_obtained: ctx.permission_obtained,
  };

  void remoteLog('[AUDIO_ROUTE] enumerate_devices_snapshot', {
    ...enumeration_debug,
    enumerate_devices_error: ctx.enumerate_devices_error,
    has_track_settings: ctx.media_track_settings != null,
    time_since_permission_granted_ms: ctx.time_since_permission_granted_ms,
    enumerate_devices_result: ctx.enumerate_devices_result,
    active_track_settings: ctx.media_track_settings,
  });

  const trackHp = inferHeadphonesFromTrackSettings(ctx.media_track_settings);

  if (devices.length === 0 && !ctx.enumerate_devices_error) {
    const unsupported =
      ctx.enumerate_devices_result === 'empty_after_retry' && trackHp == null ? 'unsupported_in_browser_context' : null;
    return {
      input_route: 'unknown',
      output_route: 'unknown',
      headphones_connected: null,
      labels_empty: true,
      devices_audit: [],
      enumerate_devices_error: null,
      media_track_settings: ctx.media_track_settings,
      enumeration_debug,
      time_since_permission_granted_ms: ctx.time_since_permission_granted_ms,
      enumerate_devices_result: ctx.enumerate_devices_result,
      headphone_detection_status: unsupported,
    };
  }

  const empty = devices.length === 0 || labelsEmpty(devices);

  if (empty) {
    const asSt = readAudioSessionState();
    const unsupported =
      ctx.enumerate_devices_result === 'empty_after_retry' && trackHp == null && !asSt
        ? 'unsupported_in_browser_context'
        : null;
    if (asSt) {
      return {
        input_route: 'built_in_mic',
        output_route: 'speaker',
        headphones_connected: trackHp ?? false,
        labels_empty: true,
        devices_audit: audit(devices),
        enumerate_devices_error: ctx.enumerate_devices_error,
        media_track_settings: ctx.media_track_settings,
        enumeration_debug,
        time_since_permission_granted_ms: ctx.time_since_permission_granted_ms,
        enumerate_devices_result: ctx.enumerate_devices_result,
        headphone_detection_status: unsupported,
      };
    }
    return {
      input_route: ctx.permission_obtained ? 'permission_required' : 'permission_required',
      output_route: ctx.permission_obtained ? 'permission_required' : 'permission_required',
      headphones_connected: trackHp,
      labels_empty: true,
      devices_audit: audit(devices),
      enumerate_devices_error: ctx.enumerate_devices_error,
      media_track_settings: ctx.media_track_settings,
      enumeration_debug,
      time_since_permission_granted_ms: ctx.time_since_permission_granted_ms,
      enumerate_devices_result: ctx.enumerate_devices_result,
      headphone_detection_status: unsupported,
    };
  }

  const inputs = devices.filter((d) => d.kind === 'audioinput');
  const outputs = devices.filter((d) => d.kind === 'audiooutput');
  const inLabs = inputs.map((d) => d.label.trim()).filter(Boolean);
  const outLabs = outputs.map((d) => d.label.trim()).filter(Boolean);

  const out = classifyOutputLabels(outLabs);
  const input_route = classifyInputLabels(inLabs);
  let headphones_connected: boolean | null = out.headphones;
  if (headphones_connected == null && trackHp != null) {
    headphones_connected = trackHp;
  }

  return {
    input_route,
    output_route: out.route,
    headphones_connected,
    labels_empty: false,
    devices_audit: audit(devices),
    enumerate_devices_error: ctx.enumerate_devices_error,
    media_track_settings: ctx.media_track_settings,
    enumeration_debug,
    time_since_permission_granted_ms: ctx.time_since_permission_granted_ms,
    enumerate_devices_result: ctx.enumerate_devices_result,
    headphone_detection_status: null,
  };
}

export async function inferWebAudioRoutesFromDevices(): Promise<WebAudioRouteInference> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') {
    return {
      input_route: 'unknown',
      output_route: 'unknown',
      headphones_connected: null,
      labels_empty: true,
      devices_audit: [],
      enumerate_devices_error: 'not_web',
      media_track_settings: null,
      enumeration_debug: {
        device_count: 0,
        kinds_present: [],
        labels_populated_count: 0,
        permission_obtained: false,
      },
      time_since_permission_granted_ms: null,
      enumerate_devices_result: 'unavailable',
      headphone_detection_status: 'unsupported_in_browser_context',
    };
  }

  const { permission_obtained, settings: media_track_settings, permissionGrantedAtMs } = await getMicStreamAndSettings();

  let devices: MediaDeviceInfo[] = [];
  let enumerate_devices_error: string | null = null;
  let enumerate_devices_result: WebAudioRouteInference['enumerate_devices_result'] = 'ok';
  let time_since_permission_granted_ms: number | null = null;

  if (!navigator.mediaDevices?.enumerateDevices) {
    enumerate_devices_error = 'enumerateDevices_unavailable';
    enumerate_devices_result = 'unavailable';
    void remoteLog('[AUDIO_ROUTE] enumerateDevices_error', { message: enumerate_devices_error });
  } else {
    try {
      const enumT0 = Date.now();
      time_since_permission_granted_ms =
        permissionGrantedAtMs != null ? enumT0 - permissionGrantedAtMs : null;
      devices = await navigator.mediaDevices.enumerateDevices();
      if (devices.length === 0) {
        await new Promise<void>((r) => setTimeout(r, 500));
        devices = await navigator.mediaDevices.enumerateDevices();
        if (devices.length === 0) {
          enumerate_devices_result = 'empty_after_retry';
          void remoteLog('[AUDIO_ROUTE] enumerateDevices_empty_after_retry', {
            time_since_permission_granted_ms,
            active_track_settings: media_track_settings,
          });
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      enumerate_devices_error = message;
      enumerate_devices_result = 'error';
      void remoteLog('[AUDIO_ROUTE] enumerateDevices_error', {
        message,
        name: e instanceof Error ? e.name : 'unknown',
        permission_obtained,
        time_since_permission_granted_ms,
      });
    }
  }

  void remoteLog('[AUDIO_ROUTE] enumeration_timing', {
    time_since_permission_granted_ms,
    enumerate_devices_result,
    device_count: devices.length,
    active_track_settings: media_track_settings,
  });

  return inferWebAudioRoutesFromDeviceList(devices, {
    enumerate_devices_error,
    media_track_settings,
    permission_obtained,
    time_since_permission_granted_ms,
    enumerate_devices_result,
  });
}

export type WebRouteRefreshResult = {
  inference: WebAudioRouteInference;
  changed: boolean;
  previous: { input_route: string; output_route: string } | null;
};

let lastInputRoute: string | null = null;
let lastOutputRoute: string | null = null;

/**
 * Refresh route state from devices, update session envelope, detect change vs last refresh.
 */
export async function refreshWebAudioRoutesForSession(): Promise<WebRouteRefreshResult> {
  const inf = await inferWebAudioRoutesFromDevices();
  const prevIn = lastInputRoute;
  const prevOut = lastOutputRoute;
  const hadPrior = lastInputRoute != null && lastOutputRoute != null;
  const changed =
    hadPrior && (prevIn !== inf.input_route || prevOut !== inf.output_route);
  lastInputRoute = inf.input_route;
  lastOutputRoute = inf.output_route;
  setSessionAudioRoutesFromWebInference({
    input_route: inf.input_route,
    output_route: inf.output_route,
    headphones_connected: inf.headphones_connected,
    devices_audit: inf.devices_audit,
    active_track_settings:
      inf.media_track_settings != null ? { ...inf.media_track_settings } : null,
    headphone_detection_status: inf.headphone_detection_status,
    enumerate_devices_result: inf.enumerate_devices_result,
    time_since_permission_granted_ms: inf.time_since_permission_granted_ms,
  });
  return {
    inference: inf,
    changed,
    previous: changed && prevIn != null && prevOut != null ? { input_route: prevIn, output_route: prevOut } : null,
  };
}

export function resetWebAudioRouteSessionFingerprint(): void {
  lastInputRoute = null;
  lastOutputRoute = null;
}

export function subscribeWebAudioDeviceChange(onChange: () => void): () => void {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.addEventListener) {
    return () => {};
  }
  const md = navigator.mediaDevices;
  const handler = (): void => {
    onChange();
  };
  md.addEventListener('devicechange', handler);
  return () => md.removeEventListener('devicechange', handler);
}
