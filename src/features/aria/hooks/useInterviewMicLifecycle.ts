import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { setRecordingPlaybackTransitionTelemetryHook } from '@features/aria/utils/audioModeHelpers';
import { runRecoverInterviewMicAfterForeground } from '@features/aria/runRecoverInterviewMicAfterForeground';
import { runReplayLastQuestionAfterBackgroundInterrupt } from '@features/aria/runReplayLastQuestionAfterBackgroundInterrupt';
import { markInterviewAudioInterruptedByBackground, takeInterviewAudioInterruptedByBackground, bumpResumeWelcomePlaybackGeneration } from '@features/aria/interviewLocalPersistence';
import { recoverInterviewAudioSession } from '@features/aria/utils/recoverInterviewAudioSession';
import { markNativePlaybackBridgeBeforeNextTts } from '@features/aria/utils/audioModeHelpers';
import { getLateStartThresholdMs } from '@features/aria/config/audioInterviewConfig';
import { remoteLog } from '@utilities/remoteLog';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';
import {
  getSessionLogRuntime,
  setLastHiddenAtMs,
  setRecordingSessionActive,
} from '@utilities/sessionLogging';
import {
  getInterviewWallClockStartMs,
  getLastAudioSessionEventType,
  getLastTtsCompletionCallbackMs,
  markLastAudioSessionEventType,
  writeAudioSessionLog,
} from '@utilities/sessionLogging/audioSessionLogEnvelope';
import {
  subscribeWebAudioDeviceChange,
  syncWebAudioRouteSessionEnvelopeFromCache,
} from '@utilities/sessionLogging/webMediaDeviceAudioRoute';

import type { InterviewMicLifecycleDeps } from '@features/aria/hooks/interviewMicLifecycleTypes';

export type { InterviewMicLifecycleDeps };

