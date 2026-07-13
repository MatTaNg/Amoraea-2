import { Platform } from 'react-native';

import { getActiveWebHtmlAudioElement } from './webInterviewActiveHtmlAudio';
import { shouldSkipWebInterviewTtsVolumeReprime } from './webInterviewHtmlAudioTabResume';
import { ensureWebHtmlAudioElementMaxVolume } from './webInterviewHtmlAudioVolume';
import { getSharedHtmlAudioForMobileTts } from './webInterviewSharedHtmlAudio';

/** Keep interview TTS at full `<audio>` volume across shared, active, and pre-authorized elements. */
export function ensureWebInterviewTtsOutputVolumePrimed(): void {
  if (Platform.OS !== 'web') return;
  if (shouldSkipWebInterviewTtsVolumeReprime()) return;
  const sharedHtmlAudio = getSharedHtmlAudioForMobileTts();
  if (sharedHtmlAudio) ensureWebHtmlAudioElementMaxVolume(sharedHtmlAudio);
  const activeHtmlAudio = getActiveWebHtmlAudioElement();
  if (activeHtmlAudio) ensureWebHtmlAudioElementMaxVolume(activeHtmlAudio);
}
