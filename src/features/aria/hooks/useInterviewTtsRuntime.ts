import { useCallback } from 'react';

import type { ParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import type { WebTtsUtteranceReplayOptions } from '@features/aria/speakTextSafeDeps';
import { stopElevenLabsPlayback, stopElevenLabsSpeech } from '@features/aria/utils/elevenLabsTtsPlaybackStop';
import { setTtsPlaybackActive } from '@utilities/sessionLogging';

export const STALE_SPEAK_AWAITING_AUDIO_MS = 50_000;
export const STALE_PARALLEL_STREAM_AWAITING_AUDIO_MS = 15_000;
export const STALE_TTS_RUNTIME_LOCK_MS = 2_000;

export type InterviewTtsRuntimeDeps = {
  voiceStateRef: React.MutableRefObject<VoiceState>;
  setVoiceState: (state: VoiceState) => void;
  parallelStreamingTtsRef: React.MutableRefObject<ParallelStreamingTtsState>;
  ttsLineInFlightRef: React.MutableRefObject<boolean>;
  ttsSpeakGenerationRef: React.MutableRefObject<number>;
  ttsUtteranceInFlightRef: React.MutableRefObject<string | null>;
  ttsUtteranceInFlightOptionsRef: React.MutableRefObject<WebTtsUtteranceReplayOptions | null>;
};

/**
 * Interview TTS runtime helpers (native-first).
 * Browser tab-restore / HTML-audio paths have been removed.
 */
export function useInterviewTtsRuntime(depsRef: React.MutableRefObject<InterviewTtsRuntimeDeps>) {
  const isInterviewerOutputActiveForMicGate = useCallback((): boolean => {
    const deps = depsRef.current;
    return (
      deps.voiceStateRef.current === 'processing' ||
      deps.voiceStateRef.current === 'speaking'
    );
  }, [depsRef]);

  const clearStaleInterviewTtsRuntimeLocks = useCallback(
    (opts?: { recoverVoiceUi?: boolean; force?: boolean }): void => {
      const deps = depsRef.current;
      const preserveSpeakUtterance =
        !opts?.force && (deps.ttsUtteranceInFlightRef.current?.trim().length ?? 0) > 0;
      deps.parallelStreamingTtsRef.current.active = false;
      if (!preserveSpeakUtterance) {
        deps.ttsLineInFlightRef.current = false;
        setTtsPlaybackActive(false);
        if (opts?.recoverVoiceUi || opts?.force) {
          deps.ttsUtteranceInFlightRef.current = null;
          deps.ttsUtteranceInFlightOptionsRef.current = null;
        }
        if (opts?.recoverVoiceUi) {
          if (
            deps.voiceStateRef.current === 'processing' ||
            deps.voiceStateRef.current === 'speaking'
          ) {
            deps.setVoiceState('idle');
          }
        }
      }
    },
    [depsRef],
  );

  const interruptAllInterviewTtsOutput = useCallback(
    (_opts?: { preserveTabRestorePending?: boolean }): void => {
      const deps = depsRef.current;
      deps.ttsSpeakGenerationRef.current += 1;
      deps.parallelStreamingTtsRef.current.cancelRequested = true;
      clearStaleInterviewTtsRuntimeLocks({ force: true });
      void stopElevenLabsPlayback();
      stopElevenLabsSpeech();
    },
    [clearStaleInterviewTtsRuntimeLocks, depsRef],
  );

  const resolveStaleTtsRuntimeLockThresholdMs = useCallback((): number => {
    const deps = depsRef.current;
    if ((deps.ttsUtteranceInFlightRef.current?.trim().length ?? 0) > 0) {
      return STALE_SPEAK_AWAITING_AUDIO_MS;
    }
    if (deps.parallelStreamingTtsRef.current.active) {
      return STALE_PARALLEL_STREAM_AWAITING_AUDIO_MS;
    }
    return STALE_TTS_RUNTIME_LOCK_MS;
  }, [depsRef]);

  return {
    isInterviewerOutputActiveForMicGate,
    clearStaleInterviewTtsRuntimeLocks,
    interruptAllInterviewTtsOutput,
    resolveStaleTtsRuntimeLockThresholdMs,
  };
}
