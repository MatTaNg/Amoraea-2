import { awaitInterviewScreenReadyWithTimeout } from '@features/aria/awaitInterviewScreenReadyWithTimeout';
import { awaitResumePlaybackAfterLoadingDismissed } from '@features/aria/awaitResumePlaybackAfterLoadingDismissed';
import { startResumeLoadingFailsafe } from '@features/aria/runResumeLoadingFailsafe';

describe('awaitInterviewScreenReadyWithTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves when the screen-ready signal resolves first', async () => {
    const signal = jest.fn(async () => undefined);
    const pending = awaitInterviewScreenReadyWithTimeout(signal, 4000);
    await pending;
    expect(signal).toHaveBeenCalledTimes(1);
  });

  it('resolves after timeout when the screen-ready signal never resolves', async () => {
    const signal = jest.fn(() => new Promise<void>(() => {}));
    const pending = awaitInterviewScreenReadyWithTimeout(signal, 1000);
    jest.advanceTimersByTime(1000);
    await pending;
    expect(signal).toHaveBeenCalledTimes(1);
  });
});

describe('awaitResumePlaybackAfterLoadingDismissed', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('waits until resume loading is cleared', async () => {
    const ref = { current: true };
    const pending = awaitResumePlaybackAfterLoadingDismissed(ref, 5000);
    jest.advanceTimersByTime(100);
    ref.current = false;
    jest.advanceTimersByTime(50);
    await pending;
  });

  it('returns after timeout even if loading never clears', async () => {
    const ref = { current: true };
    const pending = awaitResumePlaybackAfterLoadingDismissed(ref, 500);
    jest.advanceTimersByTime(500);
    await pending;
  });
});

describe('startResumeLoadingFailsafe', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('clears resume loading after timeout', () => {
    const resumeLoadingFlowActiveRef = { current: true };
    const setResumeLoadingVisible = jest.fn();
    const logSessionResumeState = jest.fn();
    const clear = startResumeLoadingFailsafe(
      { resumeLoadingFlowActiveRef, setResumeLoadingVisible, logSessionResumeState },
      8000,
    );
    jest.advanceTimersByTime(8000);
    expect(resumeLoadingFlowActiveRef.current).toBe(false);
    expect(setResumeLoadingVisible).toHaveBeenCalledWith(false);
    expect(logSessionResumeState).toHaveBeenCalledWith('ready');
    clear();
  });

  it('does nothing when loading already cleared', () => {
    const resumeLoadingFlowActiveRef = { current: false };
    const setResumeLoadingVisible = jest.fn();
    const logSessionResumeState = jest.fn();
    startResumeLoadingFailsafe(
      { resumeLoadingFlowActiveRef, setResumeLoadingVisible, logSessionResumeState },
      8000,
    );
    jest.advanceTimersByTime(8000);
    expect(setResumeLoadingVisible).not.toHaveBeenCalled();
  });
});
