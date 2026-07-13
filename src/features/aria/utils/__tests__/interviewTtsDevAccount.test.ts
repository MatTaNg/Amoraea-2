import {
  getInterviewTtsSessionEmail,
  isDefaultVoiceFastPlaybackAccountEmail,
  normalizeInterviewTtsAccountEmail,
  setInterviewTtsSessionEmail,
  shouldUseDefaultVoiceInsteadOfElevenLabs,
} from '../interviewTtsDevAccount';

describe('interviewTtsDevAccount', () => {
  afterEach(() => {
    setInterviewTtsSessionEmail(null);
  });

  it('normalizes email for comparison', () => {
    expect(normalizeInterviewTtsAccountEmail('  MattAng5280@Gmail.com ')).toBe('mattang5280@gmail.com');
  });

  it('recognizes configured dev accounts', () => {
    expect(isDefaultVoiceFastPlaybackAccountEmail('mattang5280@gmail.com')).toBe(true);
    expect(isDefaultVoiceFastPlaybackAccountEmail('ng5280@hotmail.com')).toBe(true);
    expect(isDefaultVoiceFastPlaybackAccountEmail('other@example.com')).toBe(false);
    expect(isDefaultVoiceFastPlaybackAccountEmail(null)).toBe(false);
  });

  it('routes TTS through default voice when session email matches', () => {
    expect(shouldUseDefaultVoiceInsteadOfElevenLabs()).toBe(false);
    setInterviewTtsSessionEmail('ng5280@hotmail.com');
    expect(getInterviewTtsSessionEmail()).toBe('ng5280@hotmail.com');
    expect(shouldUseDefaultVoiceInsteadOfElevenLabs()).toBe(true);
    setInterviewTtsSessionEmail(null);
    expect(shouldUseDefaultVoiceInsteadOfElevenLabs()).toBe(false);
  });
});
