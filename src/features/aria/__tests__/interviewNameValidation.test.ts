import {
  applyInterviewNameWhisperCorrection,
  formatWithName,
  isInterviewNameWhisperEcho,
  isLikelyAmbientSpeech,
  isPlausibleInterviewName,
  resolvePlausibleInterviewFirstName,
} from '../interviewNameValidation';

describe('interviewNameValidation', () => {
  it('flags ambient phrases as non-name speech', () => {
    expect(isLikelyAmbientSpeech('have a great time')).toBe(true);
    expect(isLikelyAmbientSpeech('okay')).toBe(true);
    expect(isLikelyAmbientSpeech('God bless you.')).toBe(true);
    expect(isLikelyAmbientSpeech('Thank you.')).toBe(true);
    expect(isLikelyAmbientSpeech('Thanks.')).toBe(true);
    expect(isLikelyAmbientSpeech('It works.')).toBe(true);
    expect(isLikelyAmbientSpeech("That's all for now, and I'll see you next time.")).toBe(true);
  });

  it('accepts short plausible name replies', () => {
    expect(isLikelyAmbientSpeech('Sean')).toBe(false);
    expect(isLikelyAmbientSpeech('Jordan Lee')).toBe(false);
    expect(isLikelyAmbientSpeech('Casey.')).toBe(false);
  });

  it('rejects implausible extracted names', () => {
    expect(isPlausibleInterviewName('Time')).toBe(false);
    expect(isPlausibleInterviewName('Great')).toBe(false);
    expect(isPlausibleInterviewName('You')).toBe(false);
    expect(isPlausibleInterviewName("That's")).toBe(false);
    expect(isPlausibleInterviewName('Bye')).toBe(false);
    expect(isPlausibleInterviewName('Cheers')).toBe(false);
    expect(isPlausibleInterviewName('Cheers Cheers')).toBe(false);
    expect(isPlausibleInterviewName('Matt Matt')).toBe(false);
    expect(isPlausibleInterviewName('What')).toBe(false);
    expect(isPlausibleInterviewName('Maths')).toBe(true);
    expect(isPlausibleInterviewName('Sean')).toBe(true);
  });

  it('corrects common Whisper mishears of Matt', () => {
    expect(applyInterviewNameWhisperCorrection('Maths.')).toBe('Matt');
    expect(applyInterviewNameWhisperCorrection('Mads')).toBe('Matt');
    expect(applyInterviewNameWhisperCorrection('Maps.')).toBe('Matt');
    expect(applyInterviewNameWhisperCorrection('Max?')).toBe('Matt');
    expect(applyInterviewNameWhisperCorrection('Sean')).toBe('Sean');
  });

  it('rejects single-word echoes of the name prompt', () => {
    const prompt = "Sorry, I didn't quite catch that — what name would you like me to use?";
    expect(isInterviewNameWhisperEcho('What', prompt)).toBe(true);
    expect(isInterviewNameWhisperEcho('Matt', prompt)).toBe(false);
  });

  it('resolvePlausibleInterviewFirstName strips punctuation', () => {
    expect(resolvePlausibleInterviewFirstName('Tiffany.')).toBe('Tiffany');
    expect(resolvePlausibleInterviewFirstName('have a great time')).toBeNull();
  });

  it('formatWithName omits placeholder when name is missing or implausible', () => {
    expect(formatWithName('Good work, {name}.', 'Time')).toBe('Good work.');
    expect(formatWithName('Good work, {name}.', 'Alex')).toBe('Good work, Alex.');
  });
});
