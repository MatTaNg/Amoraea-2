import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';

/** Passed to speakTextSafe for interviewer lines that should advance scenario-reference UI state. */
export const ASSISTANT_INTERVIEW_SPEECH = {
  interviewSpeechRole: 'assistant_response' as const,
  telemetrySource: 'turn' as const,
  ttsTriggerSource: 'callback' as const,
};

/** Show Scenario card canonical body — may retry after tab-restore or a new model turn. */
export const SHOW_SCENARIO_CARD_CANONICAL_SPEECH = {
  ...ASSISTANT_INTERVIEW_SPEECH,
  allowDuplicateConsecutiveTts: true,
  /** User just spoke; play canonical vignette without tab-restore overlay when possible. */
  skipGestureGate: true,
  /** Prefer full HTML MP3 delivery (reliable for long vignette copy). */
  skipPcmStream: true,
};

/** Tab-return replay — never advance interview state or re-verify duration (avoids double-speak). */
export const TAB_RESTORE_PENDING_SPEAK_OPTIONS = {
  interviewSpeechRole: 'assistant_response' as const,
  telemetrySource: 'replay' as const,
  skipInterviewSpeechAdvance: true,
  skipQuestionDeliveredTelemetry: true,
  skipLastQuestionRef: true,
  allowDuplicateConsecutiveTts: true,
  skipGestureGate: true,
  /** HTML MP3 only — avoids non-seekable PCM chunk stream on long replay lines. */
  skipPcmStream: true,
  ttsTriggerSource: 'gesture_handler' as const,
};

/** Max wait for HTML tab-resume `play()` to become audible before full replay from start. */
export const TAB_RESTORE_HTML_PLAY_START_TIMEOUT_MS = 4500;

export type InterviewTtsSpeakOpts = {
  telemetrySource?: TtsTelemetrySource;
  skipQuestionTiming?: boolean;
  skipLastQuestionRef?: boolean;
  preInitTriggerDuring?: import('@features/aria/utils/interviewMicPreInitTypes').PreInitTriggerDuring;
  skipPcmStream?: boolean;
  prefetchedMpegArrayBuffer?: ArrayBuffer;
  afterRecordingForScenarioSplitSeg2?: boolean;
  /** After user recording: defer mic warm-up until playback ends (avoids desktop/web audio route snap). */
  skipMicPreInitDuringPlayback?: boolean;
  ttsTriggerSource?:
    | 'gesture_handler'
    | 'effect'
    | 'callback'
    | 'timeout'
    | 'preauthorized_element';
  onPlaybackStarted?: () => void;
};

export type ScenarioSplitTtsDelivery = {
  segment1_expected_duration_ms: number;
  segment2_expected_duration_ms: number;
};

export type InterviewTtsSpeakOutcome = { scenarioSplitDelivery?: ScenarioSplitTtsDelivery } | void;

export type TrySplitFictionalScenarioIntro = (text: string) => {
  seg1: string;
  seg2: string;
  segment1_expected_duration_ms: number;
  segment2_expected_duration_ms: number;
} | null;

/** Brief breath between split vignette and opening question after segment 1 playback completes. */
export const SCENARIO_SPLIT_INTER_SEGMENT_GAP_MS = 200;
