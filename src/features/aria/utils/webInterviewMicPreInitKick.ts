import {
  beginInterviewMicPreInitDuringTts,
  type PreInitTriggerDuring,
} from '@features/aria/utils/webInterviewMicPreInit';

import { webSpeechShouldDeferToUserGesture } from './webSpeechDeferPolicy';

/** Mobile web: opening mic capture during TTS ducks playback — pre-init runs after the turn instead. */
export function kickInterviewMicPreInitForTtsPlayback(
  preInitTriggerDuring: PreInitTriggerDuring,
): void {
  if (webSpeechShouldDeferToUserGesture()) return;
  void beginInterviewMicPreInitDuringTts(preInitTriggerDuring);
}
