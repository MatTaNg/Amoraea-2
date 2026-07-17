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
  type InterviewMicPressLifecycleDeps,
} from '@features/aria/interviewMicPressLifecycleTypes';

export function useInterviewMicPressCallbacks(deps: {
  webMicPressLifecycleDepsRef: React.MutableRefObject<InterviewMicPressLifecycleDeps>;
  applyRouteProbeAfterResumeDepsRef: React.MutableRefObject<ApplyRouteProbeAfterResumeDeps>;
  handleNativeOrWhisperMicPressDepsRef: React.MutableRefObject<HandleNativeOrWhisperMicPressDeps>;
}) {
  const startRecordingAfterPendingTts = useCallback(async () => {
    await runStartRecordingAfterPendingTts(deps.webMicPressLifecycleDepsRef.current);
  }, [deps.webMicPressLifecycleDepsRef]);

  const handlePressStart = useCallback(async () => {
    await runHandlePressStart(deps.webMicPressLifecycleDepsRef.current);
  }, [deps.webMicPressLifecycleDepsRef]);

  const handlePressEnd = useCallback(async () => {
    await runHandlePressEnd(deps.webMicPressLifecycleDepsRef.current);
  }, [deps.webMicPressLifecycleDepsRef]);

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
    startRecordingAfterPendingTts,
    handlePressStart,
    handlePressEnd,
    applyRouteProbeAfterResume,
    handleNativeOrWhisperMicPress,
  };
}
