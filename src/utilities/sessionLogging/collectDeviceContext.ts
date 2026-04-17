import { Dimensions, Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import type { SessionPlatform } from './writeSessionLog';

export type DeviceContextPayload = {
  platform: SessionPlatform;
  device_model: string | null;
  os_version: string | null;
  app_version: string | null;
  eas_build: string | null;
  screen_width: number;
  screen_height: number;
  network_type: 'wifi' | 'cellular' | 'unknown';
  network_effective_type: '4g' | '3g' | '2g' | 'slow-2g' | null;
  timezone: string;
  hour_of_day: number;
  build_version: string;
};

function getWindowSize(): { width: number; height: number } {
  const d = Dimensions.get('window');
  return { width: Math.round(d.width), height: Math.round(d.height) };
}

/** Best-effort; never throws. */
export async function collectDeviceContext(): Promise<DeviceContextPayload> {
  const { width, height } = getWindowSize();
  const platformOs: SessionPlatform =
    Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

  let device_model: string | null = null;
  let os_version: string | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Device = require('expo-device') as typeof import('expo-device');
    device_model = Device.modelName ?? Device.modelId ?? null;
    if (Platform.OS !== 'web') {
      os_version = Device.osVersion != null && String(Device.osVersion).trim() !== '' ? String(Device.osVersion) : null;
    }
  } catch {
    device_model = Constants.deviceName ?? null;
  }

  if (os_version == null) {
    if (Platform.OS === 'web') {
      os_version =
        typeof navigator !== 'undefined'
          ? (navigator as unknown as { userAgent?: string }).userAgent ?? null
          : null;
    } else {
      os_version = String(Constants.systemVersion ?? '');
    }
  }

  const app_version =
    (Constants.expoConfig?.version as string | undefined) ??
    ((Constants as { manifest?: { version?: string } }).manifest?.version as string | undefined) ??
    (Constants.nativeAppVersion as string | undefined) ??
    null;

  const easBuild =
    (Constants.expoConfig?.ios?.buildNumber as string | undefined) ||
    (Constants.expoConfig?.android?.versionCode != null
      ? String(Constants.expoConfig.android.versionCode)
      : null) ||
    null;

  const updatesChannel = Updates.channel ?? null;
  const runtimeVersion = Updates.runtimeVersion ?? null;
  const eas_build = [easBuild, updatesChannel, runtimeVersion].filter(Boolean).join(' / ') || null;

  let network_type: DeviceContextPayload['network_type'] = 'unknown';
  let network_effective_type: DeviceContextPayload['network_effective_type'] = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const NetInfo = require('@react-native-community/netinfo').default as {
      fetch: () => Promise<{
        type?: string;
        details?: { cellularGeneration?: string };
        isConnected?: boolean | null;
      }>;
    };
    const state = await NetInfo.fetch();
    const t = (state.type ?? '').toLowerCase();
    if (t === 'wifi' || t === 'ethernet') network_type = 'wifi';
    else if (t === 'cellular') network_type = 'cellular';
    const gen = state.details?.cellularGeneration;
    if (gen === '4g') network_effective_type = '4g';
    else if (gen === '3g') network_effective_type = '3g';
    else if (gen === '2g') network_effective_type = '2g';
  } catch {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      const c = (navigator as unknown as { connection?: { effectiveType?: string; type?: string } }).connection;
      if (c?.type === 'wifi') network_type = 'wifi';
      else if (c?.type === 'cellular') network_type = 'cellular';
      const et = c?.effectiveType;
      if (et === '4g') network_effective_type = '4g';
      else if (et === '3g') network_effective_type = '3g';
      else if (et === '2g') network_effective_type = '2g';
      else if (et === 'slow-2g') network_effective_type = 'slow-2g';
    }
  }

  const now = new Date();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  const hour_of_day = now.getHours();

  const build_version = [
    app_version,
    easBuild,
    Updates.updateId ? `update:${Updates.updateId.slice(0, 8)}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  return {
    platform: platformOs,
    device_model,
    os_version,
    app_version,
    eas_build,
    screen_width: width,
    screen_height: height,
    network_type,
    network_effective_type,
    timezone,
    hour_of_day,
    build_version,
  };
}
