import {
  clearResumeDeferredUserSpeech,
  flushResumeDeferredUserSpeechWhenUnblocked,
  peekResumeDeferredUserSpeech,
  queueResumeDeferredUserSpeech,
  takeResumeDeferredUserSpeech,
} from '@features/aria/resumeDeferredUserSpeech';
import { acquireResumeWelcomePlaybackLock, releaseResumeWelcomePlaybackLock } from '@features/aria/interviewLocalPersistence';

describe('resumeDeferredUserSpeech', () => {
  beforeEach(() => {
    clearResumeDeferredUserSpeech();
    releaseResumeWelcomePlaybackLock('attempt-test');
  });

  it('queues and takes deferred speech once', () => {
    queueResumeDeferredUserSpeech('  hello world  ');
    expect(peekResumeDeferredUserSpeech()).toBe('hello world');
    expect(takeResumeDeferredUserSpeech()).toBe('hello world');
    expect(takeResumeDeferredUserSpeech()).toBeNull();
  });

  it('ignores empty queue payloads', () => {
    queueResumeDeferredUserSpeech('   ');
    expect(peekResumeDeferredUserSpeech()).toBeNull();
  });

  it('flushes deferred speech after resume playback lock releases', async () => {
    acquireResumeWelcomePlaybackLock('attempt-test');
    queueResumeDeferredUserSpeech('I think James could have led with emotions.');
    const processUserSpeech = jest.fn(async () => undefined);

    const flushPromise = flushResumeDeferredUserSpeechWhenUnblocked(
      {
        processUserSpeech,
        resumeLoadingFlowActiveRef: { current: false },
        resumeOfferWelcomeTtsRef: { current: false },
        resumeRepeatChoicePendingRef: { current: false },
        interviewSessionAttemptIdRef: { current: 'attempt-test' },
      },
      { pollMs: 5 },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(processUserSpeech).not.toHaveBeenCalled();

    releaseResumeWelcomePlaybackLock('attempt-test');
    await flushPromise;

    expect(processUserSpeech).toHaveBeenCalledWith(
      'I think James could have led with emotions.',
    );
    expect(peekResumeDeferredUserSpeech()).toBeNull();
  });
});
