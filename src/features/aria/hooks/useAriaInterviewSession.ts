import { useCallback, useEffect, useRef, useState } from 'react';
import { InteractionManager, Platform } from 'react-native';

import {
  tagInterviewTranscriptMessages,
  type MessageWithScenario,
} from '@features/aria/interviewScenarioScoringSlice';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import type { HeadphoneProbeResult } from '@features/aria/utils/audioRouteHeadphones';
import {
  markWebSessionResumeReady,
  type GestureContextLostReason,
} from '@features/aria/utils/webInterviewGestureContext';
import { gatherRecordingStartTelemetry } from '@utilities/sessionLogging/sessionAudioTelemetry';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';
import { isWebInsecureDevUrl, webInsecureContextHelpMessage } from '@utilities/webSecureContext';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'recording';
export type InterviewSessionStatus = 'intro' | 'starting_interview' | 'active' | 'scoring' | 'results';
export type MicPermissionState = 'granted' | 'denied' | 'prompt' | 'unavailable';

export type InterviewTranscriptRow = {
  role: string;
  content: string;
  isScoreCard?: boolean;
  scenarioNumber?: number;
  interviewMoment?: number;
  [key: string]: unknown;
};

export type PendingGestureRestoreSpeakOptions = {
  silent?: boolean;
  interviewSpeechRole?: 'assistant_response';
  telemetrySource?: TtsTelemetrySource;
  skipQuestionDeliveredTelemetry?: boolean;
  skipInterviewSpeechAdvance?: boolean;
  skipQuestionTiming?: boolean;
  skipLastQuestionRef?: boolean;
  allowDuplicateConsecutiveTts?: boolean;
  skipClosingSessionDedup?: boolean;
  skipScenarioAContemptProbeSessionDedup?: boolean;
  skipGestureGate?: boolean;
  ttsTriggerSource?:
    | 'gesture_handler'
    | 'effect'
    | 'callback'
    | 'timeout'
    | 'preauthorized_element';
  immediateWebPlaybackElement?: HTMLAudioElement;
};

export type PendingGestureRestoreSpeakEntry = {
  text: string;
  queuedAtMs?: number;
  restoreMode?: 'resume_html' | 'replay';
  options: PendingGestureRestoreSpeakOptions;
  resolve: () => void;
  reject: (reason?: unknown) => void;
};

export type UseAriaInterviewSessionOptions = {
  whisperProxyUrl?: string;
};

