import { beforeEach, describe, expect, it } from '@jest/globals';

import {
  recordElevenLabsSpokenContext,
  resetElevenLabsSpokenContext,
  takePreviousTextForElevenLabsRequest,
} from '@features/aria/utils/elevenLabsSpokenContext';

describe('elevenLabsSpokenContext', () => {
  beforeEach(() => {
    resetElevenLabsSpokenContext();
  });

  it('returns undefined when no prior spoken context exists', () => {
    expect(takePreviousTextForElevenLabsRequest()).toBeUndefined();
  });

  it('records spoken text and exposes a tail for ElevenLabs previous_text', () => {
    recordElevenLabsSpokenContext('First segment of assistant speech.');
    expect(takePreviousTextForElevenLabsRequest()).toBe('First segment of assistant speech.');
  });

  it('keeps only the last 300 characters when recording', () => {
    const long = 'a'.repeat(350);
    recordElevenLabsSpokenContext(long);
    expect(takePreviousTextForElevenLabsRequest()?.length).toBe(200);
    expect(takePreviousTextForElevenLabsRequest()).toBe('a'.repeat(200));
  });

  it('clears context on reset', () => {
    recordElevenLabsSpokenContext('spoken');
    resetElevenLabsSpokenContext();
    expect(takePreviousTextForElevenLabsRequest()).toBeUndefined();
  });
});
