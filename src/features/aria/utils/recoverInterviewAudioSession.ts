import { Platform } from 'react-native';

import { transitionFromRecordingToPlaybackNative } from '@features/aria/utils/audioModeHelpers';

/** Reset native audio routing after abrupt stop (navigation away, OS kill, resume). */
export async function recoverInterviewAudioSession(context: string): Promise<void> {
  if (Platform.OS === 'web') return;
  await transitionFromRecordingToPlaybackNative(context).catch(() => {});
}
