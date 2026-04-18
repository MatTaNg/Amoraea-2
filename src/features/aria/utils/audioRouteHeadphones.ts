/**
 * Headphone / external mic detection (expo-audio input route) and route fingerprinting for session logs.
 * Web uses enumerateDevices heuristics when permission allows.
 */
import { Platform } from 'react-native';
import type { RecordingInput } from 'expo-audio';
import { inferWebAudioRoutesFromDevices } from '@utilities/sessionLogging/webMediaDeviceAudioRoute';

export type HeadphoneProbeResult = {
  /** Raw input when available */
  input: RecordingInput | null;
  /** Stable string for change detection */
  fingerprint: string | null;
  /** Best-effort classification */
  kind: 'builtin_mic' | 'headset_or_external' | 'unknown';
  /** Show optional start prompt (built-in only, confident) */
  shouldShowHeadphonePrompt: boolean;
};

function fingerprintFromInput(input: RecordingInput | null): string | null {
  if (!input) return null;
  return `${input.uid}|${input.type}|${input.name}`;
}

/** True when the active input appears to be only the device built-in mic. */
export function isBuiltInMicOnly(input: RecordingInput): boolean {
  const s = `${input.type}\n${input.name}`.toLowerCase();
  const looksBuiltIn =
    /built[- ]?in|builtin|internal|iphone microphone|device microphone|ipad microphone|microphone/i.test(s) &&
    !/headphone|headset|airpods|bluetooth|usb|wireless|earphone|buds|beats|jabra|sony|surface|external/.test(s);
  return looksBuiltIn;
}

/** Headphones / BT / USB headset / wired headset with mic — not plain built-in mic only. */
export function isHeadsetOrExternalMicInput(input: RecordingInput): boolean {
  return !isBuiltInMicOnly(input);
}

async function probeNative(): Promise<RecordingInput | null> {
  try {
    const { AudioModule, RecordingPresets } = await import('expo-audio');
    const Recorder = AudioModule.AudioRecorder;
    const rec = new Recorder(RecordingPresets.HIGH_QUALITY);
    try {
      await rec.prepareToRecordAsync();
      return await rec.getCurrentInput();
    } finally {
      try {
        (rec as { remove?: () => void }).remove?.();
      } catch {
        /* ignore */
      }
    }
  } catch (e) {
    if (__DEV__) console.warn('[audioRoute] probe failed', e);
    return null;
  }
}

async function probeWeb(): Promise<RecordingInput | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return null;
  }
  try {
    const inf = await inferWebAudioRoutesFromDevices();
    if (inf.labels_empty && inf.input_route === 'permission_required') {
      return null;
    }
    const syntheticName =
      inf.devices_audit
        .map((d) => d.label)
        .filter(Boolean)
        .join('|')
        .slice(0, 200) || `${inf.input_route}|${inf.output_route}`;
    const looksHeadset = inf.headphones_connected || inf.output_route === 'bluetooth' || inf.output_route === 'airpods';
    const looksBuiltInOnly = inf.input_route === 'built_in_mic' && !looksHeadset;
    return {
      uid: inf.devices_audit.find((d) => d.kind === 'audioinput')?.deviceId ?? 'web-default',
      type: looksHeadset ? 'WebHeadsetHint' : looksBuiltInOnly ? 'WebBuiltInHint' : 'WebUnknown',
      name: syntheticName,
    };
  } catch {
    return null;
  }
}

export async function probeHeadphoneRoute(): Promise<HeadphoneProbeResult> {
  const input = Platform.OS === 'web' ? await probeWeb() : await probeNative();
  const fp = fingerprintFromInput(input);

  if (!input) {
    return {
      input: null,
      fingerprint: null,
      kind: 'unknown',
      shouldShowHeadphonePrompt: false,
    };
  }

  const builtin = isBuiltInMicOnly(input);
  const kind: HeadphoneProbeResult['kind'] = builtin ? 'builtin_mic' : 'headset_or_external';

  return {
    input,
    fingerprint: fp,
    kind,
    /** Only prompt on native when we are confident it's built-in; web hints are softer — still prompt if web says built-in hint */
    shouldShowHeadphonePrompt:
      builtin && (Platform.OS !== 'web' || input.type === 'WebBuiltInHint'),
  };
}