export function useInterviewMicLifecycle(
  depsRef: React.MutableRefObject<InterviewMicLifecycleDeps>,
): void {
  const audioRecorderRefForLeave = useRef(depsRef.current.audioRecorder);
  const stopInterviewAudioForNavigationRef = useRef<() => void>(() => {});
  const hardStopInterviewAudioForNavigationRef = useRef<() => void>(() => {});
  const navSessionBlurRef = useRef(false);

  audioRecorderRefForLeave.current = depsRef.current.audioRecorder;
  stopInterviewAudioForNavigationRef.current = () => {
    hardStopInterviewAudioForNavigationRef.current();
  };
  hardStopInterviewAudioForNavigationRef.current = () => {
    const deps = depsRef.current;
    const isRecording = audioRecorderRefForLeave.current.isRecording;
    const ttsActive =
      getSessionLogRuntime().ttsPlaybackActive ||
      deps.voiceState === 'speaking' ||
      deps.voiceState === 'processing';
    deps.interruptAllInterviewTtsOutput();
    void deps.stopElevenLabsPlayback();
    deps.setVoiceState('idle');
    try {
      if (isRecording) {
        void audioRecorderRefForLeave.current.releaseRecordingInstance();
        setRecordingSessionActive(false);
        deps.setVoiceState('idle');
        markInterviewAudioInterruptedByBackground('recording');
      }
    } catch {
      /* ignore */
    }
    if (Platform.OS !== 'web' && (isRecording || ttsActive)) {
      markNativePlaybackBridgeBeforeNextTts(
        isRecording ? 'navigation_away_during_recording' : 'navigation_away_during_tts',
      );
      if (ttsActive && !isRecording) {
        markInterviewAudioInterruptedByBackground('tts');
      }
    }
    void recoverInterviewAudioSession('navigation_away');
  };

  const voiceState = depsRef.current.voiceState;
  const interviewStatus = depsRef.current.interviewStatus;
  const userId = depsRef.current.userId;
  const navigation = depsRef.current.navigation;
  const audioRecorder = depsRef.current.audioRecorder;
  const applyRouteProbeAfterResume = depsRef.current.applyRouteProbeAfterResume;

  useEffect(() => {
    const deps = depsRef.current;
    if (deps.voiceState !== 'idle') {
      deps.setLateStartIdleCueVisible(false);
      return;
    }
    const tick = (): void => {
      const t = getLastTtsCompletionCallbackMs();
      if (t == null) {
        deps.setLateStartIdleCueVisible(false);
        return;
      }
      deps.setLateStartIdleCueVisible(Date.now() - t >= getLateStartThresholdMs());
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [depsRef, voiceState]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (interviewStatus !== 'in_progress') return;
    return subscribeWebAudioDeviceChange(() => {
      /** Mic open/close fires devicechange on Android Chrome — enumerateDevices snaps speaker volume. */
      syncWebAudioRouteSessionEnvelopeFromCache();
    });
  }, [interviewStatus]);

  useEffect(() => {
    setRecordingPlaybackTransitionTelemetryHook((info) => {
      const uid = depsRef.current.userIdRef.current;
      if (!uid) return;
      const r = getSessionLogRuntime();
      const ttsDone = getLastTtsCompletionCallbackMs();
      markLastAudioSessionEventType('audio_session_deactivation_confirmed');
      writeAudioSessionLog({
        userId: uid,
        attemptId: r.attemptId,
        eventType: 'audio_session_deactivation_confirmed',
        eventData: {
          deactivation_succeeded: info.succeeded,
          deactivation_timestamp: Date.now(),
          time_since_tts_completion_ms: ttsDone != null ? Date.now() - ttsDone : null,
          recording_session_active: r.recordingSessionActive,
        },
        platform: r.platform,
      });
    });
    return () => setRecordingPlaybackTransitionTelemetryHook(undefined);
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background' || next === 'inactive') {
        const deps = depsRef.current;
        if (deps.interviewStatusRef.current !== 'in_progress') return;
        const isRecording = audioRecorderRefForLeave.current.isRecording;
        const ttsActive =
          getSessionLogRuntime().ttsPlaybackActive ||
          deps.voiceState === 'speaking' ||
          deps.voiceState === 'processing';
        if (!isRecording && !ttsActive) return;
        const interruptKind = isRecording ? 'recording' : 'tts';
        markInterviewAudioInterruptedByBackground(interruptKind);
        if (ttsActive) {
          deps.ttsSpeakGenerationRef.current += 1;
          if (deps.resumeOfferWelcomeTtsRef?.current) {
            bumpResumeWelcomePlaybackGeneration();
          }
        }
        void (async () => {
          if (isRecording) {
            await audioRecorderRefForLeave.current.releaseRecordingInstance();
            setRecordingSessionActive(false);
            deps.setVoiceState('idle');
          } else {
            deps.interruptAllInterviewTtsOutput();
            await deps.stopElevenLabsPlayback();
            deps.setVoiceState('idle');
          }
          markNativePlaybackBridgeBeforeNextTts(
            isRecording ? 'app_background_during_recording' : 'app_background_during_tts',
          );
          await recoverInterviewAudioSession(
            isRecording ? 'app_background_during_recording' : 'app_background_during_tts',
          );
        })();
        return;
      }
      if (next !== 'active') return;
      if (depsRef.current.resumeLoadingFlowActiveRef?.current) return;
      if (depsRef.current.interviewStatusRef.current !== 'in_progress') return;
      void (async () => {
        const deps = depsRef.current;
        const interrupted = takeInterviewAudioInterruptedByBackground();
        await runRecoverInterviewMicAfterForeground(deps);
        if (interrupted) {
          await runReplayLastQuestionAfterBackgroundInterrupt(deps, interrupted);
        }
      })();
    });
    return () => {
      sub.remove();
    };
  }, [audioRecorder.reinitializeMicrophoneSession, applyRouteProbeAfterResume, depsRef]);

  /** Stop interviewer TTS and mic capture when navigating away or the screen unmounts (tab switches do not stop audio). */
  useEffect(() => {
    const stopInterviewAudio = () => {
      stopInterviewAudioForNavigationRef.current();
    };

    const unsubBlur = navigation.addListener('blur', stopInterviewAudio);
    const unsubBeforeRemove = navigation.addListener('beforeRemove', () => {
      hardStopInterviewAudioForNavigationRef.current();
    });

    return () => {
      unsubBlur();
      unsubBeforeRemove();
      const deps = depsRef.current;
      const attemptIdRef = deps.interviewSessionAttemptIdRef;
      const sessionIdRef = deps.interviewSessionIdRef;
      const closingSessionKey = attemptIdRef?.current ?? sessionIdRef?.current ?? null;
      const preserveClosingTts = deps.hasInterviewClosingSpeakInFlightForSession?.(closingSessionKey) ?? false;
      if (preserveClosingTts) {
        void remoteLog('[ARIA_UNMOUNT] closing_speak_preserved', {
          interviewSessionId: sessionIdRef?.current,
          attemptKey: closingSessionKey,
        });
      } else {
        if (deps.parallelStreamingTtsRef?.current) {
          deps.parallelStreamingTtsRef.current.cancelRequested = true;
        }
        if (deps.ttsSpeakGenerationRef) {
          deps.ttsSpeakGenerationRef.current += 1;
        }
        void remoteLog('[ARIA_UNMOUNT] parallel_stream_cancelled', {
          interviewSessionId: sessionIdRef?.current,
        });
      }
      if (!preserveClosingTts) {
        stopInterviewAudio();
      }
    };
  }, [navigation, depsRef]);

  useEffect(() => {
    const unsubFocus = navigation.addListener('focus', () => {
      const deps = depsRef.current;
      if (!deps.userId) return;
      if (
        Platform.OS !== 'web' &&
        navSessionBlurRef.current &&
        deps.interviewStatusRef.current === 'in_progress'
      ) {
        void (async () => {
          const interrupted = takeInterviewAudioInterruptedByBackground();
          await runRecoverInterviewMicAfterForeground(deps);
          if (interrupted) {
            await runReplayLastQuestionAfterBackgroundInterrupt(deps, interrupted);
          }
        })();
      }
      if (!navSessionBlurRef.current) return;
      navSessionBlurRef.current = false;
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId: deps.userId,
        attemptId: r.attemptId,
        eventType: 'navigation_return',
        eventData: { moment_number: deps.currentInterviewMomentRef.current },
        platform: r.platform,
      });
    });
    const unsubBlurNav = navigation.addListener('blur', () => {
      const deps = depsRef.current;
      if (!deps.userId || deps.interviewStatusRef.current !== 'in_progress') return;
      navSessionBlurRef.current = true;
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId: deps.userId,
        attemptId: r.attemptId,
        eventType: 'navigation_away',
        eventData: { moment_number: deps.currentInterviewMomentRef.current },
        platform: r.platform,
      });
      const started = getInterviewWallClockStartMs();
      markLastAudioSessionEventType('session_abandonment');
      writeAudioSessionLog({
        userId: deps.userId,
        attemptId: r.attemptId,
        eventType: 'session_abandonment',
        eventData: {
          last_moment_number: deps.currentInterviewMomentRef.current,
          last_scenario_number: deps.currentScenarioRef.current,
          last_question_type: deps.classifyInterviewQuestionType(
            deps.lastQuestionTextRef.current ?? '',
          ),
          time_in_session_ms: started != null ? Date.now() - started : null,
          last_audio_event: getLastAudioSessionEventType(),
        },
        platform: r.platform,
      });
    });
    return () => {
      unsubFocus();
      unsubBlurNav();
    };
  }, [
    navigation,
    userId,
    depsRef,
  ]);

  /** One listener per session: web uses `visibilitychange` only; native uses `AppState` only (both fire on some web builds and duplicate logs). */
  useEffect(() => {
    if (!userId) return;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const fn = () => {
        const deps = depsRef.current;
        const vis = document.visibilityState === 'visible';
        if (vis && deps.emotionModalPendingTransitionRef.current) {
          deps.setEmotionModalVisible(true);
        }
        const r = getSessionLogRuntime();
        writeSessionLog({
          userId: deps.userId,
          attemptId: r.attemptId,
          eventType: 'tab_visibility_change',
          eventData: { visible: vis, moment_number: deps.currentInterviewMomentRef.current },
          platform: r.platform,
        });
      };
      document.addEventListener('visibilitychange', fn);
      return () => document.removeEventListener('visibilitychange', fn);
    }
    const sub = AppState.addEventListener('change', (next) => {
      const deps = depsRef.current;
      if (next === 'active') {
        if (deps.emotionModalPendingTransitionRef.current) {
          deps.setEmotionModalVisible(true);
        }
        const r = getSessionLogRuntime();
        writeSessionLog({
          userId: deps.userId,
          attemptId: r.attemptId,
          eventType: 'tab_visibility_change',
          eventData: { visible: true, moment_number: deps.currentInterviewMomentRef.current },
          platform: r.platform,
        });
      } else {
        setLastHiddenAtMs(Date.now());
        const r = getSessionLogRuntime();
        writeSessionLog({
          userId: deps.userId,
          attemptId: r.attemptId,
          eventType: 'tab_visibility_change',
          eventData: { visible: false, moment_number: deps.currentInterviewMomentRef.current },
          platform: r.platform,
        });
      }
    });
    return () => sub.remove();
  }, [userId, depsRef]);

  useEffect(() => {
    depsRef.current.setPreInitMeterLevel(0);
  }, [depsRef, voiceState, audioRecorder.isRecording]);
}
