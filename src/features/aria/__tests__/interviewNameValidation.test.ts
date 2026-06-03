import {
  formatWithName,
  isLikelyAmbientSpeech,
  isPlausibleInterviewName,
  resolvePlausibleInterviewFirstName,
} from '../interviewNameValidation';

describe('interviewNameValidation', () => {
  it('flags ambient phrases as non-name speech', () => {
    expect(isLikelyAmbientSpeech('have a great time')).toBe(true);
    expect(isLikelyAmbientSpeech('okay')).toBe(true);
  });

  it('accepts short plausible name replies', () => {
    expect(isLikelyAmbientSpeech('Sean')).toBe(false);
    expect(isLikelyAmbientSpeech('Jordan Lee')).toBe(false);
    expect(isLikelyAmbientSpeech('Casey.')).toBe(false);
  });

  it('rejects implausible extracted names', () => {
    expect(isPlausibleInterviewName('Time')).toBe(false);
    expect(isPlausibleInterviewName('Great')).toBe(false);
    expect(isPlausibleInterviewName('Sean')).toBe(true);
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