export function useAriaInterviewSession(
  userId: string,
  options: UseAriaInterviewSessionOptions = {},
) {
  const { whisperProxyUrl = '' } = options;
  const [messages, setMessagesState] = useState<InterviewTranscriptRow[]>([]);
  const currentMessagesRef = useRef(messages);
  /** Every transcript commit tags scenarioNumber (required for scoring/admin). */
  const setMessages = useCallback(
    (next: InterviewTranscriptRow[] | ((prev: InterviewTranscriptRow[]) => InterviewTranscriptRow[])) => {
      setMessagesState((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next;
        const tagged =
          resolved.length === 0
            ? resolved
            : tagInterviewTranscriptMessages(resolved as MessageWithScenario[]);
        currentMessagesRef.current = tagged;
        return tagged;
      });
    },
    [],
  );

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  /** Web: drives mic gate UI — synced from playback refs (not voiceState alone). */
  const [webInterviewerOutputActive, setWebInterviewerOutputActive] = useState(false);
  const voiceStateRef = useRef<VoiceState>(voiceState);
  voiceStateRef.current = voiceState;
  /** Web: volume meter only after MediaRecorder preroll completes (avoids "recording" UI with silent meter). */
  const [micEnginePrimed, setMicEnginePrimed] = useState(false);
  /** Web: pre-init stream meter while MediaRecorder is arming after tap. */
  const [preInitMeterLevel, setPreInitMeterLevel] = useState(0);
  const webMicArmInFlightRef = useRef(false);
  /** Web name-entry: true when the user tapped mic while interviewer TTS was still active. */
  const micTapWhileTtsActiveRef = useRef(false);
  /** Gentle idle hint when TTS finished long ago and user has not tapped record yet (visual only). */
  const [lateStartIdleCueVisible, setLateStartIdleCueVisible] = useState(false);
  /** Pre-interview (`intro`) before `startInterview`; `starting_interview` is only for mic-retry / legacy auto-start paths. */
  const [status, setStatus] = useState<InterviewSessionStatus>(() => 'intro');
  /** Onboarding: auto-run startInterview once after profile gate; reset on retake / retry. */
  const onboardingAutoStartRef = useRef(false);
  /** Blocks duplicate Begin taps while mic permission / session setup is in flight. */
  const startInterviewInFlightRef = useRef(false);
  const [interviewStartInFlight, setInterviewStartInFlight] = useState(false);

  /**
   * Web: autoplay policy requires a user gesture before audio/TTS. We never auto-call `startInterview` from
   * useEffect on web — mobile uses the tap overlay; desktop waits for the first `pointerdown`.
   */
  const [mobileWebTapToBeginDone, setMobileWebTapToBeginDone] = useState(() => Platform.OS !== 'web');
  /** Desktop web only: show tap-to-unlock overlay when session cannot auto-start (e.g. cold refresh). */
  const [webDesktopAwaitingStartOverlay, setWebDesktopAwaitingStartOverlay] = useState(false);
  /** Desktop web only: TTS queued for user gesture (autoplay blocked mid-session). */
  const [webDesktopPendingTtsGestureOverlay, setWebDesktopPendingTtsGestureOverlay] = useState(false);
  /** After tab was hidden, next web TTS must run inside a fresh user gesture (autoplay policy). */
  const needsGestureRestoreRef = useRef(false);
  /** Set when we detect gesture context may be lost (e.g. tab hidden); consumed on next `tts_playback_start` log. */
  const gestureContextLostAtRef = useRef<{ atMs: number; reason: GestureContextLostReason } | null>(null);
  /** Cleared after logging `gesture_context_lost_reason` for tab visibility. */
  const tabVisibilityGestureLossPendingRef = useRef(false);
  const pendingGestureRestoreSpeakRef = useRef<PendingGestureRestoreSpeakEntry | null>(null);
  const [webTabGestureRestoreOverlay, setWebTabGestureRestoreOverlay] = useState(false);
  const webTabGestureRestoreOverlayRef = useRef(false);
  const setWebTabRestoreOverlayVisible = useCallback((visible: boolean) => {
    webTabGestureRestoreOverlayRef.current = visible;
    setWebTabGestureRestoreOverlay(visible);
  }, []);
  /** HTTP://LAN is not a secure context — browser blocks mic; show fix copy */
  const [webInsecureContextMessage, setWebInsecureContextMessage] = useState<string | null>(null);
  const pendingWebSpeechForGestureRef = useRef<string | null>(null);
  /** Web: onPressIn/touchstart ran gesture-TTS this touch; skip onPress so we do not start recording on the same tap. */
  const webGestureTtsConsumedPressRef = useRef(false);
  /** Web: mic pressed while idle with pending interviewer TTS — start recording after that audio finishes. */
  const pendingMicStartAfterIdleFlushRef = useRef(false);
  const webGestureConsumeClearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Web: one-shot window listener flushes blocked TTS on any pointerdown (not mic-only). */
  const webGestureFlushListenerAttachedRef = useRef(false);
  const webGestureFlushHandlerRef = useRef<(() => void) | null>(null);

  const [exchangeCount, setExchangeCount] = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [micError, setMicError] = useState<string | null>(null);
  const [micSessionRecovering, setMicSessionRecovering] = useState(false);
  const [micNeedsReconnect, setMicNeedsReconnect] = useState(false);
  const lastAudioRouteFingerprintRef = useRef<string | null>(null);
  const lastHeadphoneProbeRef = useRef<HeadphoneProbeResult | null>(null);
  /** Web: route changed while MediaRecorder was active — attach to next `response_received` for scoring weighting. */
  const routeChangedDuringRecordingRef = useRef(false);
  const audioRecorderIsRecordingForRouteRef = useRef(false);
  const [micWarning, setMicWarning] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<MicPermissionState>('prompt');
  const recognitionRef = useRef<{ start(): void; stop(): void } | null>(null);
  const transcriptAtReleaseRef = useRef('');
  const isSpeakingRef = useRef(false);
  const useWhisperOnWeb = Platform.OS === 'web' && !!whisperProxyUrl;
  const webTapRecordingSupported =
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    typeof MediaRecorder !== 'undefined';
  /** Native expo-av or web MediaRecorder — actual blob recording. If false on web, fall back to SpeechRecognition (still tap UI). */
  const useMediaRecorderPath = Platform.OS !== 'web' || webTapRecordingSupported;
  /** Interview mic is always tap-to-speak / tap-to-stop (web without MediaRecorder uses SpeechRecognition with tap). */
  const useTapMicUi =
    Platform.OS !== 'web' || useMediaRecorderPath || Platform.OS === 'web';

  const ttsScreenReadyRef = useRef(false);
  const pendingTtsGateResolversRef = useRef<Array<() => void>>([]);
  const pendingScreenReadyResolversRef = useRef<Array<() => void>>([]);
  /** Next `recording_start` after VAD-gate bypass no-speech path should log `recording_restarted_after_vad_bypass`. */
  const pendingRecordingRestartAfterVadBypassRef = useRef(false);

  const takeRecordingStartEventDataWithVadBypassRestart = useCallback(() => {
    const base = gatherRecordingStartTelemetry();
    if (pendingRecordingRestartAfterVadBypassRef.current) {
      pendingRecordingRestartAfterVadBypassRef.current = false;
      return { ...base, recording_restarted_after_vad_bypass: true as const };
    }
    return base;
  }, []);

  const logTtsGateState = useCallback(
    (state: 'held' | 'released', reason: string, pendingCount: number) => {
      if (!userId) return;
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'tts_playback_gate',
        eventData: {
          tts_gate: state,
          reason,
          pending_count: pendingCount,
        },
        platform: r.platform,
      });
    },
    [userId],
  );

  const awaitTtsScreenReadyGate = useCallback(
    async (reason: string) => {
      if (ttsScreenReadyRef.current) return;
      logTtsGateState('held', reason, pendingTtsGateResolversRef.current.length + 1);
      await new Promise<void>((resolve) => {
        pendingTtsGateResolversRef.current.push(resolve);
      });
    },
    [logTtsGateState],
  );

  const awaitScreenReadySignal = useCallback(async () => {
    if (ttsScreenReadyRef.current) return;
    await new Promise<void>((resolve) => {
      pendingScreenReadyResolversRef.current.push(resolve);
    });
  }, []);

  const logSessionResumeState = useCallback(
    (state: 'loading' | 'ready') => {
      if (state === 'ready' && Platform.OS === 'web') {
        markWebSessionResumeReady();
      }
      if (!userId) return;
      const r = getSessionLogRuntime();
      writeSessionLog({
        userId,
        attemptId: r.attemptId,
        eventType: 'session_resume',
        eventData: { session_resume: state },
        platform: r.platform,
      });
    },
    [userId],
  );

  useEffect(() => {
    let cancelled = false;
    const releaseGate = () => {
      if (cancelled || ttsScreenReadyRef.current) return;
      ttsScreenReadyRef.current = true;
      const pending = pendingTtsGateResolversRef.current.splice(0, pendingTtsGateResolversRef.current.length);
      const pendingScreenReady = pendingScreenReadyResolversRef.current.splice(
        0,
        pendingScreenReadyResolversRef.current.length,
      );
      if (pending.length > 0) {
        logTtsGateState('released', 'screen_ready', pending.length);
      }
      pending.forEach((resolve) => resolve());
      pendingScreenReady.forEach((resolve) => resolve());
    };
    const interaction = InteractionManager.runAfterInteractions(() => {
      setTimeout(releaseGate, 0);
    });
    return () => {
      cancelled = true;
      interaction.cancel();
    };
  }, [logTtsGateState]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (!isWebInsecureDevUrl()) return;
    setWebInsecureContextMessage(webInsecureContextHelpMessage());
  }, []);

  return {
    messages,
    setMessages,
    currentMessagesRef,
    voiceState,
    setVoiceState,
    voiceStateRef,
    webInterviewerOutputActive,
    setWebInterviewerOutputActive,
    micEnginePrimed,
    setMicEnginePrimed,
    preInitMeterLevel,
    setPreInitMeterLevel,
    webMicArmInFlightRef,
    micTapWhileTtsActiveRef,
    lateStartIdleCueVisible,
    setLateStartIdleCueVisible,
    status,
    setStatus,
    onboardingAutoStartRef,
    startInterviewInFlightRef,
    interviewStartInFlight,
    setInterviewStartInFlight,
    ttsScreenReadyRef,
    pendingTtsGateResolversRef,
    pendingScreenReadyResolversRef,
    pendingRecordingRestartAfterVadBypassRef,
    takeRecordingStartEventDataWithVadBypassRestart,
    awaitTtsScreenReadyGate,
    awaitScreenReadySignal,
    logSessionResumeState,
    mobileWebTapToBeginDone,
    setMobileWebTapToBeginDone,
    webDesktopAwaitingStartOverlay,
    setWebDesktopAwaitingStartOverlay,
    webDesktopPendingTtsGestureOverlay,
    setWebDesktopPendingTtsGestureOverlay,
    needsGestureRestoreRef,
    gestureContextLostAtRef,
    tabVisibilityGestureLossPendingRef,
    pendingGestureRestoreSpeakRef,
    webTabGestureRestoreOverlay,
    setWebTabGestureRestoreOverlay,
    webTabGestureRestoreOverlayRef,
    setWebTabRestoreOverlayVisible,
    webInsecureContextMessage,
    setWebInsecureContextMessage,
    pendingWebSpeechForGestureRef,
    webGestureTtsConsumedPressRef,
    pendingMicStartAfterIdleFlushRef,
    webGestureConsumeClearTimeoutRef,
    webGestureFlushListenerAttachedRef,
    webGestureFlushHandlerRef,
    exchangeCount,
    setExchangeCount,
    currentTranscript,
    setCurrentTranscript,
    micError,
    setMicError,
    micSessionRecovering,
    setMicSessionRecovering,
    micNeedsReconnect,
    setMicNeedsReconnect,
    lastAudioRouteFingerprintRef,
    lastHeadphoneProbeRef,
    routeChangedDuringRecordingRef,
    audioRecorderIsRecordingForRouteRef,
    micWarning,
    setMicWarning,
    micPermission,
    setMicPermission,
    recognitionRef,
    transcriptAtReleaseRef,
    isSpeakingRef,
    useWhisperOnWeb,
    webTapRecordingSupported,
    useMediaRecorderPath,
    useTapMicUi,
  };
}
