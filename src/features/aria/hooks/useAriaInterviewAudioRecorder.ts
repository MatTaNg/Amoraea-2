import { runOnRecordingComplete } from '@features/aria/runOnRecordingComplete';
import type { OnRecordingCompleteDeps } from '@features/aria/onRecordingCompleteTypes';
import { useAudioRecorder } from '@features/aria/hooks/useAudioRecorder';
import { setRecordingSessionActive } from '@utilities/sessionLogging';

export type AriaInterviewAudioRecorderDeps = OnRecordingCompleteDeps & {
  interviewStatusRef: React.MutableRefObject<string>;
  applyRouteProbeAfterResume: (source: 'app_resume' | 'media_services_reset') => Promise<void>;
  setMicNeedsReconnect: (v: boolean) => void;
  recordingDelayMeasurementRef: React.MutableRefObject<{
    modeCompleteAtMs: number;
    recordingInitializedAtMs: number;
  } | null>;
  handleRecordingError: (err: Error) => void;
};

export function useAriaInterviewAudioRecorder(
  depsRef: React.MutableRefObject<AriaInterviewAudioRecorderDeps>,
) {
  const audioRecorder = useAudioRecorder({
    onRecordingTapIntent: () => {
      setRecordingSessionActive(true);
    },
    onRecordingEnginePrimed: (info) => {
      depsRef.current.recordingDelayMeasurementRef.current = info;
      setRecordingSessionActive(true);
      depsRef.current.setMicEnginePrimed(true);
    },
    onMediaServicesReset: () => {
      depsRef.current.setMicNeedsReconnect(true);
      if (depsRef.current.interviewStatusRef.current !== 'in_progress') return;
      void depsRef.current.applyRouteProbeAfterResume('media_services_reset');
    },
    onRecordingComplete: async (blob, nativeUri, meta) => {
      await runOnRecordingComplete(depsRef.current, { blob, nativeUri, meta });
    },
    onError: (err) => depsRef.current.handleRecordingError(err),
  });

  return audioRecorder;
}
