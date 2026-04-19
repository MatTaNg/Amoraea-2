/**
 * Web: build getUserMedia audio constraints that prefer the browser's logical default (or communications)
 * input when those device IDs appear in enumerateDevices — avoids locking to a stale non-default hardware ID.
 */
import { Platform } from 'react-native';

export const WEB_MIC_PROCESSING_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
} as const;

/** Browsers expose synthetic entries `default` and sometimes `communications`. */
export function isDefaultOrCommunicationsDeviceId(deviceId: string | undefined | null): boolean {
  if (deviceId == null || deviceId === '') return false;
  return deviceId === 'default' || deviceId === 'communications';
}

/**
 * Initial capture: prefer `ideal: 'default'` when the enumerated list includes it; else `communications`;
 * else fall back to processing-only constraints (browser picks).
 */
export async function buildWebMicGetUserMediaConstraints(): Promise<MediaStreamConstraints> {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
    return { audio: { ...WEB_MIC_PROCESSING_CONSTRAINTS } };
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((d) => d.kind === 'audioinput');
    const hasDefault = inputs.some((d) => d.deviceId === 'default');
    const hasCommunications = inputs.some((d) => d.deviceId === 'communications');
    if (hasDefault) {
      return {
        audio: {
          deviceId: { ideal: 'default' },
          ...WEB_MIC_PROCESSING_CONSTRAINTS,
        },
      };
    }
    if (hasCommunications) {
      return {
        audio: {
          deviceId: { ideal: 'communications' },
          ...WEB_MIC_PROCESSING_CONSTRAINTS,
        },
      };
    }
  } catch {
    /* fall through */
  }
  return { audio: { ...WEB_MIC_PROCESSING_CONSTRAINTS } };
}

/** Explicit fallback after silent capture: force the browser default input. */
export function buildWebMicDefaultIdealFallbackConstraints(): MediaStreamConstraints {
  return {
    audio: {
      deviceId: { ideal: 'default' },
      ...WEB_MIC_PROCESSING_CONSTRAINTS,
    },
  };
}
