import {
  markInterviewClosingTtsDelivered,
  resetInterviewClosingTtsSession,
  hasInterviewClosingTtsDeliveredForSession,
  hasInterviewClosingSpeakInFlightForSession,
  tryAcquireInterviewClosingSpeak,
  shouldSuppressDuplicateInterviewClosingTts,
} from '../interviewClosingTtsSession';
import { looksLikeInterviewClosingAssistantMessage } from '../elongatingProbe';

describe('interviewClosingTtsSession', () => {
  beforeEach(() => {
    resetInterviewClosingTtsSession();
  });

  const closing =
    'Thanks for working through all of this with me — that shows real care. Thank you for being so open with me.';

  it('suppresses duplicate closing TTS for the same attempt', () => {
    expect(shouldSuppressDuplicateInterviewClosingTts('attempt-1', closing)).toBe(false);
    markInterviewClosingTtsDelivered('attempt-1', closing);
    expect(shouldSuppressDuplicateInterviewClosingTts('attempt-1', closing)).toBe(true);
    expect(hasInterviewClosingTtsDeliveredForSession('attempt-1')).toBe(true);
  });

  it('does not suppress closing TTS for a different attempt', () => {
    markInterviewClosingTtsDelivered('attempt-1', closing);
    expect(shouldSuppressDuplicateInterviewClosingTts('attempt-2', closing)).toBe(false);
  });

  it('suppresses any second closing TTS after first closing delivered for session', () => {
    const altClosing =
      'Good work getting through all of this — what stood out was your honesty. Thank you for being so open with me.';
    markInterviewClosingTtsDelivered('attempt-1', closing);
    expect(shouldSuppressDuplicateInterviewClosingTts('attempt-1', altClosing)).toBe(true);
  });

  it('tryAcquire prevents parallel closing speaks for same attempt', () => {
    expect(tryAcquireInterviewClosingSpeak('attempt-1')).toBe(true);
    expect(tryAcquireInterviewClosingSpeak('attempt-1')).toBe(false);
    expect(hasInterviewClosingSpeakInFlightForSession('attempt-1')).toBe(true);
    markInterviewClosingTtsDelivered('attempt-1', closing);
    expect(hasInterviewClosingSpeakInFlightForSession('attempt-1')).toBe(false);
    expect(tryAcquireInterviewClosingSpeak('attempt-1')).toBe(false);
  });

  it('does not suppress closing TTS solely because speak is in-flight', () => {
    expect(tryAcquireInterviewClosingSpeak('attempt-1')).toBe(true);
    expect(shouldSuppressDuplicateInterviewClosingTts('attempt-1', closing)).toBe(false);
  });

  it('ignores non-closing assistant text', () => {
    markInterviewClosingTtsDelivered('attempt-1', closing);
    expect(
      shouldSuppressDuplicateInterviewClosingTts(
        'attempt-1',
        'How would you repair this situation?',
      ),
    ).toBe(false);
    expect(looksLikeInterviewClosingAssistantMessage('How would you repair this situation?')).toBe(
      false,
    );
  });
});
