/**
 * Explicit audio session mode for iOS/Android so TTS plays through the speaker
 * and recording uses the mic correctly. Call before every TTS and before/after recording.
 */
import { Platform } from 'react-native';

/** Avoid top-level `import 'expo-av'` — it breaks web lazy-loading of interview (SDK 53+ deprecation / init). */
function getExpoAvAudio(): typeof import('expo-av').Audio {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-av').Audio;
}

/** Last mode applied via `setPlaybackMode` / `setRecordingMode` — for session_logs telemetry only. */
let lastAppliedAudioModeLabel: 'playback' | 'recording' | 'web' = 'web';

type RecordingPlaybackTransitionInfo = { succeeded: boolean; errorMessage?: string };
let recordingPlaybackTransitionHook: ((info: RecordingPlaybackTransitionInfo) => void) | undefined;

/** Optional session_logs hook (registered from AriaScreen) — must not throw. */
export function setRecordingPlaybackTransitionTelemetryHook(
  fn: ((info: RecordingPlaybackTransitionInfo) => void) | undefined
): void {
  recordingPlaybackTransitionHook = fn;
}

export function getLastAppliedAudioModeLabel(): typeof lastAppliedAudioModeLabel {
  return lastAppliedAudioModeLabel;
}

function logSessionTransition(
  phase: string,
  context: string,
  extra?: Record<string, unknown>
): void {
  console.log('[Audio/session]', {
    phase,
    context,
    platform: Platform.OS,
    /** JS cannot read AVAudioSession category; these are the expo-av intents we apply next. */
    ...extra,
  });
}

/**
 * Prepare native speaker route for TTS. Use `afterRecording: true` immediately after mic capture
 * (full deactivate/reactivate cycle); otherwise apply playback mode only.
 */
/** Android Chrome: brief pause after mic capture before speaker TTS avoids a loud route snap. */
const WEB_TTS_SETTLE_AFTER_RECORDING_MS = 350;
/** After app/tab foreground or session resume, avoid speaker snap before the next TTS. */
const WEB_TTS_SETTLE_AFTER_FOREGROUND_MS = 350;
const WEB_FOREGROUND_RESUME_SETTLE_WINDOW_MS = 20000;

/** Brief mobile-web settle before TTS after tab/app return or post-recording (avoids Android speaker snap). */
export async function applyWebInterviewForegroundTtsSettle(
  context: 'after_recording' | 'after_foreground',
): Promise<void> {
  await applyWebMobileTtsRouteSettle(context);
}

async function applyWebMobileTtsRouteSettle(context: 'after_recording' | 'after_foreground'): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { isWebInterviewMidUtteranceTabResumeActive } =
    require('./webInterviewHtmlAudioTabResume') as typeof import('./webInterviewHtmlAudioTabResume');
  if (isWebInterviewMidUtteranceTabResumeActive()) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getWebSpeechDeferFromNavigatorSnapshot } = require('./webSpeechDeferPolicy') as typeof import('./webSpeechDeferPolicy');
  const deferMobile =
    typeof navigator !== 'undefined' &&
    getWebSpeechDeferFromNavigatorSnapshot({
      userAgent: navigator.userAgent || '',
      platform: navigator.platform,
      maxTouchPoints: navigator.maxTouchPoints,
    });
  if (!deferMobile) return;
  const delayMs =
    context === 'after_recording' ? WEB_TTS_SETTLE_AFTER_RECORDING_MS : WEB_TTS_SETTLE_AFTER_FOREGROUND_MS;
  await new Promise<void>((r) => setTimeout(r, delayMs));
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const routeCache = require('@utilities/sessionLogging/webMediaDeviceAudioRoute') as typeof import('@utilities/sessionLogging/webMediaDeviceAudioRoute');
  routeCache.syncWebAudioRouteSessionEnvelopeFromCache();
}

export async function prepareInterviewTtsPlayback(
  context: string,
  options?: { afterRecording?: boolean; parallelStreamContinuation?: boolean },
): Promise<void> {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mic = require('./webInterviewMicPreInit') as typeof import('./webInterviewMicPreInit');
    if (!options?.parallelStreamContinuation) {
      mic.suspendWebInterviewMicPreInitForTtsPlayback();
    }
    if (options?.afterRecording) {
      await applyWebMobileTtsRouteSettle('after_recording');
    } else if (!options?.parallelStreamContinuation) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getWebSpeechDeferFromNavigatorSnapshot } = require('./webSpeechDeferPolicy') as typeof import('./webSpeechDeferPolicy');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const {
        getMsSinceWebTabBecameVisible,
        getMsSinceWebSessionResumeReady,
      } = require('./webInterviewGestureContext') as typeof import('./webInterviewGestureContext');
      const deferMobile =
        typeof navigator !== 'undefined' &&
        getWebSpeechDeferFromNavigatorSnapshot({
          userAgent: navigator.userAgent || '',
          platform: navigator.platform,
          maxTouchPoints: navigator.maxTouchPoints,
        });
      const msSinceTabVisible = getMsSinceWebTabBecameVisible();
      const msSinceResumeReady = getMsSinceWebSessionResumeReady();
      const recentForeground =
        (msSinceTabVisible != null && msSinceTabVisible < WEB_FOREGROUND_RESUME_SETTLE_WINDOW_MS) ||
        (msSinceResumeReady != null && msSinceResumeReady < WEB_FOREGROUND_RESUME_SETTLE_WINDOW_MS);
      if (deferMobile && recentForeground) {
        await applyWebMobileTtsRouteSettle('after_foreground');
      }
    }
    if (!options?.parallelStreamContinuation) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { isWebInterviewMidUtteranceTabResumeActive } =
        require('./webInterviewHtmlAudioTabResume') as typeof import('./webInterviewHtmlAudioTabResume');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ensureWebInterviewTtsOutputVolumePrimed } =
        require('./webInterviewTtsOutputVolume') as typeof import('./webInterviewTtsOutputVolume');
      if (!isWebInterviewMidUtteranceTabResumeActive()) {
        ensureWebInterviewTtsOutputVolumePrimed();
      }
    }
    return;
  }
  if (options?.afterRecording) {
    await transitionFromRecordingToPlaybackNative(context);
  } else {
    await setPlaybackMode();
  }
}

