import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { resolveSpeakTextSafeGestureContextLostResolution } from '@features/aria/speakTextSafeWebGestureTelemetry';

jest.mock('@features/aria/utils/webInterviewGestureContext', () => ({
  getLastWebInterviewUserGestureMs: jest.fn(),
  getLastGestureMountGeneration: jest.fn(),
  getAriaScreenMountGeneration: jest.fn(),
}));

import {
  getAriaScreenMountGeneration,
  getLastGestureMountGeneration,
  getLastWebInterviewUserGestureMs,
} from '@features/aria/utils/webInterviewGestureContext';

const getGestureMs = jest.mocked(getLastWebInterviewUserGestureMs);
const getGestureGen = jest.mocked(getLastGestureMountGeneration);
const getAriaGen = jest.mocked(getAriaScreenMountGeneration);

describe('resolveSpeakTextSafeGestureContextLostResolution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getGestureMs.mockReturnValue(null);
    getGestureGen.mockReturnValue(1);
    getAriaGen.mockReturnValue(1);
  });

  it('returns no-op on native platforms', () => {
    expect(
      resolveSpeakTextSafeGestureContextLostResolution({
        isWeb: false,
        gestureContextActive: false,
        effectiveTtsTriggerSource: 'effect',
        gestureContextLostAt: null,
        tabVisibilityGestureLossPending: true,
      }),
    ).toEqual({
      clearGestureContextLostAt: false,
      clearTabVisibilityGestureLossPending: false,
    });
  });

  it('clears tab visibility pending when gesture context is active', () => {
    expect(
      resolveSpeakTextSafeGestureContextLostResolution({
        isWeb: true,
        gestureContextActive: true,
        effectiveTtsTriggerSource: 'gesture_handler',
        gestureContextLostAt: null,
        tabVisibilityGestureLossPending: true,
      }),
    ).toEqual({
      clearGestureContextLostAt: false,
      clearTabVisibilityGestureLossPending: true,
    });
  });

  it('clears stored loss refs for preauthorized playback without emitting a reason', () => {
    expect(
      resolveSpeakTextSafeGestureContextLostResolution({
        isWeb: true,
        gestureContextActive: false,
        effectiveTtsTriggerSource: 'preauthorized_element',
        gestureContextLostAt: { atMs: 1_000, reason: 'tab_visibility_change' },
        tabVisibilityGestureLossPending: true,
      }),
    ).toEqual({
      clearGestureContextLostAt: true,
      clearTabVisibilityGestureLossPending: true,
    });
  });

  it('consumes a recent gestureContextLostAt record', () => {
    expect(
      resolveSpeakTextSafeGestureContextLostResolution({
        isWeb: true,
        gestureContextActive: false,
        effectiveTtsTriggerSource: 'async_gap',
        gestureContextLostAt: { atMs: 5_000, reason: 'tab_visibility_change' },
        tabVisibilityGestureLossPending: true,
        nowMs: 10_000,
      }),
    ).toEqual({
      reason: 'tab_visibility_change',
      clearGestureContextLostAt: true,
      clearTabVisibilityGestureLossPending: true,
    });
  });

  it('falls back to tab visibility pending when no recent lost-at record exists', () => {
    expect(
      resolveSpeakTextSafeGestureContextLostResolution({
        isWeb: true,
        gestureContextActive: false,
        effectiveTtsTriggerSource: 'async_gap',
        gestureContextLostAt: null,
        tabVisibilityGestureLossPending: true,
      }),
    ).toEqual({
      reason: 'tab_visibility_change',
      clearGestureContextLostAt: false,
      clearTabVisibilityGestureLossPending: true,
    });
  });

  it('detects component remount when gesture generation diverges', () => {
    getGestureMs.mockReturnValue(42);
    getGestureGen.mockReturnValue(2);
    getAriaGen.mockReturnValue(3);

    expect(
      resolveSpeakTextSafeGestureContextLostResolution({
        isWeb: true,
        gestureContextActive: false,
        effectiveTtsTriggerSource: 'async_gap',
        gestureContextLostAt: null,
        tabVisibilityGestureLossPending: false,
      }),
    ).toEqual({
      reason: 'component_remount',
      clearGestureContextLostAt: false,
      clearTabVisibilityGestureLossPending: false,
    });
  });

  it('omits reason for direct gesture_handler playback', () => {
    expect(
      resolveSpeakTextSafeGestureContextLostResolution({
        isWeb: true,
        gestureContextActive: false,
        effectiveTtsTriggerSource: 'gesture_handler',
        gestureContextLostAt: null,
        tabVisibilityGestureLossPending: false,
      }),
    ).toEqual({
      clearGestureContextLostAt: false,
      clearTabVisibilityGestureLossPending: false,
    });
  });

  it('labels effect and timeout triggers as tts_called_from_effect', () => {
    expect(
      resolveSpeakTextSafeGestureContextLostResolution({
        isWeb: true,
        gestureContextActive: false,
        effectiveTtsTriggerSource: 'timeout',
        gestureContextLostAt: null,
        tabVisibilityGestureLossPending: false,
      }).reason,
    ).toBe('tts_called_from_effect');
  });

  it('labels other async triggers as async_gap_in_tts_chain', () => {
    expect(
      resolveSpeakTextSafeGestureContextLostResolution({
        isWeb: true,
        gestureContextActive: false,
        effectiveTtsTriggerSource: 'async_gap',
        gestureContextLostAt: null,
        tabVisibilityGestureLossPending: false,
      }).reason,
    ).toBe('async_gap_in_tts_chain');
  });
});
