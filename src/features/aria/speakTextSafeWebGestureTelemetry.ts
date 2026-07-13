import type { GestureContextLostReason } from '@features/aria/utils/webInterviewGestureContext';
import {
  getAriaScreenMountGeneration,
  getLastGestureMountGeneration,
  getLastWebInterviewUserGestureMs,
} from '@features/aria/utils/webInterviewGestureContext';
import type { SpeakTextSafeTtsTriggerSource } from '@features/aria/runSpeakTextSafeImmediateWebGreeting';

export type SpeakTextSafeGestureContextLostResolution = {
  reason?: GestureContextLostReason;
  clearGestureContextLostAt: boolean;
  clearTabVisibilityGestureLossPending: boolean;
};

export function resolveSpeakTextSafeGestureContextLostResolution(args: {
  isWeb: boolean;
  gestureContextActive: boolean | null;
  effectiveTtsTriggerSource: SpeakTextSafeTtsTriggerSource;
  gestureContextLostAt: { atMs: number; reason: GestureContextLostReason } | null;
  tabVisibilityGestureLossPending: boolean;
  nowMs?: number;
}): SpeakTextSafeGestureContextLostResolution {
  const none = {
    clearGestureContextLostAt: false,
    clearTabVisibilityGestureLossPending: false,
  } satisfies SpeakTextSafeGestureContextLostResolution;

  if (!args.isWeb) {
    return none;
  }
  if (args.gestureContextActive === true) {
    return { ...none, clearTabVisibilityGestureLossPending: true };
  }
  if (args.gestureContextActive !== false) {
    return none;
  }
  if (args.effectiveTtsTriggerSource === 'preauthorized_element') {
    return {
      ...none,
      clearGestureContextLostAt: true,
      clearTabVisibilityGestureLossPending: true,
    };
  }

  const nowMs = args.nowMs ?? Date.now();
  const lostAt = args.gestureContextLostAt;
  if (lostAt != null && nowMs - lostAt.atMs < 120_000) {
    return {
      reason: lostAt.reason,
      clearGestureContextLostAt: true,
      clearTabVisibilityGestureLossPending: lostAt.reason === 'tab_visibility_change',
    };
  }
  if (args.tabVisibilityGestureLossPending) {
    return {
      reason: 'tab_visibility_change',
      clearGestureContextLostAt: false,
      clearTabVisibilityGestureLossPending: true,
    };
  }
  if (
    getLastWebInterviewUserGestureMs() != null &&
    getLastGestureMountGeneration() !== getAriaScreenMountGeneration()
  ) {
    return { reason: 'component_remount', ...none };
  }
  if (args.effectiveTtsTriggerSource === 'gesture_handler') {
    return none;
  }
  if (args.effectiveTtsTriggerSource === 'effect' || args.effectiveTtsTriggerSource === 'timeout') {
    return { reason: 'tts_called_from_effect', ...none };
  }
  return { reason: 'async_gap_in_tts_chain', ...none };
}
