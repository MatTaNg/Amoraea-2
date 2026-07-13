import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@features/aria/utils/webSpeechDeferPolicy', () => ({
  webSpeechShouldDeferToUserGesture: jest.fn(() => true),
}));

jest.mock('@features/aria/utils/webInterviewMicPreInit', () => ({
  beginInterviewMicPreInitDuringTts: jest.fn(),
}));

import { beginInterviewMicPreInitDuringTts } from '@features/aria/utils/webInterviewMicPreInit';
import { kickInterviewMicPreInitForTtsPlayback } from '@features/aria/utils/webInterviewMicPreInitKick';

describe('kickInterviewMicPreInitForTtsPlayback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips mic pre-init when gesture deferral applies on mobile web', () => {
    kickInterviewMicPreInitForTtsPlayback('tts_playback');
    expect(beginInterviewMicPreInitDuringTts).not.toHaveBeenCalled();
  });
});
