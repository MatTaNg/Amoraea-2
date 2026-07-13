import { describe, expect, it } from '@jest/globals';

import {
  extractInterviewNameFromResponse,
  extractInterviewNameFromTranscript,
  looksLikeName,
} from '@features/aria/interviewNameExtraction';

describe('interviewNameExtraction', () => {
  it('extracts a direct first name', () => {
    expect(extractInterviewNameFromResponse('Alex')).toEqual({
      extractedName: 'Alex',
      extractionMethod: 'direct',
      isFalseNameTrigger: false,
    });
  });

  it('strips intro phrases before extracting', () => {
    expect(extractInterviewNameFromResponse("My name is Sarah")).toEqual({
      extractedName: 'Sarah',
      extractionMethod: 'sentence_stripped',
      isFalseNameTrigger: false,
    });
  });

  it('flags common false-name triggers', () => {
    expect(extractInterviewNameFromResponse('Yeah').isFalseNameTrigger).toBe(true);
    expect(extractInterviewNameFromResponse('Ready').isFalseNameTrigger).toBe(true);
  });

  it('looksLikeName accepts short alphabetic tokens', () => {
    expect(looksLikeName('Mary-Jane')).toBe(true);
    expect(looksLikeName('hello there friend')).toBe(false);
  });

  it('extractInterviewNameFromTranscript finds name after name prompt', () => {
    const name = extractInterviewNameFromTranscript([
      { role: 'assistant', content: "Hi, I'm Amoraea. What can I call you?" },
      { role: 'user', content: 'Matt' },
    ]);
    expect(name).toBe('Matt');
  });
});
