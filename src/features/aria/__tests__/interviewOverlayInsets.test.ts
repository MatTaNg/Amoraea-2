import { beforeEach, afterEach, describe, expect, it, jest } from '@jest/globals';
import { Platform } from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';

import {
  interviewOverlayTop,
  resolveInterviewTopInset,
} from '@features/aria/utils/interviewOverlayInsets';

describe('interviewOverlayInsets', () => {
  const origOS = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: origOS });
    jest.restoreAllMocks();
  });

  it('uses safe-area top when present', () => {
    expect(resolveInterviewTopInset({ top: 44, bottom: 0, left: 0, right: 0 })).toBe(44);
    expect(interviewOverlayTop({ top: 44, bottom: 0, left: 0, right: 0 })).toBe(60);
  });

  it('falls back on Android when inset is zero', () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    const zeroInsets = { top: 0, bottom: 0, left: 0, right: 0 } satisfies EdgeInsets;
    expect(resolveInterviewTopInset(zeroInsets)).toBeGreaterThanOrEqual(24);
    expect(interviewOverlayTop(zeroInsets)).toBeGreaterThanOrEqual(40);
  });
});
