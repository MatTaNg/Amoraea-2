/**
 * Explicit audio session mode for iOS/Android so TTS plays through speaker
 * and recording uses the mic correctly. Call before every TTS and before/after recording.
 */
import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import { remoteLog } from '@utilities/remoteLog';

/** Call BEFORE every TTS playback so Amoraea speaks through the speaker at full volume. */
export async function setPlaybackMode(): Promise<void> {
  if (Platform.OS === 'web') return;
  void remoteLog('[AUDIO_ROUTE] setPlaybackMode entry', {
    runId: 'audio-route-debug-3',
    platform: Platform.OS,
  });
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'062597'},body:JSON.stringify({sessionId:'062597',runId:'audio-route-debug-1',hypothesisId:'H1',location:'audioModeHelpers.ts:setPlaybackMode:entry',message:'setPlaybackMode called',data:{platform:Platform.OS},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: 1,
    interruptionModeAndroid: 1,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
  void remoteLog('[AUDIO_ROUTE] setPlaybackMode applied', {
    runId: 'audio-route-debug-3',
    platform: Platform.OS,
  });
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'062597'},body:JSON.stringify({sessionId:'062597',runId:'audio-route-debug-1',hypothesisId:'H1',location:'audioModeHelpers.ts:setPlaybackMode:afterSetAudioMode',message:'setPlaybackMode applied',data:{platform:Platform.OS},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
}
/** Call BEFORE every mic recording so input is captured correctly. */
export async function setRecordingMode(): Promise<void> {
  if (Platform.OS === 'web') return;
  void remoteLog('[AUDIO_ROUTE] setRecordingMode entry', {
    runId: 'audio-route-debug-3',
    platform: Platform.OS,
  });
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'062597'},body:JSON.stringify({sessionId:'062597',runId:'audio-route-debug-1',hypothesisId:'H2',location:'audioModeHelpers.ts:setRecordingMode:entry',message:'setRecordingMode called',data:{platform:Platform.OS},timestamp:Date.now()})}).catch(()=>{});
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
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'062597'},body:JSON.stringify({sessionId:'062597',runId:'audio-route-debug-1',hypothesisId:'H2',location:'audioModeHelpers.ts:setRecordingMode:afterSetAudioMode',message:'setRecordingMode applied',data:{platform:Platform.OS},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
}
