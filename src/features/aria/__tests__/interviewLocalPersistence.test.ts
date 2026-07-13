import {
  isGreetingOnly,
  shouldSaveToStorage,
  tryAcquireResumeWelcomePlayback,
  releaseResumeWelcomePlaybackLock,
  clearResumeWelcomePlaybackLock,
} from '../interviewLocalPersistence';

describe('interviewLocalPersistence', () => {
  describe('shouldSaveToStorage', () => {
    it('returns false before scenario start with fewer than two user turns', () => {
      expect(
        shouldSaveToStorage(
          [{ role: 'assistant', content: 'Hi' }, { role: 'user', content: 'Alex' }],
          [],
          null,
        ),
      ).toBe(false);
    });

    it('returns true when at least one scenario is completed', () => {
      expect(
        shouldSaveToStorage([{ role: 'user', content: 'one' }], [1], null),
      ).toBe(true);
    });

    it('returns true once scenario started and two user messages exist', () => {
      expect(
        shouldSaveToStorage(
          [
            { role: 'assistant', content: 'Scenario 1' },
            { role: 'user', content: 'a' },
            { role: 'user', content: 'b' },
          ],
          [],
          1,
        ),
      ).toBe(true);
    });
  });

  describe('isGreetingOnly', () => {
    it('treats empty transcript as greeting-only', () => {
      expect(isGreetingOnly([])).toBe(true);
    });

    it('does not treat mid-interview resume welcome as greeting-only', () => {
      expect(
        isGreetingOnly([
          { role: 'assistant', content: 'Welcome to Amoraea' },
          { role: 'user', content: 'Sam' },
          { role: 'assistant', content: 'Welcome back — pick up where we left off.' },
        ]),
      ).toBe(false);
    });

    it('treats pre-interview greeting stack as greeting-only', () => {
      expect(
        isGreetingOnly([
          { role: 'assistant', content: 'Welcome to Amoraea. What can I call you?' },
        ]),
      ).toBe(true);
    });
  });

  describe('resume welcome playback lock', () => {
    afterEach(() => {
      clearResumeWelcomePlaybackLock();
    });

    it('allows only one in-flight welcome playback per attempt', () => {
      expect(tryAcquireResumeWelcomePlayback('attempt-a')).toBe(true);
      expect(tryAcquireResumeWelcomePlayback('attempt-a')).toBe(false);
      releaseResumeWelcomePlaybackLock('attempt-a');
      expect(tryAcquireResumeWelcomePlayback('attempt-a')).toBe(true);
    });
  });
});
