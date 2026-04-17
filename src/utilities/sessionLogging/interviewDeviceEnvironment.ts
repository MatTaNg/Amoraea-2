import { Platform } from 'react-native';
import type { HeadphoneProbeResult } from '@features/aria/utils/audioRouteHeadphones';
import type { InterviewDeviceEnvironmentPayload } from './audioSessionLogEnvelope';

/** Free/available RAM is not exposed cross-platform in JS; log null unless a native source is added later. */
function readAvailableMemoryMb(): number | null {
  return null;
}

/** Best-effort; never throws. */
export async function collectInterviewDeviceEnvironment(
  routeProbe: HeadphoneProbeResult | null
): Promise<InterviewDeviceEnvironmentPayload> {
  let low_power_mode_active = false;
  try {
    // Optional dependency — not in all bundles until installed.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Battery = require('expo-battery') as typeof import('expo-battery');
    const ps = await Battery.getPowerStateAsync();
    low_power_mode_active = !!ps.lowPowerMode;
  } catch {
    low_power_mode_active = false;
  }

  const bluetooth_connected = routeProbe?.kind === 'headset_or_external';
  const name = routeProbe?.input?.name?.toLowerCase() ?? '';
  const bluetooth_device_name =
    bluetooth_connected && /bluetooth|airpod|wireless|buds|beats|jabra|sony|bose/i.test(name)
      ? (routeProbe?.input?.name ?? '').slice(0, 120) || null
      : null;

  let other_app_using_microphone = false;
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
    } catch (e) {
      const name = e && typeof e === 'object' && 'name' in e ? String((e as { name: string }).name) : '';
      if (name === 'NotReadableError' || name === 'AbortError') other_app_using_microphone = true;
    }
  }

  const available_memory_mb = readAvailableMemoryMb();
  return {
    low_power_mode_active,
    thermal_state: 'unknown',
    available_memory_mb,
    low_memory_warning: available_memory_mb != null && available_memory_mb < 512,
    other_app_using_microphone,
    recent_phone_call: false,
    bluetooth_connected,
    bluetooth_device_name,
  };
}

export function shouldWarnHighThermal(env: InterviewDeviceEnvironmentPayload): boolean {
  return env.thermal_state === 'serious' || env.thermal_state === 'critical';
}

/** Map route probe to session_logs `input_route` vocabulary. */
export function mapHeadphoneProbeToSessionInputRoute(probe: HeadphoneProbeResult): string {
  const input = probe.input;
  if (!input) return 'unknown';
  const name = (input.name ?? '').toLowerCase();
  const type = (input.type ?? '').toLowerCase();
  if (probe.kind === 'builtin_mic') return 'built_in_mic';
  if (/airpod/.test(name)) return 'airpods';
  if (/bluetooth|wireless|bt |galaxy buds|pixel buds/.test(name) || /bluetooth/i.test(type)) return 'bluetooth';
  if (/usb|headphone|headset|wired|3\.5|aux|mmcx/.test(name)) return 'wired_headset';
  if (probe.kind === 'headset_or_external') return 'wired_headset';
  return 'unknown';
}