/** Call BEFORE every TTS playback so Amoraea speaks through the speaker at full volume. */
export async function setPlaybackMode(): Promise<void> {
  if (Platform.OS === 'web') {
    lastAppliedAudioModeLabel = 'web';
    return;
  }
  lastAppliedAudioModeLabel = 'playback';
  const Audio = getExpoAvAudio();
  const playbackMode = {
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: 1,
    interruptionModeAndroid: 1,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  } as const;
  logSessionTransition('setPlaybackMode', 'setPlaybackMode', {
    intended: 'media playback, speaker output',
    allowsRecordingIOS: playbackMode.allowsRecordingIOS,
  });
  await Audio.setAudioModeAsync({ ...playbackMode });
}

/**
 * After native recording stops: deactivate audio module, wait, re-enable, apply playback mode.
 * Mitigates iOS routing stuck in PlayAndRecord / quiet speaker after mic.
 */
export async function transitionFromRecordingToPlaybackNative(context: string): Promise<void> {
  if (Platform.OS === 'web') return;
  const Audio = getExpoAvAudio();
  logSessionTransition('recording_ended', context, { next: 'deactivate_audio_module' });
  let deactivateOk = true;
  try {
    await Audio.setIsEnabledAsync(false);
    logSessionTransition('session_deactivated', context);
  } catch (e) {
    deactivateOk = false;
    console.warn('[Audio/session] setIsEnabledAsync(false) failed', e);
  }
  await new Promise((r) => setTimeout(r, 300));
  try {
    await Audio.setIsEnabledAsync(true);
    logSessionTransition('session_reactivated', context);
  } catch (e) {
    deactivateOk = false;
    console.warn('[Audio/session] setIsEnabledAsync(true) failed', e);
  }
  await setPlaybackMode();
  logSessionTransition('playback_mode_after_transition', context, {
    allowsRecordingIOS: false,
  });
  try {
    recordingPlaybackTransitionHook?.({
      succeeded: deactivateOk,
      errorMessage: deactivateOk ? undefined : 'setIsEnabledAsync_failed',
    });
  } catch {
    /* ignore telemetry */
  }
}

/**
 * Optional second bridge immediately before TTS when we know the prior user action was a recording
 * (long async gap — e.g. transcription — can let the session drift on iOS).
 */
export async function applyPlaybackBridgeBeforeTtsIfIos(context: string): Promise<void> {
  if (Platform.OS !== 'ios') return;
  await transitionFromRecordingToPlaybackNative(`pre_tts:${context}`);
}

/**
 * Log intended expo-av playback mode right before TTS (iOS session is not readable via JS).
 * Call after stopping any prior playback/recording.
 */
export async function logAndApplyPlaybackModeForTts(context: string): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[Audio/TTS] pre-playback', { context, platform: 'web' });
    return;
  }
  console.log('[Audio/TTS] pre-playback', { context, platform: Platform.OS, phase: 'before_setPlaybackMode' });
  await setPlaybackMode();
  const snapshot = {
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    playThroughEarpieceAndroid: false,
    shouldDuckAndroid: true,
  };
  console.log('[Audio/TTS] pre-playback', {
    context,
    platform: Platform.OS,
    phase: 'after_setPlaybackMode',
    audioMode: snapshot,
  });
}

/** Call BEFORE every mic recording so input is captured correctly. */
/** After input route change (e.g. headphones unplugged) — re-apply playback baseline so session is not stale. */
export async function refreshAudioSessionAfterRouteChange(context: string): Promise<void> {
  if (Platform.OS === 'web') return;
  logSessionTransition('route_change_refresh', context, { action: 'transition_from_recording_to_playback' });
  await transitionFromRecordingToPlaybackNative(`route_change:${context}`);
}

export async function setRecordingMode(): Promise<void> {
  if (Platform.OS === 'web') {
    lastAppliedAudioModeLabel = 'web';
    return;
  }
  lastAppliedAudioModeLabel = 'recording';
  const Audio = getExpoAvAudio();
  const recordingMode = {
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: 1,
    interruptionModeAndroid: 1,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  } as const;
  logSessionTransition('setRecordingMode', 'mic_capture', {
    intended: 'voice recording, microphone input',
    allowsRecordingIOS: recordingMode.allowsRecordingIOS,
  });
  await Audio.setAudioModeAsync({ ...recordingMode });
}
