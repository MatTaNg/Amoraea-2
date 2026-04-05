/**
 * Explicit audio session mode for iOS/Android so TTS plays through speaker
 * and recording uses the mic correctly. Call before every TTS and before/after recording.
 */
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { remoteLog } from '@utilities/remoteLog';
import { AUDIO_ROUTE_DEBUG_BUILD, withAudioRouteDebugBuild } from './audioRouteDebugBuild';

/** Throttled Supabase evidence (OTA devices cannot reach 127.0.0.1 debug ingest). */
let playbackModeRemoteLogCount = 0;

/** Call BEFORE every TTS playback so Amoraea speaks through the speaker at full volume. */
export async function setPlaybackMode(): Promise<void> {
  if (Platform.OS === 'web') return;
  void remoteLog('[AUDIO_ROUTE] setPlaybackMode entry', {
    runId: 'audio-route-debug-3',
    platform: Platform.OS,
  });
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'062597'},body:JSON.stringify(withAudioRouteDebugBuild({sessionId:'062597',runId:'audio-route-debug-1',hypothesisId:'H1',location:'audioModeHelpers.ts:setPlaybackMode:entry',message:'setPlaybackMode called',data:{platform:Platform.OS},timestamp:Date.now()}))}).catch(()=>{});
  // #endregion
  const playbackMode = {
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: 1,
    interruptionModeAndroid: 1,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  } as const;
  await Audio.setAudioModeAsync({ ...playbackMode });

  void remoteLog('[AUDIO_ROUTE] setPlaybackMode applied', {
    runId: 'audio-route-debug-3',
    hypothesisId: 'H8',
    platform: Platform.OS,
    note: 'native expo-av should apply category even when session inactive (patched EXAV _setAudioMode)',
    debugBuild: AUDIO_ROUTE_DEBUG_BUILD,
  });
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'062597'},body:JSON.stringify(withAudioRouteDebugBuild({sessionId:'062597',runId:'post-fix-v21',hypothesisId:'H14',location:'audioModeHelpers.ts:setPlaybackMode:afterSetAudioMode',message:'setPlaybackMode (iOS: + amoraeaReassertPlaybackSpeakerRoute before AVPlayer play)',data:{platform:Platform.OS},timestamp:Date.now()}))}).catch(()=>{});
  // #endregion
}

/**
 * Log intended expo-av playback mode right before TTS (iOS session is not readable via JS;
 * this makes mis-routing visible in device logs). Call after stopping any prior playback/recording.
 */
export async function logAndApplyPlaybackModeForTts(context: string): Promise<void> {
  if (Platform.OS === 'web') {
    console.log('[Audio/TTS] pre-playback', { context, platform: 'web' });
    return;
  }
  console.log('[Audio/TTS] pre-playback', { context, platform: Platform.OS, phase: 'before_setPlaybackMode' });
  void remoteLog('[TTS_AUDIO_SESSION]', { context, platform: Platform.OS, phase: 'before_setPlaybackMode' });
  await setPlaybackMode();
  const snapshot = {
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    playThroughEarpieceAndroid: false,
    shouldDuckAndroid: true,
  };
  console.log('[Audio/TTS] pre-playback', { context, platform: Platform.OS, phase: 'after_setPlaybackMode', audioMode: snapshot });
  void remoteLog('[TTS_AUDIO_SESSION]', { context, platform: Platform.OS, phase: 'after_setPlaybackMode', audioMode: snapshot });
}
/** Call BEFORE every mic recording so input is captured correctly. */
export async function setRecordingMode(): Promise<void> {
  if (Platform.OS === 'web') return;
  void remoteLog('[AUDIO_ROUTE] setRecordingMode entry', {
    runId: 'audio-route-debug-3',
    platform: Platform.OS,
  });
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'062597'},body:JSON.stringify(withAudioRouteDebugBuild({sessionId:'062597',runId:'audio-route-debug-1',hypothesisId:'H2',location:'audioModeHelpers.ts:setRecordingMode:entry',message:'setRecordingMode called',data:{platform:Platform.OS},timestamp:Date.now()}))}).catch(()=>{});
  // #endregion
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: 1,
    interruptionModeAndroid: 1,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
  void remoteLog('[AUDIO_ROUTE] setRecordingMode applied', {
    runId: 'audio-route-debug-3',
    platform: Platform.OS,
  });
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'062597'},body:JSON.stringify(withAudioRouteDebugBuild({sessionId:'062597',runId:'audio-route-debug-1',hypothesisId:'H2',location:'audioModeHelpers.ts:setRecordingMode:afterSetAudioMode',message:'setRecordingMode applied',data:{platform:Platform.OS},timestamp:Date.now()}))}).catch(()=>{});
  // #endregion
}
