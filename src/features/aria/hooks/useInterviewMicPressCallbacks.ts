import { useCallback } from 'react';

import {
  runApplyRouteProbeAfterResume,
  type ApplyRouteProbeAfterResumeDeps,
} from '@features/aria/applyRouteProbeAfterResumeTypes';
import {
  runHandleNativeOrWhisperMicPress,
  type HandleNativeOrWhisperMicPressDeps,
} from '@features/aria/handleNativeOrWhisperMicPressTypes';
import {
  runHandlePressEnd,
  runHandlePressStart,
  runStartRecordingAfterPendingTts,
  runWaitUntilInterviewerQuiescentForWebMic,
  type WebMicPressLifecycleDeps,
} from '@features/aria/webMicPressLifecycleTypes';

export function useInterviewMicPressCallbacks(deps: {
  webMicPressLifecycleDepsRef: React.MutableRefObject<WebMicPressLifecycleDeps>;
  applyRouteProbeAfterResumeDepsRef: React.MutableRefObject<ApplyRouteProbeAfterResumeDeps>;
  handleNativeOrWhisperMicPressDepsRef: React.MutableRefObject<HandleNativeOrWhisperMicPressDeps>;
  runWebGestureTtsFlush: (source: 'mic' | 'pending_tts_gesture_overlay') => void | Promise<void>;
}) {
  const waitUntilInterviewerQuiescentForWebMic = useCallback(async () => {
    await runWaitUntilInterviewerQuiescentForWebMic(deps.webMicPressLifecycleDepsRef.current);
  }, [deps.webMicPressLifecycleDepsRef]);

  const startRecordingAfterPendingTts = useCallback(async () => {
    await runStartRecordingAfterPendingTts(deps.webMicPressLifecycleDepsRef.current);
  }, [deps.webMicPressLifecycleDepsRef]);

  const handlePressStart = useCallback(async () => {
    await runHandlePressStart(deps.webMicPressLifecycleDepsRef.current);
  }, [deps.webMicPressLifecycleDepsRef]);

  const handlePressEnd = useCallback(async () => {
    await runHandlePressEnd(deps.webMicPressLifecycleDepsRef.current);
  }, [deps.webMicPressLifecycleDepsRef]);

  const handleWebMicPressIn = useCallback(() => {
    void deps.runWebGestureTtsFlush('mic');
  }, [deps.runWebGestureTtsFlush]);

  const applyRouteProbeAfterResume = useCallback(
    async (source: 'app_resume' | 'media_services_reset') => {
      await runApplyRouteProbeAfterResume(deps.applyRouteProbeAfterResumeDepsRef.current, source);
    },
    [deps.applyRouteProbeAfterResumeDepsRef],
  );

  const handleNativeOrWhisperMicPress = useCallback(async () => {
    await runHandleNativeOrWhisperMicPress(deps.handleNativeOrWhisperMicPressDepsRef.current);
  }, [deps.handleNativeOrWhisperMicPressDepsRef]);

  return {
    waitUntilInterviewerQuiescentForWebMic,
    startRecordingAfterPendingTts,
    handlePressStart,
    handlePressEnd,
    handleWebMicPressIn,
    applyRouteProbeAfterResume,
    handleNativeOrWhisperMicPress,
  };
}
