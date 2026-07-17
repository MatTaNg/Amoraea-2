import { describe, expect, it, jest } from '@jest/globals';

import { handleSpeakTextSafeTtsPlaybackError } from '@features/aria/handleSpeakTextSafeTtsPlaybackError';

function baseArgs(
  overrides: Partial<Parameters<typeof handleSpeakTextSafeTtsPlaybackError>[0]> = {},
) {
  return {
    err: new Error('generic'),
    text: 'What is going on between these two?',
    interviewSpeechRole: 'assistant_response' as const,
    skipInterviewSpeechAdvance: false,
    setVoiceState: jest.fn(),
    applyInterviewSpeechComplete: jest.fn(),
    ...overrides,
  };
}

describe('handleSpeakTextSafeTtsPlaybackError', () => {
  it('falls back to visual display and advances assistant speech on TTS failures', () => {
    const args = baseArgs();

    handleSpeakTextSafeTtsPlaybackError(args);

    expect(args.setVoiceState).toHaveBeenCalledWith('idle');
    expect(args.applyInterviewSpeechComplete).toHaveBeenCalledWith(args.text);
  });

  it('does not advance when interview speech advance is skipped', () => {
    const args = baseArgs({ skipInterviewSpeechAdvance: true });

    handleSpeakTextSafeTtsPlaybackError(args);

    expect(args.setVoiceState).toHaveBeenCalledWith('idle');
    expect(args.applyInterviewSpeechComplete).not.toHaveBeenCalled();
  });

  it('swallows applyInterviewSpeechComplete errors so conversation retry is not poison-pilled', () => {
    const args = baseArgs({
      applyInterviewSpeechComplete: jest.fn(() => {
        throw new Error("Cannot read property 'current' of undefined");
      }),
    });

    expect(() => handleSpeakTextSafeTtsPlaybackError(args)).not.toThrow();
    expect(args.setVoiceState).toHaveBeenCalledWith('idle');
  });
});
