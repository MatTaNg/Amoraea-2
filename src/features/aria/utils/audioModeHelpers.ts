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
  try {
    await Audio.setIsEnabledAsync(false);
    logSessionTransition('session_deactivated', context);
  } catch (e) {
    console.warn('[Audio/session] setIsEnabledAsync(false) failed', e);
  }
  await new Promise((r) => setTimeout(r, 300));
  try {
    await Audio.setIsEnabledAsync(true);
    logSessionTransition('session_reactivated', context);
  } catch (e) {
    console.warn('[Audio/session] setIsEnabledAsync(true) failed', e);
  }
  await setPlaybackMode();
  logSessionTransition('playback_mode_after_transition', context, {
    allowsRecordingIOS: false,
  });
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
